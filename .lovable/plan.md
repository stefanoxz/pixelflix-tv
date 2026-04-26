## Objetivo

Melhorar a percepção de velocidade e reduzir travamentos em 3G/4G nas grades de **Filmes** e **Séries**, sem alterar o comportamento já bom no desktop. As mudanças são todas aditivas (skeletons mais ricos e cargas progressivas mais agressivas no mobile) e não tocam na lógica de negócio nem nas queries existentes.

## Diagnóstico atual

O que já existe e está bom (vamos preservar):
- `PosterGrid` já é virtualizado (`@tanstack/react-virtual`) — só renderiza linhas visíveis.
- `PosterCard` já usa `loading="lazy"` + `decoding="async"` nas imagens.
- Já existe paginação incremental client-side (`pageSize=120`, `pageIncrement=60`).
- Já existem skeletons no estado vazio quando `isLoading=true`.
- `useTmdbFallback` só dispara quando não há cover ou a imagem original falha.

O que está machucando o mobile:
1. **`pageSize=120` é alto demais para celular** — em 3G/4G, são 120 requests TMDB/imagens disparando ao mesmo tempo no primeiro paint, mesmo virtualizado (virtualizer renderiza ~10 linhas, mas as 120 covers já entram em fila no browser).
2. **Sem skeleton enquanto rola e revela mais itens** — a próxima página aparece "em branco" até a imagem chegar.
3. **Skeleton inicial só aparece quando `items.length === 0`** — durante refetch silencioso (volta da página, troca de categoria com cache frio) não há feedback visual.
4. **`onHoverItem` faz prefetch da sinopse** — em mobile não há hover real, então o `onMouseEnter` dispara em scroll/touch e queima banda. Não é problema no desktop.
5. **Re-render do grid inteiro em cada troca de categoria** — sem skeleton de transição, dá sensação de travada.

## Mudanças propostas

Todas escopadas a `PosterGrid.tsx` + `PosterCard.tsx`, com gates por viewport pra não afetar o desktop.

### 1. Page size adaptativo por viewport
- `PosterGrid` já recebe `pageSize` como prop. Manter o default `120` (desktop), mas detectar mobile internamente via `window.matchMedia("(max-width: 767px)")` e usar:
  - Mobile: `pageSize=36`, `pageIncrement=24`
  - Desktop: `pageSize=120`, `pageIncrement=60` (inalterado)
- Reduz drasticamente a fila inicial de imagens em 3G/4G sem mudar o comportamento PC.

### 2. Skeleton por célula durante revelação progressiva
No `PosterCard`, adicionar um skeleton shimmer atrás da `<img>` que some quando ela carrega (`onLoad`). Isso preenche o "branco" enquanto a imagem chega — útil em qualquer rede, mas crítico em 3G.
- Sem custo extra: só uma `div` absoluta com `skeleton-shimmer` (classe já existe em `index.css`) + estado `loaded`.
- No desktop com cache quente, a imagem já vem cached e o skeleton some em <16ms (invisível).

### 3. Skeleton overlay durante refetch / troca de categoria
- Hoje skeletons só aparecem quando `items.length === 0`. Adicionar uma faixa de skeleton sobreposta na primeira linha quando `isLoading && items.length > 0` (refetch silencioso). Mantém os pôsteres atuais visíveis mas sinaliza atualização.
- Opcional/leve: 1 div com `opacity-60` + spinner pequeno no header, sem repintar a grade.

### 4. Hover prefetch só com mouse real
- Trocar `onMouseEnter`/`onFocus` no `PosterCard` por: só dispara `onHover` se `window.matchMedia("(hover: hover) and (pointer: fine)").matches`.
- Em mobile, o prefetch ainda acontece via `onClick` (já é o comportamento atual no Drawer).
- Desktop fica idêntico.

### 5. Lazy decode mais agressivo + `fetchpriority`
- Trocar `loading="lazy"` por `loading="lazy" fetchpriority="low"` nas covers fora da primeira linha; primeira linha (`vRow.index === 0`) ganha `fetchpriority="high"`.
- Hint pro browser priorizar o que aparece no fold sem prejudicar o resto.

### 6. Auto-fill mais conservador no mobile
- Hoje o `useEffect` de auto-fill expande a janela quando `totalSize <= clientHeight + 600`. Em mobile reduzir esse buffer para `+200` pra não disparar 2-3 expansões consecutivas no primeiro paint.

## Garantias de não-regressão (PC/Web)

- `pageSize` desktop: **inalterado** (120/60).
- Virtualização: **inalterada**.
- Hover prefetch desktop: **inalterado** (cobre o caso `hover: hover`).
- Skeleton por célula: invisível quando imagem vem do cache (caso comum em PC).
- Layout, grid template, breakpoints, navegação por teclado: **inalterados**.
- Nenhuma mudança em `Movies.tsx`, `Series.tsx`, queries, contexto ou serviços.

## Detalhes técnicos

Arquivos tocados (apenas 2):

**`src/components/library/PosterGrid.tsx`**
- Adicionar `useIsMobile`-like inline (via `matchMedia` num `useState` lazy, sem hook novo) para derivar `effectivePageSize` / `effectivePageIncrement` quando o caller não sobrescreve via prop.
- Reduzir buffer de auto-fill em mobile (`+200` vs `+600`).
- Passar `rowIndex` para o `PosterCard` (apenas pra primeira linha receber `priority`).

**`src/components/library/PosterCard.tsx`**
- Novo state `loaded` + skeleton absoluto (`<div className="absolute inset-0 skeleton-shimmer" />`) que some no `onLoad`.
- Nova prop opcional `priority?: boolean` → mapeia para `fetchpriority="high" | "low"`.
- Guard de `onHover`: só executa se `matchMedia("(hover: hover)")` for verdade. Pode ser uma const módulo-level pra evitar custo por render:
  ```ts
  const HAS_HOVER = typeof window !== "undefined"
    && window.matchMedia?.("(hover: hover) and (pointer: fine)").matches;
  ```

Sem mudança em CSS (a classe `skeleton-shimmer` já existe). Sem nova dependência. Sem mudança de tipos públicos do `PosterItem`.

## Validação

1. Desktop (1280+): grid carrega igual ao atual; primeira linha com `fetchpriority=high` aparece levemente mais rápido; nenhum skeleton visível em cache quente.
2. Mobile (≤768px): primeiro paint dispara apenas ~36 imagens; skeleton shimmer cobre células enquanto carregam; rolagem revela próximos 24 + skeleton; sem prefetch TMDB acidental por scroll.
3. Troca de categoria: feedback visual imediato (overlay leve) sem repintar a grade inteira.
