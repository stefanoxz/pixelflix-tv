# Paginação incremental na grade virtualizada

## Contexto importante

A API Xtream (`get_vod_streams`, `get_series`, `get_live_streams`) **não suporta paginação server-side** — ela retorna o catálogo inteiro num único JSON. Isso já é cacheado pelo React Query e usado para alimentar busca, filtros por categoria, favoritos e "Lançamentos" (que precisa do dataset completo pra ordenar por `added`).

Portanto, "carregar sob demanda" aqui significa **paginação incremental no client**: o array filtrado completo fica disponível para lógica (busca/filtro), mas a `PosterGrid` só **expõe** N itens por vez à virtualização, revelando os próximos chunks conforme o usuário rola.

Benefício real: menos linhas calculadas pelo `useVirtualizer`, menos ranges medidos, menos imagens enfileiradas para download de uma vez (o `<img loading="lazy">` já evita fetch fora-de-tela, mas o browser ainda processa milhares de elementos virtuais — agora processa só o "revelado").

## O que muda

### 1. `PosterGrid.tsx` — janela incremental

- Nova prop opcional `pageSize` (default `120`) e `pageIncrement` (default `60`).
- Estado interno `visibleCount` reseta para `pageSize` sempre que `items` mudar de identidade (nova busca, nova categoria).
- A virtualização passa a operar sobre `items.slice(0, visibleCount)` em vez de `items` direto.
- Ao final da grade renderizamos uma **linha sentinela** (`<div ref={sentinelRef}>`) observada por `IntersectionObserver` com `rootMargin: "600px"` (pré-carrega antes de chegar no fim). Quando entra em view e ainda há itens, faz `setVisibleCount(c => Math.min(c + pageIncrement, items.length))`.
- Fallback: se o usuário usar `Ctrl+End` / navegação por teclado para um `activeId` que está além do `visibleCount`, expandimos a janela até cobrir aquele índice antes do `scrollToIndex`.
- Indicador visual discreto abaixo da grade: "Mostrando X de Y" + spinner enquanto há mais para revelar (substitui/complementa o `totalLabel` do topo).

### 2. `Movies.tsx`, `Series.tsx`

- Nenhuma mudança de lógica de dados — continuam passando o array filtrado inteiro para `PosterGrid`. A paginação fica encapsulada no componente da grade, então as duas páginas ganham o comportamento de graça.
- Para "Lançamentos" (que já faz `.slice(0, 60)`), a paginação simplesmente não dispara (cabe na primeira página).

### 3. `Live.tsx` / `VirtualChannelList.tsx`

- **Fora do escopo deste plano.** Lista de canais é unidimensional, mais leve por item, e a UX de TV ao vivo espera a lista inteira disponível para zapping rápido por categoria. Posso fazer num passo separado se quiser.

## Detalhes técnicos

- O reset de `visibleCount` usa `useEffect` com dependência `items` (referência). Como `Movies`/`Series` já memoizam `items` via `useMemo`, mudar busca/categoria gera nova referência → reset automático para o topo, comportamento esperado.
- O `IntersectionObserver` é criado uma vez (`useEffect` com `[]`) e re-observa quando o `sentinelRef` muda. Como o sentinela vive **dentro** do container scrollável, passamos `root: containerRef.current` ao observer.
- Cuidado com a interação do sentinela com o `position: absolute` dos rows virtualizados: o sentinela fica posicionado em `top: totalSize` dentro do mesmo wrapper relative — fora do fluxo dos rows mas dentro do espaço total, garantindo que só aparece quando o scroll chega perto do fim.
- A altura total mostrada pela scrollbar continua refletindo só `visibleCount * rowHeight` (não a lista inteira) — o usuário vê a barra "crescer" conforme rola, mesma sensação de feed infinito do Instagram/Netflix.
- Sem mudanças em React Query: o catálogo permanece em cache (`staleTime` atual) — só a renderização é incremental.

## Arquivos afetados

- `src/components/library/PosterGrid.tsx` — adiciona estado de janela, sentinela e observer.
- (Nenhum outro arquivo precisa mudar; o contrato externo do componente ganha duas props opcionais com defaults sensatos.)

## Fora de escopo

- Paginação real server-side (impossível com Xtream).
- Lazy-load do catálogo inicial em si (já é uma única request cacheada — quebrar isso pioraria a busca).
- Aplicar a mesma técnica em `VirtualChannelList` (pode vir num próximo passo se útil).
