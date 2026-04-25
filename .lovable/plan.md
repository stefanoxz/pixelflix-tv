## Objetivo

Quando o usuário cola uma URL M3U na tela de login e o servidor extraído **autentica com sucesso** no Xtream, a DNS é cadastrada automaticamente na allowlist (`allowed_servers`) do painel admin, sem intervenção manual. Se a DNS já estiver cadastrada, nada muda. Se a autenticação falhar, nada é gravado.

## Como vai funcionar (visão do usuário)

1. Usuário cola URL M3U → clica "Entrar com M3U"
2. Sistema extrai `server`, `username`, `password`
3. Tenta o login direto contra o servidor Xtream
4. **Se autenticar:**
   - Se DNS já está na allowlist → segue fluxo normal (login OK)
   - Se DNS é nova → grava em `allowed_servers` com label inteligente, depois loga o usuário
5. **Se falhar autenticação** → mensagem de erro normal, nada é gravado

## Detalhes técnicos

### 1. Edge function `iptv-login` — novo modo `m3u_register`

Adicionar um novo branch no `Deno.serve` (antes da validação de allowlist do modo default):

- Recebe `{ mode: "m3u_register", server, username, password }`
- **Pula** a checagem de allowlist (essa é a diferença crítica vs. modo default)
- Roda `attemptLogin(server, username, password, null, admin)` direto
- Se `r.ok === true`:
  - Extrai label: `data.server_info?.url` (campo retornado pelo Xtream) → fallback para `new URL(usedVariant).hostname`
  - `admin.from("allowed_servers").upsert({ server_url: normalizeServer(usedVariant), label, notes: "Auto-cadastrado via login M3U" }, { onConflict: "server_url" })` — upsert evita duplicar quando a DNS já existe
  - Loga `login_events` com `reason: "m3u_auto_register"` em sucesso
  - Retorna o mesmo payload do login normal (`success, user_info, server_info, server_url, allowed_servers, route`) para o cliente entrar direto
- Se `r.ok === false`:
  - Loga falha em `login_events`
  - Retorna `errorResponse` com a mesma classificação do fluxo padrão (INVALID_CREDENTIALS, SERVER_UNREACHABLE, etc.)
  - **Não grava** nada em `allowed_servers`

Nada muda no modo default — usuários que digitam usuário/senha continuam sujeitos à allowlist como hoje.

### 2. Cliente — `src/services/iptv.ts`

Adicionar função `iptvLoginM3u({ server, username, password })` que invoca a edge function com `mode: "m3u_register"`. Reaproveita o mesmo tratamento de erro de `iptvLogin`.

### 3. Cliente — `src/pages/Login.tsx`

No `handleSubmitM3u`, substituir a chamada `performLogin(parsed.server, ...)` por um caminho dedicado que use `iptvLoginM3u`. Em sucesso:
- `resolveStreamBase` igual ao fluxo atual
- `setSession(...)` igual
- `toast.success` mostra mensagem extra quando o backend indica que foi recém-cadastrada (campo opcional `auto_registered: true` no payload)
- `navigate("/")`

A aba "Usuário e senha" continua usando `iptvLogin` original (allowlist obrigatória).

### 4. Painel admin

Nenhuma mudança necessária — a DNS aparece automaticamente na lista `allowed_servers` da próxima vez que o admin abrir `/admin`, com o label e a nota indicando origem automática.

## Segurança

- O auto-cadastro só ocorre **após** o servidor Xtream retornar `user_info` válido com `auth: 1`. Isso garante que apenas DNS que realmente são servidores IPTV funcionais entrem na allowlist (não é possível injetar URLs aleatórias).
- O `attemptLogin` mantém todos os limites de timeout, fallback de UA e validação atuais.
- Nenhuma mudança em RLS — o `admin client` (service role) já é quem grava em `allowed_servers` na edge function.
- O modo `m3u_register` exige `server`, `username` e `password` no body — sem trio completo retorna `BAD_REQUEST`.

## Arquivos afetados

- `supabase/functions/iptv-login/index.ts` — novo branch `mode: "m3u_register"` + upsert em `allowed_servers` em sucesso
- `src/services/iptv.ts` — nova função `iptvLoginM3u`
- `src/pages/Login.tsx` — `handleSubmitM3u` passa a usar a nova função

## O que NÃO muda

- Login com usuário/senha continua bloqueado pela allowlist
- Painel admin de DNS, RLS, tabelas, hooks, fluxo de favoritos, player — tudo intocado
- Nenhuma migração de banco necessária (`allowed_servers` já tem todas as colunas)
