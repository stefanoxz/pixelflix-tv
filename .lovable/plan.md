## Diagnóstico — onde está lento e por quê

Rodei uma análise completa em `Movies.tsx`, `Series.tsx`, `PosterGrid`, `PosterCard`, dialogs de detalhes, `services/iptv.ts` e setup do React Query. Lighthouse desktop dá 99/100, então **rede inicial está ok**. A lentidão percebida no uso real (mobile/scroll/abrir filme) vem de outro lado:

### 1. Grid sem virtualização e re-renders pesados
`PosterGrid` renderiza **todos os filmes/séries de uma vez** (podem ser 2.000+ pôsteres). Mesmo com `loading="lazy"`, cada `PosterCard`:
- chama `useState` + `useIsIncompatible` (`useEffect` + 2 `addEventListener` por card) → centenas de listeners no `window`,
- não é memoizado (`React.memo`), então qualquer mudança de busca/seta re-renderiza tudo,
- `useEffect` no grid faz `scrollIntoView` a cada mudança de `activeId` (acionado também ao filtrar).

Resultado em celular: scroll travado, busca digitando com lag, listeners empilhando.

### 2. Busca sem debounce
`onSearchChange` atualiza estado a cada tecla → `filteredMovies`/`items` recalculam → grid inteiro re-renderiza a cada caractere. Em listas grandes isso engasga, principalmente no mobile.

### 3. Capas sem dimensões / sem CDN otimizada
`<img>` dos pôsteres não tem `width`/`height` → causa shifts e layout extra. `proxyImageUrl` (weserv.nl) é chamada **sem parâmetros de redimensionamento**: estamos baixando a capa em tamanho original (geralmente 600×900 ou maior) só pra exibir num quadrado de ~140px. Em uma grade com 100 capas isso é **muitos MB desnecessários**.

### 4. Sinopses lentas porque dependem da edge a cada abertura
`getVodInfo` / `getSeriesInfo` vão sempre pela edge function `iptv-categories`. Tem `staleTime: 5min` no React Query, mas:
- não tem `gcTime` longo → ao trocar de filme e voltar, refetch,
- não tem prefetch ao **focar** o card (no desktop dá pra começar a buscar antes do clique),
- não tem cache cross-sessão (recarregou a página, perde tudo).

### 5. `host` recalculado por item
Em `Movies.tsx` `upstreamHost` é `useMemo`, mas é passado a cada `PosterItem`, fazendo `items` ser uma nova array sempre que `upstreamHost` muda (raro) — ok. Mas `useIsIncompatible` em todo card adiciona 2 event listeners no `window` por card. Para 1.500 cards = 3.000 listeners.

### 6. Warning React no `SeriesEpisodesPanel`
Console mostra: *"Function components cannot be given refs ... Check render method of SeriesEpisodesPanel"*. O `<TooltipTrigger asChild>` está envolvendo um `<span>`/`<Button>`, mas a árvore real reclama que algum filho não aceita ref. Precisa identificar o trigger problemático e garantir que o filho direto seja um elemento DOM (ou wrappar em `forwardRef`).

### 7. Cache HTTP do bundle
Lighthouse aponta `index.js` e `index.css` com `Cache TTL = 0`. É controlado pela infraestrutura do Lovable; não dá pra mexer pelo código, mas vale registrar (não é ação nossa).

---

## O que vou fazer

### A. Virtualizar a grade de pôsteres
Adicionar **`@tanstack/react-virtual`** no `PosterGrid`. Renderizar só as linhas visíveis + buffer. Mantém grid responsivo (3→7 colunas) calculando `colCount` a partir da largura do container. Ganho esperado: **scroll fluido com 5.000+ itens**, sem lag de filtragem.

### B. Memoizar `PosterCard` e remover listeners por card
- Envolver `PosterCard` em `React.memo` com comparação rasa.
- Substituir `useIsIncompatible` por **uma única inscrição global** no `PosterGrid` que carrega o `Set` de chaves marcadas e propaga via prop. Os cards apenas leem `props.incompatible` (sem `useEffect`).
- Resultado: zero listeners por card, re-renders só quando o item realmente muda.

### C. Debounce na busca (250 ms)
Já existe `useDebouncedValue` no projeto. Aplicar em `Movies.tsx`, `Series.tsx` e `Live.tsx`. O `<Input>` continua respondendo na hora; o filtro pesado roda com 250ms de atraso.

### D. Capas otimizadas pela CDN
Mudar `proxyImageUrl` (ou criar `posterThumbUrl`) para passar `?w=300&h=450&fit=cover&output=webp&q=75` no weserv. Para o `MovieDetailsDialog` usar `?w=600`. Reduz tráfego de imagens em 5-10x e acelera primeiro paint do grid.

Adicionar `width`/`height` no `<img>` do pôster para reservar espaço (sem shift).

### E. Cache persistente e prefetch dos detalhes
- Subir `gcTime` para 30 min nas queries de `vod-info` e `series-info`.
- **Prefetch on hover/focus**: ao passar o mouse no `PosterCard` (desktop) ou ao mudar `activeId` por teclado, disparar `queryClient.prefetchQuery(["vod-info", id])`. Quando o usuário clicar, sinopse já está pronta.
- Persistir cache de detalhes em `sessionStorage` via `persistQueryClient` (só pras chaves de info, não pras listas grandes).

### F. Corrigir warning ref do `SeriesEpisodesPanel`
Investigar qual `TooltipTrigger asChild` está reclamando (provavelmente o `<span>` do badge ou o `<Button>` com `onClick`). Garantir que o filho aceite ref. Sem warning = sem renderização extra de validação em dev.

### G. Pequenas limpezas
- Remover `scrollIntoView` em todo mudança de `activeId` quando ele veio do clique do mouse (só fazer em navegação por teclado).
- `useGridKeyboardNav`: garantir handlers estáveis com `useCallback`.

---

## Detalhes técnicos (resumido)

```text
PosterGrid
├── useVirtualizer({ count: rows, estimateSize, overscan: 4 })
├── ResizeObserver → colCount (3..7)
├── useIncompatibleSet(host) → Set<key> (1 listener)
└── memo(PosterCard) recebe { item, active, isFavorite, incompatible }

services/iptv.ts
└── proxyImageUrl(url, { w, h, q })  // weserv params

Movies.tsx / Series.tsx
├── searchDebounced = useDebouncedValue(search, 250)
├── filtered = useMemo(... searchDebounced ...)
└── onCardHover(id) → queryClient.prefetchQuery(["vod-info", id])
```

Pacotes novos: `@tanstack/react-virtual` (já compatível com o React Query 5 do projeto). Sem outras deps.

---

## O que NÃO vou mexer

- Player / lógica de stream / edge functions (já está estável; foco do pedido é navegação/capas/sinopse).
- Bundle splitting adicional (App.tsx já lazy-load todas as rotas; ganho marginal).
- Cache HTTP do bundle (controlado pela infra do Lovable).

Pronto para implementar?