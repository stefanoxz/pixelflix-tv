# Acelerar abertura de canais ao vivo

## Diagnóstico (números reais dos logs)

Para abrir um canal, o pipeline atual gasta:

```text
setup_start (t=0)
├── OPTIONS  /stream-token       743 ms   ← preflight CORS
├── POST     /stream-token      1800 ms   ← 3 queries Postgres + upsert + sign
├── GET      /stream-proxy m3u8 1412 ms   ← fetch upstream + assina N URLs
├── GET      /stream-proxy m3u8 1270 ms   ← nested playlist (2º hop)
├── (em paralelo) OPTIONS+POST /stream-event  ~1100 ms
└── GET      /stream-proxy 1ºseg ~700 ms
                                ─────
                          Total ~6-9 s  ✓ bate com 8772 ms observado
```

Tudo isso roda **antes** do hls.js dizer `MANIFEST_PARSED`. Os ganhos abaixo
atacam cada barra dessa lista, sem mexer em segurança nem em features.

## O que vai mudar

### 1. Eliminar preflights CORS recorrentes (ganho ~1.5 s)

As respostas `OPTIONS` das três funções (`stream-token`, `stream-event`,
`stream-proxy`) hoje não enviam `Access-Control-Max-Age`. O browser refaz o
preflight em cada chamada nova. Vamos adicionar:

```text
Access-Control-Max-Age: 86400
```

Resultado: o preflight só acontece **uma vez por dia** por origem/método, em
vez de a cada novo canal aberto.

### 2. Paralelizar e enxugar `stream-token` (1800 ms → ~400 ms)

A função hoje executa **3 SELECTs sequenciais** + 2 UPSERTs antes de assinar:

```text
SELECT user_blocks  →  SELECT usage_counters  →  SELECT active_sessions
                                                        ↓
                                  UPSERT usage_counters + UPSERT active_sessions
                                                        ↓
                                                   sign + return
```

Mudanças:

- **Paralelizar leituras**: `Promise.all([blockCheck, usageCounter, activeSessions])`.
- **Mover upserts para fire-and-forget após o return**: `EdgeRuntime.waitUntil(...)`
  (suportado nativamente pelo Deno Deploy / Supabase). O cliente não precisa
  esperar a escrita para receber o token.
- **Cache em memória da função (TTL 30 s) do `user_blocks`**: blocos mudam
  raramente; revalidar a cada 30 s evita 1 SELECT por request.
- **Pular o SELECT de `usage_counters` quando o counter já está em memória**
  na própria função (singleton mapa user→{minute, count}, reseta no minuto novo).
  O UPSERT continua acontecendo (fire-and-forget) para persistir entre
  cold-starts.

Segurança preservada: o token continua amarrado a `userId + IP/24 + UA hash`
e expira em 30 min. As escritas atrasadas só afetam o **próximo** request,
não dão privilégio extra ao atual.

### 3. `stream-event(stream_started)` fora do caminho crítico

Hoje o player chama `reportStreamEvent("stream_started")` e isso aparece nos
logs como ~1.1 s entre OPTIONS+POST. O evento é puramente analítico — não
precisa bloquear nada. Mudanças no client:

- Disparar com `fetch(..., { keepalive: true })` **sem `await`** logo após
  o `play()`.
- Marcar a chamada como `priority: "low"` (Fetch Priority API) para que o
  browser não a empilhe na mesma fila do manifest.

### 4. Resolver a nested playlist no mesmo hop (1270 ms → 0)

Quando o upstream devolve uma **master playlist** com uma única variante
(caso comum em IPTV BR), o `stream-proxy` hoje devolve o master reescrito,
o hls.js então faz **outro** request para a nested. Mudança no
`stream-proxy`:

- Após fazer parse do upstream, se o documento for master e tiver
  exatamente 1 `#EXT-X-STREAM-INF`, já buscar a nested upstream **na mesma
  invocação** (em paralelo com a assinatura), e devolver a nested já
  reescrita marcando `Content-Type` HLS normalmente.
- Quando o master tiver várias variantes (4K + HD + SD), manter o comportamento
  atual — o ABR do hls.js precisa enxergar todas.

Em master de 1 variante (a maioria dos canais Xtream), elimina-se 1 hop
inteiro de ~1.3 s.

### 5. Pré-aquecer as edge functions na entrada da grade (`/live`)

Quando o usuário entra em `/live` (ou abre a lista de canais), disparar
em background:

```ts
// preheat: dispara um OPTIONS fake só para acordar a função.
fetch(`${SUPABASE_URL}/functions/v1/stream-token`, { method: "OPTIONS", keepalive: true });
fetch(`${SUPABASE_URL}/functions/v1/stream-proxy`,  { method: "OPTIONS", keepalive: true });
```

Isso elimina o cold-start de ~500-1000 ms que aparece na primeira
abertura de canal por sessão.

### 6. HLS.js: começar a tocar com 1 segmento, não 3

`HLS_CONFIG` hoje:

```ts
liveSyncDurationCount: 3,   // espera 3 segmentos antes de play
```

Para canais ao vivo Xtream (segmentos de ~6 s), isso adiciona até **2 s** ao
TTFF. Vamos reduzir para `2` — dentro do mínimo recomendado pelo HLS.js para
estabilidade, mas mais rápido. Permanece tolerância via
`liveMaxLatencyDurationCount: 10`.

### 7. Painel de logs: medir essas etapas

Adicionar três marcações claras no painel de logs do player:

- `stream_token_ms` (POST /stream-token)
- `master_playlist_ms` (1º GET /stream-proxy)
- `nested_playlist_ms` (2º GET /stream-proxy, ou 0 se inline)
- `first_segment_ms`

Para conseguirmos validar o ganho real depois do deploy.

## Arquivos a alterar

```text
supabase/functions/stream-token/index.ts        # paralelizar + waitUntil + cache
supabase/functions/stream-proxy/index.ts        # Access-Control-Max-Age + nested inline
supabase/functions/stream-event/index.ts        # Access-Control-Max-Age
src/services/iptv.ts                            # reportStreamEvent fire-and-forget + keepalive
src/components/Player.tsx                       # liveSyncDurationCount: 2 + métricas extra
src/pages/Live.tsx (ou equivalente)             # preheat OPTIONS no mount
```

## Resultado esperado

| Etapa | Antes | Depois |
|---|---|---|
| Preflight stream-token | 743 ms | 0 (cacheado) |
| POST stream-token | 1800 ms | ~400 ms |
| GET master playlist | 1412 ms | ~1000 ms (warm) |
| GET nested playlist | 1270 ms | 0 (inline em 1-variante) |
| stream-event | bloqueia ~1100 ms | fora do caminho crítico |
| HLS.js sync wait | ~2000 ms | ~1300 ms |
| **Setup → Manifest** | **8772 ms** | **~2500 ms** |
| **Manifest → 1º Frame** | 2193 ms | ~1500 ms |
| **TTFF total** | **10965 ms** | **~4000 ms** |

Sem nenhuma regressão de segurança: o token continua bound a
sessão/IP/UA, RLS e rate limits permanecem ativos. As otimizações são
puramente de ordenação (paralelo vs. sequencial) e de caching de
preflights/blocos.
