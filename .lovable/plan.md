# Auto-recuperação silenciosa para streams MP4 progressivos

## Contexto (do log que você colou)

O servidor `tzprosata.fun` cortou a conexão TCP do MP4 progressivo aos **7min38s de reprodução** (posição 1023.5s do filme). O app esperou 20s, marcou `stall_timeout` e mostrou erro genérico `MEDIA_ERR_2`. Não é bug do app — é comportamento conhecido de servidores Xtream com VOD progressivo (timeout de socket por sessão longa).

Conserto: o player retoma sozinho do mesmo ponto, sem o usuário ver erro. Se falhar 2 vezes, aí sim mostra mensagem clara com botão "Retomar".

## O que muda

**Apenas `src/components/Player.tsx`.** Sem migração, sem novos arquivos, sem mexer em backend/edge functions.

### 1. Detector de stream "frágil"

Computar uma flag local:
```
isProgressive = engine !== 'hls' real (m3u8) 
              || ext ∈ {mp4, mkv, avi, mov, webm}
```
Streams HLS segmentados já têm recuperação nativa do hls.js; só MP4 progressivo precisa do novo fluxo.

### 2. Auto-recuperação (sem mostrar erro)

Adicionar `recoveryAttemptsRef` (max 2 por sessão). Disparada quando:
- `stall_timeout` ocorre **e** `isProgressive` **e** `recoveryAttempts < 2`, OU
- `onError` com `MEDIA_ERR_2 / PIPELINE_ERROR_READ` **e** `isProgressive` **e** `recoveryAttempts < 2`.

Sequência:
1. Salvar `video.currentTime` (ou `lastResumePosition` se `currentTime=0`).
2. `recoveryAttempts++`, log `recovery_attempt`.
3. Toast discreto: `toast("Reconectando…")` (sonner, sem ícone de erro).
4. Bumpar `retryNonce` (já existe, força re-setup do `<video>` com novo token).
5. No próximo `loadedmetadata`, `seek(savedTime - 2)` + `play()`.
6. **Não** chamar `setError()` — overlay de erro permanece oculto.

### 3. Reset do contador

Zerar `recoveryAttempts`:
- Quando `src` muda (novo conteúdo).
- Quando vídeo passa **30s contínuos** em estado `playing` sem erro novo (timer rearmado a cada `playing`/`timeupdate`, cancelado em `waiting`/`error`).

### 4. Fallback amigável (depois de 2 falhas)

Se `recoveryAttempts >= 2` quando der nova falha, em vez do texto genérico atual mostrar:

- **Título:** "Conexão com o servidor encerrada"
- **Descrição:** "O servidor de streaming pausou a transmissão deste arquivo. Você pode retomar de onde parou."
- **Botão primário (novo):** **Retomar de onde parou** — zera `recoveryAttempts`, salva posição, bump `retryNonce`, fecha overlay.
- **Botão secundário:** Voltar (`onClose`, já existe).
- Mantém botões existentes (Copiar URL, etc.) para casos avançados.

Só aplica essa mensagem específica quando `isProgressive && reason começa com MEDIA_ERR_2`. Outros erros (codec, 404, etc.) mantêm os textos atuais.

## Pontos exatos no `Player.tsx`

| Local atual | Mudança |
|---|---|
| Lá perto da linha 1430, antes do `useEffect` dos listeners | Declarar `recoveryAttemptsRef`, `isProgressiveRef`, `playingStableTimerRef` |
| Linhas 1448–1488 (`onWaiting`/`onStalled` setTimeouts) | Antes de chamar `updateStatus("stall_timeout")`, checar se cabe auto-recovery; se sim, disparar fluxo silencioso e **não** chamar `updateStatus` |
| Linhas 1490–1510 (`onPlaying`) | Iniciar/rearmar timer de 30s estáveis para resetar `recoveryAttemptsRef` |
| Linhas 1532–1553 (`onError`) | Antes de `setError(...)`, checar auto-recovery; se cabe, disparar fluxo silencioso e retornar. Se já estourou tentativas e é `isProgressive`, usar texto novo + botão "Retomar" |
| Bloco do overlay de erro (lá pelas linhas 1870+) | Renderizar botão extra "Retomar de onde parou" quando `error.canResume === true` |

## O que NÃO vai mudar

- Lógica de token / edge functions.
- Comportamento para streams HLS reais (`.m3u8` segmentado) — já têm recuperação.
- Comportamento para erros de codec (`MEDIA_ERR_3/4`) — segue indo direto pro fluxo "Abrir no VLC".
- QualityBadge, layout, controles — nada disso é tocado.

## Resultado esperado

Cenário do seu log, depois da mudança:
1. Aos 7min38s o servidor corta. App detecta stall.
2. Toast "Reconectando…" aparece por ~2s.
3. Player recria source, retoma em 1021.5s, volta a tocar.
4. Usuário não vê tela de erro.
5. Se o servidor estiver realmente fora do ar e a 2ª tentativa também falhar, aí mostra "Conexão encerrada" com botão "Retomar de onde parou" — clique único resolve.

## Arquivos

- Editar: `src/components/Player.tsx`

