# Refinar abertura do player

## Problema
Ao abrir um filme/episódio acontecem dois efeitos ruins ao mesmo tempo:

1. **O quadro "cresce do nada"** — `PlayerOverlay` aplica `animate-scale-in` (0.95 → 1) no frame, e o `Player` interno **também** aplica `animate-scale-in`. As duas escalas se compõem, dando esse pop visível e fora de ritmo.
2. **Pôster minúsculo durante "Conectando…"** — o `<video poster>` aparece reduzido no centro, com o fundo preto ao redor, em vez de cobrir o frame inteiro. Como o loader é semitransparente (`bg-black/40`), enxergamos o pôster pequeno por trás.

## O que vou mudar

### 1. `src/components/PlayerOverlay.tsx`
Trocar a animação do frame: em vez de escalar de 0.95 → 1, fazer apenas um **fade suave** (sem mudança de tamanho). O quadro nasce já no tamanho final, sem "pop".

- Remover `animate-scale-in` do frame.
- Manter `animate-fade-in` no backdrop (já existe) e adicionar um fade leve no frame (`animate-fade-in` com duração curta, sem `translateY`).
- Opcional: criar uma keyframe nova `player-in` (fade puro, 200ms) em `tailwind.config.ts` para não herdar o `translateY(10px)` do `fade-in` global, que também contribui para a sensação de "saltinho".

### 2. `src/components/Player.tsx`
- Remover o `animate-scale-in` do container raiz do Player (linha 2023). A animação de entrada deve ficar **só** no overlay, nunca duplicada.
- Trocar `className="h-full w-full"` do `<video>` por `h-full w-full object-cover` (ou `object-contain` + fundo preto) para o **pôster preencher o frame** durante o carregamento, em vez de aparecer pequenininho no meio.
- Reforçar o overlay de loading: trocar `bg-black/40` por `bg-black/70` (ou `bg-black`) para esconder completamente o pôster durante "Conectando…", dando uma transição mais limpa quando o vídeo de fato começa.
- Pequeno polimento do bloco "Conectando…": spinner um pouco menor, texto com tracking maior e fade-in próprio para não aparecer junto com o frame.

## Resultado esperado
- Player abre com **fade** suave, já no tamanho final — sem efeito de "cresceu do nada".
- Durante "Conectando…" a tela fica **preta uniforme** com o spinner centralizado, sem pôster minúsculo aparecendo no meio.
- Quando o vídeo começa, a transição do estado de loading para o playback é instantânea e limpa.

## Arquivos afetados
- `src/components/PlayerOverlay.tsx`
- `src/components/Player.tsx`
- `tailwind.config.ts` (opcional, só se adicionar a keyframe `player-in` dedicada)
