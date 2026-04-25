## Novo layout para Filmes e Séries (estilo IBO Pro)

Hoje Filmes e Séries usam um grid de pôsteres com filtros no topo. O IBO Pro usa um modelo de **3 colunas focado em TV/teclado**, com prévia rica e navegação fluida. Vou replicar esse padrão mantendo total responsividade (desktop, tablet, TV e mobile).

### Layout alvo (desktop / TV)

```text
┌──────────────┬────────────────────────────┬─────────────────────────────┐
│ CATEGORIAS   │ LISTA DE TÍTULOS           │ PAINEL DE DETALHES          │
│              │                            │                             │
│ ▸ Todos      │ ▸ Duna: Parte 2     2024   │ [ backdrop grande ]         │
│   Lançamentos│   Oppenheimer       2023   │                             │
│   Ação       │   Interestelar      2014   │ Título · Ano · Duração      │
│   Comédia    │   ...                      │ ★ 8.7   Ação, Drama         │
│   Drama      │                            │                             │
│   Infantil   │                            │ Sinopse curta...            │
│   Favoritos♥ │                            │                             │
│              │  [busca embutida no topo]  │ Direção · Elenco            │
│              │                            │                             │
│              │                            │ [ ▶ Assistir ] [ ♥ ] [ + ]  │
└──────────────┴────────────────────────────┴─────────────────────────────┘
```

- **Esquerda (rail de categorias)**: lista vertical fixa, ícone + nome, com "Favoritos" e contador. Item ativo destacado em azul (cor primária do projeto).
- **Centro (lista de títulos)**: linhas compactas (não cards) com mini-pôster 40×60, nome, ano, rating e badge de qualidade quando houver. Busca no topo. Virtualizada para suportar bibliotecas grandes.
- **Direita (painel de prévia)**: atualiza ao passar o foco/hover, mostrando backdrop, sinopse, metadados e ações. Sem precisar abrir modal pra ver informações — é o grande diferencial do IBO.
- **Player**: ao clicar em "Assistir", entra em modo cinema fullscreen com overlay escuro (já existente).

### Layout em mobile / tablet pequeno

- Vira **pilha**: categorias viram chips horizontais no topo (mantém o `CategoryFilter` atual).
- Lista ocupa a largura toda, item compacto (igual desktop, sem painel direito).
- Tocar no item abre o `MovieDetailsDialog` / modal de série já existentes (preview ocupa a tela inteira), com botão "Assistir".
- Breakpoint do split: `lg` (≥1024px) mostra 3 colunas; abaixo, layout pilha.

### Séries — diferenças

Mesma estrutura de 3 colunas, mas o painel direito tem 2 modos:
1. **Visão da série**: backdrop, sinopse, elenco, botão "Ver episódios".
2. **Episódios**: tabs de temporadas no topo do painel, lista de episódios abaixo (linha com thumb + título + sinopse curta + botão play / link externo). Mantém o tratamento atual de `isExternalOnly` e badges de formato.

### Navegação por teclado / TV

- `↑ ↓` move entre categorias quando o foco está no rail; entre títulos quando está na lista.
- `← →` alterna entre as 3 colunas.
- `Enter` abre/atualiza painel direito; segundo `Enter` no painel inicia playback.
- `/` foca a busca; `f` alterna favorito do título focado; `Esc` sai do player.
- Hook reutilizável `useGridKeyboardNav` (similar ao `useLiveKeyboardNav` já existente).

### Novidades funcionais

- **Painel sempre atualizado**: ao mover o foco/hover na lista do meio, o painel direito faz fetch de `getVodInfo` / `getSeriesInfo` (com cache do React Query, debounce 250 ms) — usuário vê detalhes sem clicar.
- **Categoria "Favoritos"** fixa no topo do rail, mostrando contagem (substitui o botão atual de filtro de favoritos).
- **Categoria "Recentes"** opcional (lista os últimos 30 itens por `added`/`last_modified`).
- **Busca local** no topo da coluna central (mantém o que já existe, só muda de lugar).
- Busca e categoria persistem na URL (`?cat=...&q=...`) pra deep-link.

### Arquivos afetados

Novos:
- `src/components/library/LibraryShell.tsx` — wrapper 3 colunas responsivo.
- `src/components/library/CategoryRail.tsx` — rail vertical de categorias com favoritos/recentes.
- `src/components/library/TitleList.tsx` — lista virtualizada (`@tanstack/react-virtual`, já instalado) com item linha.
- `src/components/library/TitleListItem.tsx` — linha com thumb 40×60, nome, ano, rating, badge.
- `src/components/library/PreviewPanel.tsx` — painel direito (backdrop + metadados + ações), com variante `vod` e `series`.
- `src/components/library/SeriesEpisodesPanel.tsx` — temporadas + episódios dentro do painel direito.
- `src/hooks/useGridKeyboardNav.ts` — navegação por setas/atalhos.
- `src/hooks/useDebouncedValue.ts` — debounce do título focado pra evitar refetch agressivo.

Reescritos:
- `src/pages/Movies.tsx` — passa a montar `LibraryShell` + `CategoryRail` + `TitleList` + `PreviewPanel`. Remove o grid de cards e o botão "Favoritos" do topo (agora é categoria).
- `src/pages/Series.tsx` — mesma estrutura; `SeriesEpisodesPanel` substitui o modal grande.

Atualizados (pequeno):
- `src/components/MovieDetailsDialog.tsx` — vira fallback para mobile (já está pronto, sem mudança grande).
- `src/services/iptv.ts` — adiciona helper `sortByRecent` e tipo `EnrichedVodInfo` se necessário.

### Nota técnica

- Mantém React Query com `staleTime: 5min` pra `getVodInfo` / `getSeriesInfo`.
- Painel direito faz prefetch em hover (250 ms) e no foco do teclado (imediato).
- Virtualização: lista de títulos vira `useVirtualizer` com `estimateSize: 72`.
- Acessibilidade: cada coluna tem `role="region"` + `aria-label`; itens da lista são `<button>` com `aria-selected`.
- Performance: no breakpoint mobile o `PreviewPanel` não é montado (evita fetch desnecessário).
- Sem mudanças de banco/edge functions.
