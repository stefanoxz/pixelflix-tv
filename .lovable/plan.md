

## Relatório — Por que os canais ao vivo ficam em "Conectando…"

### O que está acontecendo (evidências dos logs)

Olhei os eventos do backend nos últimos minutos. **O backend está funcionando**:

1. `iptv-login` retorna 200 com credenciais válidas.
2. `stream-token` emite tokens (`token_issued`, `kind: playlist`) em sequência para vários canais.
3. `stream-proxy` baixa a playlist do servidor IPTV (~1.7s), reescreve as URLs dos segmentos e devolve 200.
4. O `<video>` chega a pedir os segmentos `.ts` — vejo dezenas de 302 voltando do proxy.
5. Para cada canal aberto, há `stream_started` registrado em `stream_events`.

Ou seja: o token é assinado, a playlist chega, os segmentos chegam — e mesmo assim a tela fica em "Conectando…" para sempre.

### Causa raiz

O problema é uma **combinação de 4 fatores no Player**, não um único bug:

**1. Spinner que nunca apaga (o sintoma principal)**
O `<video>` tem listeners `waiting` e `stalled` que fazem `setLoading(true)`. Quando o canal é HEVC/4K (ou qualquer codec que o Chrome não decodifica), o vídeo entra em `stalled` permanente — o spinner é re-ligado a cada evento e nunca é resolvido por `playing`/`canplay` (que nunca chega). Resultado: "Conectando…" eterno, sem erro visível.

**2. Erros do `<video>` engolidos**
O handler `onError` só atualiza estado se `prev` for `null`. Em qualquer fluxo onde o erro do hls.js limpou o estado primeiro (ou onde `<video>` falha por codec sem fatal HLS), o usuário não vê mensagem de erro — só o spinner.

**3. Sessão única bloqueando trocas**
O `stream-token` força `MAX_SESSIONS = 1` por conta IPTV. Quando o usuário abandona um canal e tenta outro, a sessão antiga (marcada como `last_seen_at` recente via heartbeat) ainda conta, e o novo canal disputa. Isso causa atrasos e, em casos de zapping, evicção do próprio usuário.

**4. Nonce single-use em segmentos `.ts`**
Cada segmento `.ts` carrega um nonce que é gravado em `used_nonces` na primeira requisição. O `hls.js` (e o próprio Chrome) ocasionalmente re-pede o mesmo segmento (recovery, seek, buffer flush) — a segunda requisição é rejeitada com `nonce_replay` e vira erro fatal. Em canais com latência variável, isso é fácil de acionar.

### Por que parece "fica só carregando"

Mesmo quando o stream **está chegando**, o `<video>` para de tocar por codec incompatível (4K/HEVC) ou por replay de nonce, entra em loop de `stalled`/`waiting`, e o spinner re-acende. Sem mensagem, sem botão, sem feedback — só o "Conectando…".

---

## Plano de correção

### Frontend — `src/components/Player.tsx`

1. **Estabilizar o spinner**: separar "carregando inicial" de "buffer momentâneo". Após `MANIFEST_PARSED` ou primeiro `playing`, marcar o player como "engajado" e ignorar `stalled`/`waiting` para o spinner principal — usar um indicador discreto secundário (ou nada). Se ficar `stalled` por mais de 8s sem progresso, mostrar erro real.

2. **Detector de stall com timeout**: timer de 12s a partir do setup. Se o `<video>` não emitir `playing` ou `loadeddata` nesse período, mostrar erro claro: "Canal não respondeu — pode ser 4K/HEVC incompatível com o navegador. Copie o link e abra no VLC."

3. **Sempre exibir erro do `<video>`**: remover o `prev ? prev : ...` — qualquer erro do elemento sobrescreve, com mensagem clara e botão de retry/copiar.

4. **Detectar codec não suportado**: se `videoElement.error.code === MEDIA_ERR_SRC_NOT_SUPPORTED` (3) ou `MEDIA_ERR_DECODE` (4), mensagem específica sobre 4K/HEVC e oferecer "Abrir no VLC" como ação primária.

5. **Reduzir debounce de troca para 120ms** (de 250ms): o atual atrasa demais o feedback inicial sem ganho real.

### Backend — `supabase/functions/stream-token/index.ts`

6. **Aumentar `MAX_SESSIONS` para 2**: dá margem para troca de canal (a sessão antiga expira em 90s naturalmente). Hoje em 1, qualquer troca vira disputa.

7. **Janela de "graça" para troca de canal**: ao receber novo token do mesmo `userId`, atualizar `last_seen_at` e **não contar** como sessão concorrente.

### Backend — `supabase/functions/stream-proxy/index.ts`

8. **Tolerar replay de nonce**: em vez de rejeitar com 403 quando o nonce já existe, permitir o redirect 302 normalmente se o nonce foi usado nos últimos 10 segundos pelo mesmo `userId`/`ipPrefix`/`uaHash` do payload. Bloqueio efetivo só para nonces antigos ou de outra origem. Isso elimina o problema de re-fetch legítimo do hls.js sem abrir brecha de compartilhamento.

### Migração SQL

9. Adicionar índice em `used_nonces(used_at)` para o cleanup ficar barato e a verificação de "10s atrás" ser instantânea.

### Validação

- Após deploy: testar abrindo um canal HD comum (espera-se: imagem em <5s) e um canal 4K (espera-se: erro claro com opção VLC, não spinner eterno).
- Testar zapping: trocar 3 canais em 5s (espera-se: o último abre normalmente, sem ficar travado).
- Inspecionar `stream_events` por `nonce_replay` (espera-se: ausente ou raro) e `session_evicted` (espera-se: ausente).

### Arquivos tocados

- `src/components/Player.tsx` — spinner, timeout de stall, erros visíveis, detecção de codec, debounce 120ms
- `supabase/functions/stream-token/index.ts` — `MAX_SESSIONS = 2`, graça para troca
- `supabase/functions/stream-proxy/index.ts` — janela de tolerância para replay de nonce
- Nova migração SQL — índice em `used_nonces(used_at)`

### Sem mudanças em

- Fila global, telemetria, histerese adaptativa, lógica de login, `iptv-categories`, frontend fora do Player.

