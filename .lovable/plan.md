## Objetivo

Remover qualquer caminho de código que ainda trata "Limite de telas atingido" / `MAX_CONNECTIONS` como erro de login. A regra final de sucesso passa a ser **única**: `user_info.auth === 1` → login aceito; o limite vira só um aviso (`at_connection_limit`), nunca um bloqueio.

## Estado atual (resumo da auditoria)

- A edge `iptv-login` já marca `at_connection_limit: true` e segue como sucesso quando `auth=1` + telas cheias (ok).
- O frontend (`Login.tsx`) já mostra esse caso como toast warning não-bloqueante e navega para `/sync` (ok).
- **Resíduos a remover** (ainda capazes de classificar limite como erro em casos de borda):
  1. `classifyReason()` em `supabase/functions/iptv-login/index.ts` (linhas ~96-102) ainda mapeia `max_connections|limite de telas` → código `MAX_CONNECTIONS` com mensagem bloqueante.
  2. `MaxConnectionsError` em `src/services/iptv.ts` (linha 460) + dois trechos no `invokeFn` (linhas ~523 e ~528) que lançam esse erro quando vêem `code: "MAX_CONNECTIONS"` no envelope.

## Mudanças

### 1. `supabase/functions/iptv-login/index.ts`
- Remover a primeira ramificação de `classifyReason` que retorna `code: "MAX_CONNECTIONS"`. Se em algum cenário marginal o painel mandar esse texto SEM `auth=1`, classifica como `INVALID_CREDENTIALS` normal (mensagem genérica), nunca como bloqueio específico de "limite".
- Manter intacta toda a lógica de `tryVariant` que já marca `at_connection_limit: true` quando `auth === 1`.

### 2. `src/services/iptv.ts`
- Remover a classe `MaxConnectionsError` (export incluído).
- Em `invokeFn`, remover os dois blocos `if (parsed?.code === "MAX_CONNECTIONS")` e `if ((data as ...)?.code === "MAX_CONNECTIONS")` — passam a cair no fluxo padrão, mas como a edge nunca mais emitirá esse código, ficam inertes e o código fica menor.
- Remover o tratamento especial em `classifyError` que checa `instanceof MaxConnectionsError`.

### 3. Verificação no frontend
- Buscar em todo `src/` por imports/usos remanescentes de `MaxConnectionsError`. Se houver (ex.: `Player.tsx`, hooks de stream), substituir por tratamento de erro genérico de stream (esses pontos NÃO bloqueiam o login — só mostram que o conteúdo não abriu, que é o comportamento desejado).

## O que NÃO muda

- `at_connection_limit: true` continua sendo emitido pela edge e mostrado como toast warning no `Login.tsx`.
- Fluxo de player, proxy, autenticação Supabase, banco, RLS, allowlist, fallback de playlist — tudo intocado.
- Mensagem `"Limite de telas"` vinda do painel continua sendo lida; só deixa de gerar erro de login.

## Resultado esperado

- Login com `auth=1` SEMPRE entra no app, com ou sem telas livres.
- Se as telas estiverem cheias: catálogo carrega normalmente; toast amarelo avisa; erro só aparece quando o usuário tentar dar play num conteúdo (fluxo de player já existente).
- Login só falha quando `auth !== 1` (credenciais realmente inválidas) ou quando o servidor não responde.
