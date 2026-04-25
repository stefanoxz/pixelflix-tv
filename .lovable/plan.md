## Resposta curta

Hoje **não**. Quando um episódio termina em Séries, o player apenas para no último frame e o usuário precisa fechar o player e escolher o próximo episódio manualmente na lista. Vou adicionar **autoplay do próximo episódio**, no estilo Netflix/Prime, mantendo a identidade visual do PixelFlix.

---

## O que será implementado

### 1. Detecção de "próximo episódio"
Em `src/pages/Series.tsx`, ao tocar um episódio, hoje guardamos só `{ ep, coverFallback }`. Vou expandir para guardar também:
- `seriesId` da série atual
- `season` e `episodeIndex` do episódio em reprodução
- A lista ordenada de episódios da temporada (vinda de `getSeriesInfo`)

Com isso é possível calcular o "próximo episódio":
1. Próximo episódio da **mesma temporada**, se existir.
2. Caso seja o último, primeiro episódio da **próxima temporada** (se houver).
3. Se não houver próximo, mostra apenas "Fim da série" (sem countdown).

### 2. Card "Próximo episódio" sobreposto ao Player
Um overlay leve no canto inferior direito do `PlayerOverlay` (estilo Netflix), com:
- Miniatura do próximo episódio (ou capa da série como fallback)
- Título da temporada/episódio (ex: `T2 • E5 — Nome do episódio`)
- Contagem regressiva (10s) com barra de progresso usando `bg-gradient-primary`
- Botão **"Próximo episódio"** (toca imediatamente)
- Botão **"Cancelar"** (mantém o vídeo no fim, sem pular)

Aparece automaticamente quando:
- O vídeo dispara o evento `ended`, **ou**
- Faltam menos de ~20s para o fim (mostra antecipadamente, igual Netflix). Esse threshold fica configurável; começo só com `ended` para evitar interferir em créditos curtos, e adiciono o "antecipado" como segunda fase se você preferir.

Se o usuário não interagir, ao zerar a contagem o próximo episódio começa a tocar **dentro do mesmo `PlayerOverlay`** (sem fechar/reabrir, sem flicker).

### 3. Continuidade sem fechar o player
A troca de episódio acontece atualizando o estado `playingEp` em `Series.tsx` para o próximo episódio. O `Player` re-monta com a nova `src` (ele já lida com troca de URL), e o `SeriesDetailsDialog` permanece aberto por baixo, igual hoje.

### 4. Toggle "Reprodução automática"
Pequeno switch dentro do card de "Próximo episódio" ("Autoplay: ligado/desligado"), persistido em `localStorage` (`pixelflix:series:autoplay`, default `true`). Se desligado, o card de próximo episódio ainda aparece ao final, mas **sem** countdown — só com o botão "Próximo episódio".

---

## Detalhes técnicos

**Arquivos a alterar:**

- `src/components/Player.tsx`
  - Adicionar prop opcional `onEnded?: () => void` e prop `onTimeRemaining?: (secondsLeft: number) => void` (usada para a fase futura de antecipação).
  - Conectar `video.addEventListener('ended', ...)` chamando `onEnded`.

- `src/pages/Series.tsx`
  - Trocar o estado `playingEp` para incluir contexto: `{ ep, season, indexInSeason, seriesId, coverFallback }`.
  - Carregar `getSeriesInfo` (já cacheado via React Query) para obter a lista de temporadas/episódios e calcular `nextEpisode` com `useMemo`.
  - Passar `onEnded` ao `Player` que aciona o card de próximo episódio.

- `src/components/PlayerOverlay.tsx` (ou um novo `src/components/series/NextEpisodeCard.tsx`)
  - Novo componente `NextEpisodeCard` com:
    - Layout em card (`rounded-2xl`, `bg-card/85`, `backdrop-blur-md`, `border-border/60`)
    - Thumb 16:9 do próximo episódio (`info.movie_image` com fallback para `series.cover` via `proxyImageUrl`)
    - Botões: "Próximo episódio" (primário com `bg-gradient-primary`) e "Cancelar" (ghost)
    - Barra de progresso animada via `requestAnimationFrame` (10s)
  - Renderizado condicionalmente sobre o `Player` quando `showNextCard === true`.

- `src/hooks/useAutoplayPreference.ts` (novo, pequeno)
  - Lê/escreve `pixelflix:series:autoplay` em `localStorage`.

**Não muda:** `MovieDetailsDialog` (filmes não têm "próximo"), lógica de favoritos, proxy de imagens, navegação por teclado.

**Acessibilidade:** o card é focável; `Enter` toca o próximo, `Esc` cancela. Em mobile, ocupa rodapé inteiro com botões maiores.

---

## Fora do escopo (posso fazer depois se quiser)

- Pular abertura/encerramento (intro/outro skip) — exige marcação manual ou heurística.
- Mostrar o card **antes** do fim (aos 20s restantes) — fácil de adicionar depois, fica como fase 2.
- Sincronizar autoplay com "continue assistindo" no histórico.