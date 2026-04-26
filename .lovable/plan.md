## Diagnóstico

O painel `maxtv.uk` **autenticou com sucesso** (`auth:1, status:Active`). O bloqueio é apenas **limite de telas atingido**: a conta tem `max_connections: 2` e já está com `active_cons: 2`. Não é bug do nosso webplayer — é limite real da conta. Provavelmente as 2 conexões em uso são "fantasmas" (sessões antigas do painel que demoram pra expirar) ou outro device do mesmo cliente.

Hoje, ao detectar `active_cons >= max_connections`, nós bloqueamos o login inteiro com erro `MAX_CONNECTIONS`, o que impede o usuário até de **abrir o app, navegar pelo catálogo, e esperar as conexões expirarem**.

## O que vamos mudar

1. **`supabase/functions/iptv-login/index.ts` — `tryVariant`**
   - Quando `auth=1` mas `active_cons >= max_connections`, **não retornar mais erro 429**.
   - Em vez disso, retornar `ok: true` com a flag `data.at_connection_limit = true`.
   - O usuário entra normalmente, sincroniza catálogo, navega — só quando tentar abrir um stream o erro de limite vai aparecer (e já temos mensagem amigável pra isso).

2. **`src/services/iptv.ts` — `iptvLogin` / `iptvLoginM3u`**
   - Propagar `at_connection_limit` no objeto retornado para o componente Login ler.

3. **`src/pages/Login.tsx`**
   - Após login com sucesso, se `at_connection_limit === true`, mostrar um toast de aviso (não bloqueante): *"Você está logado, mas a conta está com todas as telas em uso (2/2). Aguarde alguns minutos ou feche outras conexões antes de abrir um canal."*
   - Continuar o fluxo normal (`navigate("/sync")`).

## O que NÃO muda

- Credenciais erradas (`auth=0`) continuam bloqueando como hoje.
- Mensagem de `MAX_CONNECTIONS` ao tentar tocar um stream continua a mesma — só não bloqueia mais o login.
- Outros painéis sem o problema continuam idênticos.

## Resultado esperado

Você consegue logar com `maxtv.uk`, ver um aviso de "telas em uso", navegar pelo app, e tentar reproduzir depois que o painel limpar as conexões fantasmas.