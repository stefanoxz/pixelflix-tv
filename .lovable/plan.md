## Objetivo

Hoje o "Testar endpoint" faz **1 chamada** (GET/HEAD em um path) e mostra status, rota e preview. Útil mas raso — não diferencia "DNS quebrou", "TLS quebrou", "auth errada", "geo-block" ou "servidor lento mas vivo". Vou transformá-lo num **diagnóstico em camadas** que roda várias sondas em paralelo e mostra um relatório consolidado.

## O que muda (visão de produto)

O admin clica **"Diagnosticar"** e em 3-8s recebe:

1. **Resolução & alcance** — DNS resolve? Porta responde? Quanto tempo até primeiro byte (TTFB)?
2. **Comparativo direto vs proxy** — roda as duas rotas em paralelo (quando proxy configurado) para mostrar lado a lado: "direto = reset, proxy = 200 OK em 380ms" → prova de geo-block.
3. **Bateria Xtream** (quando user/pass informados): chama em sequência os endpoints reais do app —
   - `player_api.php` (auth + user_info + server_info)
   - `player_api.php?action=get_live_categories`
   - `player_api.php?action=get_vod_categories`
   - `player_api.php?action=get_series_categories`
   - 1 stream HEAD em `/live/<u>/<p>/<id>.ts` (pega o primeiro canal da 1ª categoria) para validar entrega de mídia, não só API.
4. **Detalhes HTTP** — status, headers relevantes (`server`, `content-type`, `content-length`, `cf-ray`, `via`, `x-cache`), tamanho do body, redirects seguidos, expiração da conta Xtream (`exp_date`), conexões ativas (`active_cons`/`max_connections`), status `active`/`disabled`/`banned`.
5. **Veredito** com badges coloridos:
   - ✅ **Saudável** (todas sondas 2xx + Xtream auth=1)
   - ⚠️ **Auth ok, stream falhou** (API responde, mídia não entrega — típico de servidor saturado)
   - ⚠️ **Geo-bloqueado** (direto falhou, proxy passou)
   - ❌ **Credencial inválida** (HTTP 200 mas `user_info` ausente ou `auth=0`)
   - ❌ **Conta expirada/banida** (`status != "Active"` ou `exp_date` no passado)
   - ❌ **Servidor offline** (todas as sondas falharam em ambas as rotas)
6. **Cópia rápida** — botão "Copiar relatório" gera um texto plano com tudo (URL, latências, headers, vereditos) para colar em ticket/WhatsApp.

## Mudanças técnicas

### Backend — `supabase/functions/admin-api/index.ts`

Substituir o handler de `action === "test_endpoint"` por uma versão "v2" mantendo o nome (mesmo contrato no front). Novo payload aceita também:

```ts
{
  server_url, username, password,
  mode?: "quick" | "full",          // default "full"
  test_stream?: boolean,            // default true se user/pass
  compare_routes?: boolean,         // default true se proxy configurado
  timeout_ms?: number,
}
```

Pipeline interno:

1. **Probe TCP/HTTP raiz** — `HEAD base_url/` com timeout curto (3s), captura TTFB e headers do servidor.
2. **Probes Xtream em paralelo** (Promise.all, cada uma com timeout independente):
   - `player_api.php` (auth)
   - 3 categorias (live/vod/series)
3. **Probe de stream** — só roda se auth ok: pega `categories[0].category_id`, chama `get_live_streams&category_id=...`, pega `streams[0].stream_id`, faz `HEAD base/live/u/p/id.ts` (timeout 5s, sem follow de redirect — só queremos saber se entrega bytes).
4. **Comparativo de rota** (opcional) — quando `compare_routes && isProxyEnabled()`, refaz só o `player_api.php` forçando proxy via novo helper interno (atalho que reusa `Deno.HttpClient` do `proxied-fetch.ts`). Mostra latência das duas rotas lado a lado.
5. **Classificação** — função `classifyVerdict(probes)` retorna `{ level: "ok"|"warn"|"error", code, message }` consumindo as buckets já existentes em `dns_errors` (refused/reset/tls/cert/timeout/dns/etc) — reaproveita a lógica de `classify()` que já existe no arquivo.

Resposta nova (retro-compatível: campos antigos seguem presentes):

```ts
{
  // ... campos atuais (target, method, route, ok, status, latency_ms, body_preview, error) ...
  verdict: { level, code, message },
  probes: [
    { name: "root", url, route, status, latency_ms, headers: {...}, error },
    { name: "auth", url, ..., xtream: { auth, status, exp_date, active_cons, max_connections } },
    { name: "live_categories", ..., count: 42 },
    { name: "vod_categories", ..., count: 120 },
    { name: "series_categories", ..., count: 18 },
    { name: "stream_head", url_masked, status, content_type, content_length, latency_ms, error },
  ],
  route_comparison?: {
    direct: { status, latency_ms, error },
    proxy: { status, latency_ms, error },
  },
}
```

Segurança / rate-limit: continua atrás de `MUTATING_ACTIONS`-style (admin-only, já garantido). Adiciono limite simples no edge: máximo de 1 diagnóstico full a cada 5s por admin (cache em memória), evitando martelar servidores upstream.

### Frontend — `src/components/admin/EndpointTestPanel.tsx`

- Toggle **Quick / Full** (Quick = só `player_api.php` como hoje; Full = bateria completa).
- Toggle **Testar stream** (default ligado quando há user/pass).
- Toggle **Comparar rotas** (auto-desabilitado se proxy não configurado).
- Card "Veredito" no topo do resultado, com cor (verde/amarelo/vermelho) + 1 frase em PT-BR.
- Tabela de probes: nome | rota | status | latência | observação. Cada linha expansível mostra headers + erro completo.
- Card lateral "Conta Xtream" quando há auth: usuário, status, expira em, conexões X/Y, criado em.
- Card "Comparativo de rota" (quando aplicável): duas colunas com latência grande + status.
- Botão **"Copiar relatório"** (gera texto plano com `navigator.clipboard.writeText`).

### Compatibilidade

O contrato antigo segue funcionando — campos novos são aditivos. Outras telas que (eventualmente) consumam `test_endpoint` não quebram.

## Arquivos editados

- `supabase/functions/admin-api/index.ts` — handler `test_endpoint` reescrito (~150 linhas), reusando `classify()` e `proxiedFetch` já existentes.
- `src/components/admin/EndpointTestPanel.tsx` — UI expandida (toggles, tabela de probes, veredito, comparativo).

Sem mudanças de schema, sem migrações, sem novos secrets.

## Fora de escopo (posso fazer depois se quiser)

- Persistir histórico de diagnósticos numa tabela `endpoint_diagnostics` para gráfico de tendência.
- Agendar diagnóstico recorrente (cron) e alertar via toast quando uma DNS aprovada ficar vermelha.
- Traceroute / MTR (não dá em edge function — exigiria worker externo).
