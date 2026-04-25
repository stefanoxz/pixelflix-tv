## Objetivo

Melhorar a legibilidade do painel de episódios no diálogo de séries — com foco em fontes maiores e um seletor de temporadas mais visível e fácil de tocar.

## Mudanças visuais

### 1. Seletor de temporadas (botões "T1", "T2"…)

Hoje os botões são pequenos (`px-3 py-1.5`, `text-sm`) e o atual fica só com fundo azul sólido — sem rótulo claro nem destaque suficiente.

- Adicionar um rótulo "Temporadas" acima dos botões (`text-base font-semibold text-foreground/80`).
- Aumentar tamanho dos botões: `px-5 py-2.5`, `text-base font-bold`, cantos `rounded-lg`.
- Botão ativo: fundo `bg-primary`, texto branco, `ring-2 ring-primary/40`, leve `scale-105` e sombra azul (`shadow-[0_0_0_3px_hsl(var(--primary)/0.25)]`) para realmente destacar.
- Botão inativo: fundo `bg-secondary/60`, borda sutil `border border-border/60`, hover `bg-secondary` com leve `border-primary/40`.
- Espaçamento entre botões aumentado (`gap-2.5`) e barra com leve separador inferior (`pb-3 border-b border-border/40`) para isolar visualmente do listão de episódios.

### 2. Cards de episódio

- Aumentar padding: `p-3` → `p-4`.
- Thumbnail: `h-16 w-28` → `h-20 w-36` (maior e mais legível).
- Título do episódio: `text-sm md:text-base` → `text-base md:text-lg font-semibold`.
- Plot/sinopse do episódio: `text-xs md:text-sm` → `text-sm md:text-base`, mantendo `line-clamp-2`.
- Badge de formato (MP4/MKV…): `text-[11px]` → `text-xs`, `px-2 py-0.5`.
- Botão de play/external à direita: `h-9 w-9` → `h-11 w-11`, ícone `h-4 w-4` → `h-5 w-5`.
- Aumentar `gap` interno do card de `gap-3` para `gap-4`.

### 3. Cabeçalho "Episódios"

- Subir um pouco de hierarquia: `text-xl md:text-2xl` → `text-2xl md:text-3xl`, com `mb-4` para respirar antes do seletor.

### 4. Altura do scroll

- Manter `max-h-[50vh]` no scroll de episódios (com cards maiores ainda cabem ~3 itens visíveis confortavelmente em telas médias).

## Arquivos afetados

- `src/components/library/SeriesEpisodesPanel.tsx` — seletor de temporadas + cards de episódio.
- `src/components/SeriesDetailsDialog.tsx` — título "Episódios".

Sem mudança de lógica, sem novas dependências, sem alterações no banco. Apenas ajustes de Tailwind para tamanho e destaque.
