## Diagnóstico

O erro indica que o login via URL M3U chegou até a função de login, mas o servidor extraído da URL (`http://anverif.top`) respondeu **HTTP 404** no endpoint Xtream testado (`/player_api.php`). Hoje o fluxo trata esse 404 como falha definitiva e para imediatamente.

Em painéis IPTV, isso pode acontecer por dois motivos comuns:

1. A DNS existe, mas o Xtream API não está disponível exatamente na variante testada.
2. A URL M3U funciona em `/get.php?...type=m3u_plus`, mesmo quando `/player_api.php` retorna 404.

## Plano de correção

1. **Ampliar o fallback do login M3U**
   - No `m3u_register`, quando o `/player_api.php` retornar `404`, tentar também o fallback de playlist em `/get.php?username=...&password=...&type=m3u_plus&output=ts`.
   - Hoje esse fallback só roda para `200 não JSON` ou `401`; será expandido para `404`.

2. **Melhorar classificação do erro 404 vazio**
   - Mapear `HTTP 404` sem corpo como `SERVER_UNREACHABLE` com mensagem mais clara: DNS/endpoint não parece ser um painel Xtream válido ou está desatualizado.
   - Manter os detalhes técnicos no toast para diagnóstico.

3. **Preservar segurança do auto-cadastro**
   - A DNS só será auto-cadastrada se um dos testes autenticar de verdade:
     - `player_api.php` retornar `user_info.auth=1`, ou
     - `get.php` retornar uma playlist válida começando com `#EXTM3U`.
   - Um 404 sozinho nunca cadastra a DNS.

4. **Atualizar logs para facilitar suporte**
   - Registrar no log quando o fallback de playlist foi tentado após 404.
   - Isso diferencia “DNS offline/desatualizada” de “painel sem Xtream API mas playlist válida”.

## Arquivos a alterar

- `supabase/functions/iptv-login/index.ts`

## Resultado esperado

- Se a URL M3U for válida mas o painel não responder em `/player_api.php`, o app ainda tenta `/get.php` antes de falhar.
- Se `anverif.top` realmente estiver retornando 404 também no M3U, o usuário verá um erro mais claro indicando DNS/endpoint inválido ou desatualizado.