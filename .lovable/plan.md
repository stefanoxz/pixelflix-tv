

## Plano final consolidado — IPTV produção

Mesmo escopo já aprovado nas rodadas anteriores. Reapresento limpo para confirmar antes de executar tudo numa única leva.

> **Sobre rate limiting:** o backend Lovable não tem primitivas estabelecidas pra isso. A implementação será **ad-hoc** (tabela `usage_counters` + memória de worker), best-effort. Conforme pedido explícito, sigo em frente.

---

### 1. Player robusto
**Arquivo:** `src/components/Player.tsx`

- Handlers `onError`, `onWaiting`, `onStalled`, `onCanPlay`, `onLoadedMetadata`.
- Reconexão Hls.js: 3 tentativas, backoff 2s/4s/8s. `mediaError` → `recoverMediaError()`. `networkError` → `startLoad()`.
- Cleanup: `hls.destroy()` + `video.removeAttribute("src")` + `video.load()` no unmount/troca. Elimina memory leak.
- Estados PT-BR: `Conectando…` / `Buffering…` / `Erro: <msg>` + botão **Tentar novamente**.
- Heartbeat a cada 45s renova token e atualiza `last_seen_at`.
- Erro fatal → registra em `stream-event`.

---

### 2. Proxy sem retransmissão de vídeo (elimina gargalo)
**Arquivo:** `supabase/functions/stream-proxy/index.ts`

| Tipo | Comportamento |
|---|---|
| Playlist `.m3u8` | Passthrough (reescreve URLs dos segmentos com novo sig). Payload pequeno. |
| Segmento `.ts` / chave / `.mp4` | Valida token → responde **HTTP 302** para URL real do provedor. Vídeo não passa mais pelo Supabase. |

Trade-off: URL final fica visível no DevTools. Mitigado por token de 30s + nonce de uso único.

---

### 3. Token HMAC amarrado a IP + UA + nonce
**Novo:** `supabase/functions/stream-token/index.ts`
**Alterados:** `stream-proxy`, `src/services/iptv.ts`

Payload assinado: `url | exp | sub | ipPrefix | uaHash | nonce | kind`
- `exp`: 60s playlist / 30s segmento
- `ipPrefix`: /24 IPv4 ou /64 IPv6 (tolera IP móvel)
- `uaHash`: SHA-256(UA) truncado em 16 chars
- `nonce`: gravado em `used_nonces` no primeiro uso de segmento (reuso → 403)
- `kind`: `playlist` ou `segment`

Validações no proxy (falha rápida): HMAC timing-safe → exp → IP → UA → nonce → bloqueio ativo. Falha → `token_rejected` + **403** genérico.

**Secret novo:** `STREAM_PROXY_SECRET` (peço via `add_secret`).

---

### 4. Auth Supabase anônima como base
**Arquivos:** `src/pages/Login.tsx`, `src/context/IptvContext.tsx`

Após login Xtream → `supabase.auth.signInAnonymously()`. JWT exigido por `stream-token`. Logout limpa ambos.

---

### 5. Sessões persistidas + heartbeat + enforcement
**Tabela nova:** `active_sessions(id, anon_user_id PK, iptv_username, ip, ua_hash, started_at, last_seen_at)`

- `stream-token` faz UPSERT por `anon_user_id`.
- Antes do upsert: conta sessões com `last_seen_at > now() - 90s` excluindo a própria. Se ≥ `MAX_SESSIONS` (default 1) → deleta as mais antigas (FIFO) + registra `session_evicted`.
- Player heartbeat 45s mantém `last_seen_at` fresco.
- Sem heartbeat 90s → sessão morre.
- Tela Conta: lista sessões + botão "Encerrar esta".

---

### 6. Controle de consumo + rate limit por usuário
**Tabela nova:** `usage_counters(anon_user_id, window_start, request_count, segment_count, primary key (anon_user_id, window_start))`

- Janela fixa de 1 minuto (`window_start = date_trunc('minute', now())`).
- `stream-token` faz UPSERT incrementando `request_count` por chamada e `segment_count` quando `kind=segment`.
- Limites configuráveis: **60 tokens/min** + **300 segmentos/min** por `anon_user_id`.
- Excedeu → **429** com `Retry-After: 60` + registra `rate_limited`.
- Tempo total derivado de `started_at` em `active_sessions`.
- Limpeza: linhas `window_start < now() - 1h` removidas oportunisticamente em cada insert.

---

### 7. Detecção de abuso + bloqueio temporário
**Tabela nova:** `user_blocks(anon_user_id PK, blocked_until, reason, created_at)`

Heurísticas:
- Token válido vindo de **>1 IP /24 distinto em <30s** → invalida sessão + bloqueio 5min + 403.
- **>3 violações de rate limit em 10min** → escalonado: 5 → 15 → 60min.
- **>10 `token_rejected` consecutivos do mesmo IP em 60s** → blocklist em memória do worker 5min (best-effort).
- UA vazio com token válido → 403 (sem bloqueio).

`stream-token` consulta `user_blocks` antes de processar.

---

### 8. Logs estruturados
**Tabela nova:** `stream_events(id, anon_user_id, event_type, ip, ua_hash, url_hash, meta jsonb, created_at)`

Eventos: `token_issued`, `token_rejected` (motivo), `stream_started`, `stream_error`, `session_evicted`, `rate_limited`, `user_blocked`, `suspicious_pattern`.

`url_hash` = SHA-256 truncado (privacidade).

**Função nova:** `supabase/functions/stream-event/index.ts` — auth obrigatória.

RLS: usuário lê próprios; admin lê tudo.

---

### 9. Painel admin de monitoramento em tempo real
**Arquivo:** `src/pages/Admin.tsx` — nova aba **"Monitoramento"**

- **Usuários online agora**: count distinto em `active_sessions` (last_seen_at > now() - 90s).
- **Streams ativos**: lista paginada (usuário, IP mascarado, started_at, último heartbeat, duração).
- **Top 20 consumidores (24h)**: soma de `request_count`/`segment_count`.
- **Usuários bloqueados agora**: lista de `user_blocks` ativos + botão "Desbloquear".
- **Erros recentes (24h)**: últimos 50 com filtro por tipo.
- **Top 10 IPs com mais rejeições (24h)**.

Auto-refresh 10s. RLS de admin.

---

### 10. Conta enriquecida
**Arquivo:** `src/pages/Account.tsx`

`max_connections`/`active_cons`/`exp_date`/`status` do Xtream + sessões próprias com botão encerrar + aviso de bloqueio ativo.

---

### 11. Auditoria `admin-api`
**Arquivo:** `supabase/functions/admin-api/index.ts`

Toda rota mutativa chama `has_role(auth.uid(), 'admin')`. Erros não vazam stack/URL interna.

---

## Migration consolidada (1 arquivo)
```sql
create table public.active_sessions (...);
create table public.used_nonces (nonce text primary key, used_at timestamptz default now());
create table public.usage_counters (...);
create table public.user_blocks (...);
create table public.stream_events (...);
-- RLS em todas + índices em (last_seen_at), (window_start), (blocked_until), (created_at)
```

## Arquivos tocados
**Frontend:** `Player.tsx`, `Login.tsx`, `IptvContext.tsx`, `services/iptv.ts`, `Account.tsx`, `Admin.tsx`
**Backend:** `stream-token/` (novo), `stream-event/` (novo), `stream-proxy/` (refatorado p/ 302 + validação), `admin-api/` (auditoria roles)
**DB:** 1 migration (5 tabelas + RLS + índices)
**Secret:** `STREAM_PROXY_SECRET`

---

## Fora de escopo (com motivo)
- Esconder URL final após 302: impossível — trade-off pra eliminar gargalo de banda.
- Rate limit cross-worker em tempo real: Edge Functions sem estado compartilhado; tabela + memória é o máximo viável.
- `max_connections` real: continua do Xtream; nosso lado complementa.

## Resultado esperado
- Banda Supabase ↓~95%, CPU worker ↓~90%.
- Token roubado/colado em outro IP/UA → bloqueado em <30s.
- 2ª pessoa logando → primeira cai em <90s.
- Spam no proxy → 429 → bloqueio escalonado 5/15/60min.
- Admin com painel real (online/consumo/bloqueios/erros) atualizado a cada 10s.
- Player com erro claro + retry; sem leak.
- Nada que funciona hoje quebra.

