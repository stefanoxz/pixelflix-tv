
## Resumo

Quatro entregas combinadas:
1. **Correção de bugs** do sistema de progresso atual (race do player, re-render da grid, teardown).
2. **Prateleira "Continue assistindo"** no Highlights.
3. **Barra de progresso nos cards de séries** (refletindo o último episódio assistido).
4. **Sincronização entre dispositivos** usando o usuário IPTV como chave (modelo "perfil compartilhado por linha").

---

## Aviso sobre a sincronização escolhida

Você escolheu sincronizar usando o **username IPTV** como chave (sem login adicional). Quero ser transparente sobre o que isso significa antes de executar:

- O progresso fica numa tabela pública chaveada por `(server_url, username)`.
- **Qualquer pessoa que tenha o mesmo username/servidor IPTV vê e sobrescreve o seu progresso**, porque o app não tem como provar quem é quem.
- Pessoas que compartilham a mesma linha IPTV (comum em revendas) verão o progresso uma da outra — funciona como um "perfil único compartilhado".
- A tabela terá RLS aberta para leitura/escrita anônima (sem isso a sync não funciona).

Se em algum momento você quiser isolar progresso por pessoa, será necessário adicionar autenticação real (email ou Google). Pode ser feito depois sem perder os dados.

Vou seguir com essa abordagem se você aprovar este plano.

---

## 1. Backend (Lovable Cloud)

Tabela nova `watch_progress`:

```text
server_url   text       (normalizado: lower + sem barra final)
username     text       (do Xtream IPTV)
item_key     text       ("movie:123" ou "episode:456")
kind         text       ("movie" | "episode")
content_id   text       (id do filme/episódio)
series_id    bigint?    (só para episódios — usado pelo card da série)
title        text?      (para o rail mostrar nome sem chamar o catálogo)
poster_url   text?      (idem)
position_seconds  int   (current time)
duration_seconds  int   (total)
updated_at   timestamptz
PRIMARY KEY (server_url, username, item_key)
```

- RLS habilitada com policies anônimas para SELECT/INSERT/UPDATE/DELETE filtrando por `(server_url, username)` — não há `auth.uid()` para usar.
- Índice em `(server_url, username, updated_at DESC)` para o rail.

## 2. Hook `useWatchProgress` — refator

Vira **híbrido local + remoto** com merge "último write vence":

- Escrita: grava local imediatamente + faz `upsert` no Supabase (debounced 5s, e flush no `pause`/`unmount`).
- Leitura inicial: faz um `SELECT` único ao montar; merge entrada a entrada comparando `updatedAt` — vence o mais recente, escreve local e remoto.
- Realtime opcional via canal Supabase filtrado por `(server_url, username)` para refletir progresso de outro dispositivo enquanto a aba está aberta.
- Mantém o cache local como fonte de verdade durante a sessão (offline-first); a rede só sincroniza.
- Estende `ProgressEntry` com `seriesId?`, `title?`, `poster?` para alimentar o rail e o card de série sem pedir info do catálogo.

## 3. Correções de bugs

**Player (`src/components/Player.tsx`)**
- Disparar o seek inicial também quando `video.readyState >= 1` (metadata já em cache, evento não vai mais ser emitido).
- `unmountedRef` nos listeners de `pause`/`timeupdate` para não gravar `currentTime=0` quando o overlay fecha.
- Garantir cleanup do throttle ao trocar de `src`.

**Grids (`Movies.tsx` / `Series.tsx`)**
- "Congelar" o snapshot de progresso enquanto o player está ativo (`playingMovie`/`playingEp`), para o re-render a cada 5s não percorrer a grade inteira.
- Mover a injeção de `progressPct` para um componente leve interno que assina só os IDs visíveis, evitando re-render do `PosterGrid` pai.

**ResumeDialog**
- Já existe; só mudar para também aceitar `subtitle` (ex.: "S02E05 — Título") quando vier de série.

## 4. Barra de progresso em séries (último episódio)

- Como progresso é por episódio, derivar uma vista por série: para cada série, pegar `max(updatedAt)` dentre as entradas `kind=episode` cujo `seriesId === series.series_id` e usar o `position/duration` daquela entrada como `progressPct` no card.
- Computado uma vez via `useMemo` sobre `listInProgress()`, indexado por `seriesId`, custo O(n) sobre o nº de itens em progresso (≤200).
- Card mostra a mesma barra fina já implementada no PosterCard — sem mudança visual nova.

## 5. Rail "Continue assistindo" no Highlights

Componente novo `src/components/highlights/ContinueWatchingRail.tsx`:

- Fonte de dados: `listInProgress()` do hook (já vem ordenado por `updatedAt desc`).
- Mostra até **12 itens**, mistura filmes e episódios.
- Cada card: poster (do `poster` salvo na entrada), título, badge de tempo restante (`formatProgressTime(d - t) + " restantes"`), barra fina de progresso embaixo.
- Para episódios, mostra "S0xE0y — Nome da série" como subtítulo quando os campos estiverem disponíveis.
- Click:
  - Filme → navega para `/movies` com `state: { openId, autoplay: true }`.
  - Episódio → navega para `/series` com `state: { openId: seriesId, episodeId, autoplay: true }`.
- `Movies.tsx`/`Series.tsx` ganham handler para `state.autoplay`: ao abrir via deep-link, **pular o details dialog** e disparar direto o `ResumeDialog` (ou tocar de imediato).
- Botão "X" em cada card para remover a entrada (chama `clearProgress`).
- Renderizado no topo do Highlights, **acima** das outras prateleiras, com fade-in suave; some quando a lista está vazia.

## 6. Arquivos afetados

**Novos**
- `supabase/migrations/...watch_progress.sql`
- `src/components/highlights/ContinueWatchingRail.tsx`

**Modificados**
- `src/hooks/useWatchProgress.ts` — sync remoto, novos campos, merge.
- `src/components/Player.tsx` — fix de seek inicial e teardown.
- `src/components/ResumeDialog.tsx` — subtítulo opcional.
- `src/pages/Highlights.tsx` — incluir o rail.
- `src/pages/Movies.tsx` — freeze durante playback, autoplay via state.
- `src/pages/Series.tsx` — freeze durante playback, autoplay via state, derivação de progresso por série para os cards.

## 7. O que continua igual

- Login IPTV permanece como está (sem cadastro novo).
- Favoritos seguem locais (sem sync remoto).
- Limites: 30s para começar a salvar, 95% para considerar concluído, LRU 200 entradas.
