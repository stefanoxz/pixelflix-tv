# Carrossel horizontal de episódios

## O que muda
Trocar o **grid em colunas fixas** (que faz o card-imagem ficar pequeno e a primeira fileira ocupar muito espaço vertical) por um **carrossel horizontal**, igual à imagem de referência: cards lado a lado, com peek do próximo card e setas de navegação no desktop.

## Comportamento por dispositivo

### Desktop (≥ md)
- Trilha horizontal com `overflow-x-auto`, `scroll-snap-x mandatory`.
- Cada card tem largura fixa: `w-64 lg:w-72 xl:w-80` (em vez de `1fr` no grid).
- **Setas de navegação** (◀ ▶) flutuando nas laterais, aparecem no hover do trilho. Clicam e fazem `scrollBy({ left: ±larguraVisível * 0.85 })`.
- Setas ficam desabilitadas/escondidas quando chega no início/fim (detecta via `scrollLeft`).
- Mostra ~4 cards inteiros + peek do 5º na largura típica de 1366px (mesmo efeito da imagem de referência).
- Badge **"E02"** no canto superior esquerdo do card (estilo da referência), em vez do número junto ao título.
- Título do episódio embaixo da imagem, centralizado/à esquerda, com `truncate`.
- Sinopse: **escondida no card** (deixa o card limpo como na referência); aparece em tooltip nativo via `title=`.

### Mobile (< md)
- Mesmo carrossel horizontal, com cards menores: `w-56`.
- Sem setas — usuário arrasta com o dedo (gesto nativo).
- `scroll-snap` para o card grudar no lugar.
- Mostra ~1.5 cards na tela (peek do próximo, indicando que dá pra arrastar).

## Arquivo afetado
- `src/components/library/SeriesEpisodesPanel.tsx`
  - Substituir o `<div class="grid ...">` por trilho horizontal + setas.
  - Adicionar `useRef` para o container e funções `scrollPrev` / `scrollNext`.
  - Remover o `<p line-clamp-2>` da sinopse no card.
  - Mover número do episódio para badge "E{n}" no canto superior esquerdo.
  - Manter as abas de temporada underline (já implementadas).

## Resultado
Igual à imagem que você enviou: **uma fileira de capas dos episódios**, com o título embaixo, e o usuário **rola lateralmente** (arrastando no celular ou clicando setas no PC) para ver os próximos. Muito mais compacto verticalmente.
