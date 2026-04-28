Plano para tratar melhor este caso de HTTP 404 no login M3U

O fallback anterior já está sendo chamado, mas os logs mostram que ele também falhou:

```text
m3u_register PLAYLIST_FALLBACK_FAIL after=404 server=http://anverif.top reason=playlist-fallback-failed
m3u_register FAIL host=http://anverif.top reason=HTTP 404 status=404 ct=null preview=
```

Isso significa que o backend tentou `/player_api.php` e depois `/get.php`, mas não encontrou uma playlist M3U válida nesse host base. Vou melhorar o fluxo para diagnosticar e cobrir mais variantes reais de painéis IPTV.

Implementação proposta

1. Melhorar o fallback de playlist no `iptv-login`
   - Fazer `tryPlaylistFallback` retornar detalhes da melhor falha encontrada: status HTTP, content-type, variante testada e prévia do corpo.
   - Testar variações adicionais comuns do endpoint de playlist:
     - `/get.php?username=...&password=...&type=m3u_plus&output=ts`
     - `/get.php?username=...&password=...&type=m3u_plus`
     - `/get.php?username=...&password=...&type=m3u`
     - `/playlist/{username}/{password}/m3u_plus`
   - Continuar aceitando sucesso somente quando a resposta for uma playlist real (`#EXTM3U`), para não auto-cadastrar DNS inválida.

2. Preservar o erro do fallback no retorno técnico
   - Quando `/player_api.php` retornar 404 e o fallback também falhar, devolver no `debug` também um campo como `playlistFallback` contendo:
     - endpoint/variante tentada
     - status retornado
     - content-type
     - motivo da falha
     - bodyPreview
   - Assim, o botão “Copiar detalhes” mostrará se o `/get.php` também está dando 404, 403, HTML, vazio etc.

3. Melhorar a mensagem para o usuário/admin
   - Se tanto `player_api.php` quanto `get.php`/`playlist/...` derem 404 vazio, manter como `SERVER_UNREACHABLE`, mas com mensagem mais direta:
     - “A DNS respondeu, mas não possui endpoints Xtream/M3U válidos nesse endereço. Verifique se a URL M3U completa está atualizada ou se há porta/caminho específico.”
   - Isso evita parecer erro genérico quando, na prática, o domínio `http://anverif.top` sozinho não expõe os endpoints esperados.

4. Validar que o auto-cadastro continua seguro
   - Auto-cadastrar em `allowed_servers` apenas se:
     - Xtream API autenticar com `auth=1`, ou
     - fallback retornar playlist real iniciando com `#EXTM3U`.
   - Não cadastrar quando houver 404 vazio, HTML, erro de bloqueio ou resposta sem playlist.

Arquivos envolvidos

- `supabase/functions/iptv-login/index.ts`
  - Ajustar `tryPlaylistFallback`, retorno de erro e `debug` no modo `m3u_register`.

Observação importante

Se `anverif.top` realmente não tiver `/player_api.php`, `/get.php` nem `/playlist/...` disponíveis na porta informada, o login ainda vai falhar corretamente. A correção vai garantir que o sistema tente os formatos mais comuns e retorne um diagnóstico preciso para saber se falta porta, caminho específico, DNS atualizada ou se o provedor bloqueia o acesso pelo backend.