## Problema diagnosticado

O log enviado mostra a sequência exata de falha de um canal específico (id 837241):

```
setup_start         t=0
token_ok            t=333ms   (mode=stream, proxy de bytes ativo)
media_attached      t=336ms
manifestLoadError   t=8.3s    fatal=true http=502
hls_network_recover t=8.3s    1/10 in 1200ms
bootstrap_timeout   t=12.0s   "Canal não respondeu"
```

O que aconteceu: o `stream-proxy` chamou o servidor IPTV pra buscar o `.m3u8` desse canal e levou 502 — ou o upstream caiu, ou devolveu HTML de erro em vez de m3u8 válido (o proxy responde 502 nesses dois casos). hls.js tentou um único `startLoad()` em 1200 ms, falhou de novo, e o watchdog de 12 s então mostra erro genérico "Canal não respondeu" sugerindo VLC.

Outros canais na mesma sessão (Telecine, ESPN, GOAT, Disney+) abriram normalmente — então não é problema de credencial nem de rede do usuário; é especificamente esse canal indisponível ou bloqueando o IP do edge no `.m3u8`.

## Por que o sistema atual não recupera

O auto-switch HLS → mpegts já existe no `Player.tsx` (`tryActivateProxyAndRestart`), mas só dispara quando:

- a rota de `fragLoadError` acumula N erros, **ou**
- o watchdog de 6 s de "loadeddata" não viu frames

Quando o erro é `manifestLoadError` http=502 logo no primeiro request da playlist, **nenhuma das duas condições é satisfeita** porque o manifest nunca chegou (`manifestReadyRef = false`). O código cai direto na rotina de network recovery do hls.js (1 retry), depois espera os 12 s do bootstrap, e desiste.

Mpegts pode salvar esse caso porque carrega o `.ts` direto (sem buscar manifest), e em alguns servidores Xtream o endpoint `.ts` continua respondendo mesmo quando o `.m3u8` quebra.

## Mudanças

### `src/components/Player.tsx`

1. **Roteamento novo no handler de erro do hls.js**: dentro do listener `Hls.Events.ERROR`, ao receber `MANIFEST_LOAD_ERROR` ou `MANIFEST_LOAD_TIMEOUT` com `fatal=true`, chamar `tryActivateProxyAndRestart("manifestLoadError http=<status>")` antes da rotina de retry de network. Como na primeira chamada `engineAutoSwitchedRef.current` é falso e o canal é ao vivo (Xtream `/live/...`), isso vai trocar o engine pra mpegts e reiniciar o player imediatamente, sem esperar os 12 s.

2. **Faixa de canais fora de Xtream live**: se a URL não bater `isLiveXtreamUrl`, mpegts não funciona (não dá pra trocar `.m3u8` → `.ts`). Nesse caso o switch automático não acontece e mantemos o comportamento atual (network recovery + bootstrap timeout). O `tryActivateProxyAndRestart` já checa `isLive && engine === "hls"`, então naturalmente vira no-op pra séries/filmes/HLS não-Xtream.

3. **Mensagem final mais útil quando mpegts também falha**: quando o caminho mpegts atinge seu próprio `MPEGTS_BOOTSTRAP_TIMEOUT_MS` (8 s) sem frames depois do switch, alterar o título do erro de "Canal não respondeu" para "Canal indisponível no momento" e a descrição para "Esse canal não está transmitindo agora. Tente outro canal." (mantendo o botão de copiar URL e abrir externo).

4. **Logging**: garantir que o evento `engine_auto_switch` registrado já existente capture `reason="manifestLoadError http=502"` no payload de telemetria, pra ficar visível no painel de admin que esse caminho foi acionado.

## Resultado esperado

- Canal com 502 no manifest: em ~8 s o player tenta mpegts. Se o `.ts` direto funcionar, vídeo abre normalmente. Se também falhar, em mais 8 s aparece mensagem clara "Canal indisponível, tente outro" — total ~16 s no pior caso, em vez de 12 s pra mensagem confusa de VLC.
- Canais que já funcionavam: nenhuma mudança de comportamento (o caminho de switch só dispara em erro fatal de manifest).
- Outros tipos de erro (codec, fragLoadError, no_loadeddata): continuam usando a lógica atual sem regressão.

## Não muda

- `stream-proxy` / `stream-token` / autenticação IPTV / banco — nada do backend é tocado.
- Player de filmes e séries — só canais ao vivo Xtream pegam o auto-switch.
- Persistência de preferência de engine por host: mantida (`setPreferredEngine` continua sendo chamado via `tryActivateProxyAndRestart`).
