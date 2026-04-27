## Objetivo

Remover toda a lógica de proxy via Cloudflare Worker do backend, voltando a conexão direta com painéis IPTV. O usuário vai contratar uma VPS no futuro pra resolver o bloqueio do `bkpac.cc`. Enquanto isso, garantir que a mensagem de erro seja honesta (mostrar "servidor bloqueado" em vez de "usuário/senha inválidos").

## O que será feito

### 1. Remover o helper de proxy
- Apagar `supabase/functions/_shared/proxied-fetch.ts`.

### 2. Voltar edge functions a usar `fetch` direto
Trocar todas as chamadas `proxiedFetch(...)` por `fetch(...)` simples nas funções:
- `supabase/functions/iptv-login/index.ts`
- `supabase/functions/iptv-categories/index.ts`
- `supabase/functions/watch-progress/index.ts`
- `supabase/functions/check-server/index.ts`
- `supabase/functions/admin-api/index.ts`

Remover imports do `proxied-fetch`. Remover qualquer cache de "host bloqueado" (`_directBlockedUntil`).

### 3. Corrigir classificação de erro no `iptv-login`
Distinguir entre:
- **Credenciais inválidas reais** (HTTP 401/403, `auth: 0` da resposta JSON do painel) → "Usuário ou senha inválidos".
- **Bloqueio/inalcançável** (Connection reset, timeout, 404, DNS fail) → "Servidor indisponível ou bloqueado. Tente novamente ou contate o provedor."

Quando todos os servidores da allowlist falharem com erro de transporte (sem nenhum 401 real), retornar `SERVER_UNREACHABLE` em vez de `INVALID_CREDENTIALS`.

### 4. Atualizar mensagem no frontend
- `src/services/iptv.ts`: mapear o novo código `SERVER_UNREACHABLE` pra mensagem clara em PT-BR.

### 5. Redeploy
Redeployar as funções alteradas: `iptv-login`, `iptv-categories`, `watch-progress`, `check-server`, `admin-api`.

## O que NÃO vai mudar

- A allowlist de servidores (incluindo `bkpac.cc`) **fica como está** — quando você tiver a VPS, é só apontar o backend pra ela e os servidores voltam a funcionar.
- O secret `IPTV_PROXY_URL` continua cadastrado mas **inerte** (nenhum código vai usar). Você pode apagar manualmente em Cloud → Secrets quando quiser, sem afetar nada.
- Auth, RLS, banco de dados — nada disso é tocado.

## Resultado esperado

- Backend mais simples, sem dependência de proxy externo.
- Painéis que **não bloqueiam** os IPs do Supabase (a maioria) continuam funcionando normal.
- Painéis que **bloqueiam** (como `bkpac.cc`) vão mostrar erro honesto: "Servidor indisponível ou bloqueado", não mais "Usuário ou senha inválidos".
- Quando você contratar a VPS no futuro, basta criar uma edge function nova ou variável apontando pra ela — base limpa pra isso.

## Detalhes técnicos

- `proxied-fetch.ts` será removido com `rm`. Não há outros consumidores fora das 5 funções listadas (vou confirmar com `rg` antes de remover).
- O `SERVER_UNREACHABLE` será um novo valor no campo `error` do response JSON. Backward-compat: o frontend trata os dois (`INVALID_CREDENTIALS` continua funcionando).
- Não há mudanças em banco, RLS, secrets ou config.toml.