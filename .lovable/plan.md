## Problema

DNS `http://maxtv.uk` funciona em outro webplayer mas falha no nosso ao logar via URL M3U (`/get.php?username=…&password=…`). O log do edge function mostra que `maxtv.uk` responde HTTP 200 a `/player_api.php` — ou seja, transporte e DNS estão OK. A falha é no **conteúdo da resposta**: provavelmente `auth=0`, body não-JSON (HTML/playlist) ou `user_info` ausente.

Hoje, quando isso acontece, devolvemos `INVALID_CREDENTIALS` sem nenhuma pista, e nem registramos o que o servidor de fato mandou — então não dá para diagnosticar pelo console do usuário.

## O que vamos fazer

1. **Diagnóstico completo no `iptv-login` (mode `m3u_register`)**
   - Quando `tryVariant` falhar com "resposta não JSON" ou "credenciais inválidas", anexar à resposta de erro um campo `debug` com:
     - `usedVariant` testado
     - `httpStatus` recebido
     - `bodyPreview` (primeiros 300 chars, sanitizado)
     - `contentType` do response
     - `looksLikeM3u` (boolean: começa com `#EXTM3U`)
     - `looksLikeHtml` (boolean)
   - Esse `debug` só aparece em erro — em sucesso não muda nada.
   - Logar no servidor `[iptv-login] m3u_register FAIL host=maxtv.uk reason=… preview=…` para inspecionarmos via edge logs.

2. **Fallback automático: se `/player_api.php` responde mas não é JSON Xtream válido, tentar `/get.php?...&type=m3u_plus`**
   - Se body parece M3U (`#EXTM3U`), tratar como **playlist mode**: extrair o servidor base e creds da própria URL e considerar login bem-sucedido com um `user_info` sintético `{ auth: 1, status: "Active", message: "playlist-mode" }`.
   - Isso resolve painéis que só servem playlist e não implementam Xtream API JSON — que é exatamente o sintoma que o `maxtv.uk` parece ter.

3. **UA mais "TV-like" como fallback adicional**
   - Adicionar `VLC/3.0.20 LibVLC/3.0.20` e `Lavf/58.76.100` à lista de `FALLBACK_UAS` (alguns painéis bloqueiam navegadores e só liberam para players).

4. **Mensagem de erro acionável no Login**
   - No `src/pages/Login.tsx`, quando o backend devolver `debug`, mostrar um toast detalhado (em modo desenvolvedor / botão "ver detalhes técnicos") com `httpStatus`, `contentType`, `bodyPreview` — assim você não precisa mais me mandar código de outro player, basta mandar o preview.

5. **Documentação inline**
   - Comentar no `iptv-login/index.ts` o motivo do playlist-mode fallback, para não quebrar com um futuro refactor.

## Arquivos afetados

- `supabase/functions/iptv-login/index.ts` — adicionar `debug` em erros, fallback playlist-mode no `m3u_register`, novos UAs.
- `src/pages/Login.tsx` — exibir `debug.bodyPreview` e `debug.httpStatus` em caso de falha.
- (opcional) `src/lib/parseM3uUrl.ts` — só se o preview real do `maxtv.uk` mostrar um formato de URL que ainda não cobrimos.

## Riscos / o que NÃO muda

- Não mexemos em nenhuma outra DNS que já funciona.
- Não relaxamos validação de credenciais reais (`auth=0` continua falhando) — só passamos a aceitar **respostas M3U válidas** como prova de credencial OK.
- Não tocamos no player de vídeo (hls.js) — esse problema é só de login.

## Próximo passo após implementar

Você tenta logar de novo com `maxtv.uk`. Se ainda falhar, o toast vai mostrar exatamente o que o servidor respondeu, e a partir daí eu ajusto o parser específico para esse painel.