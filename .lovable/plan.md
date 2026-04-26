
# Análise do sistema — bugs reais que afetam o usuário

Após varredura nos arquivos modificados nas últimas iterações (BottomNav, `WithChrome`, `LibraryTopBar`, `PosterGrid`/`PosterCard`, dvh, `useTmdbFallback`, drawers), encontrei **5 problemas concretos** que podem afetar o uso. Listados por severidade.

---

## 1. ALTA — `useTmdbFallback` pode disparar **toneladas** de requests para tmdb-image em telas com cover faltando

`PosterCard.tsx` chama `useTmdbFallback({ hasCover: !needsFallback })`. Quando o item **não tem cover** (`!item.cover`), `needsFallback = true` → `hasCover = false` → query habilitada para **todos os cards visíveis simultaneamente**.

Em catálogos grandes onde vários itens vêm sem `stream_icon`, isso dispara dezenas de chamadas paralelas à edge function `tmdb-image` no scroll inicial. Antes da virtualização ajudava a esconder, mas com a janela mobile reduzida ainda assim cada linha visível dispara N requests por re-render.

**Impacto**: lentidão grave em mobile / 3G, edge function rate-limit, bloqueio percebido da grade.
**Fix**: throttle/debounce ao montar (ex.: pequeno `setTimeout` antes de habilitar) **ou** habilitar só após o card entrar em viewport via IntersectionObserver, **ou** limitar concurrency com uma fila no hook.

## 2. ALTA — Categoria "Favoritos" do Live aparece com **count 0** depois das mudanças

`Live.tsx` usa a string `"favorites"` como id da categoria de favoritos (linhas 83, 225). Mas `railCategories` é construído **só** a partir de `categories` da API (linha 71-76), que **não inclui** uma entrada com id `"favorites"`. O `ChannelCategoryRail` adiciona o botão "Favoritos" separadamente passando `favoritesCount`, então o desktop funciona — porém:

- O **MobileChannelDrawer** (drawer aberto pelo FAB) renderiza **apenas** o que chega em `categories` + entradas hardcoded (`★ Favoritos` com `favorites.size`). Funciona.
- Porém o `subtitle` no `LibraryTopBar` mostra `${favorites.size} favoritos` mesmo quando o usuário não tem favoritos — OK, é só uma informação.

Não é bug crítico aqui, mas há **inconsistência de id**: Movies/Series usam `"__favorites__"`, Live usa `"favorites"`. Se algum drawer/componente compartilhado for criado vai quebrar. Recomendo padronizar.

## 3. MÉDIA — `IS_MOBILE_VIEWPORT` e `HAS_REAL_HOVER` são avaliados **uma vez no carregamento do módulo**

Em `PosterGrid.tsx` (linhas 10-13) e `PosterCard.tsx` (linhas 10-13), as constantes são calculadas no top-level. Isso causa dois problemas:

1. **Tablets em rotação**: ao girar de portrait→landscape, ou janelas redimensionáveis no Chrome DevTools, o valor não atualiza. Um iPad em portrait carrega como mobile (≤767px) e fica preso com `pageSize=36` mesmo depois de girar.
2. **DevTools mobile preview**: ao abrir o app no desktop e depois ativar device-toolbar, o app já carregou como desktop e jamais aplica os otimizadores mobile.

**Fix**: usar um hook `useMediaQuery` reativo (já existe `useIsMobile`) ao invés de constante de módulo, **ou** reavaliar via `matchMedia.addEventListener('change', ...)`.

## 4. MÉDIA — Loop de auto-fill pode disparar **muitas expansões** consecutivas e congelar o primeiro paint

`PosterGrid.tsx` linhas 191-201: o `useEffect` depende de `totalSize` e `containerWidth`. Quando expande `visibleCount`, o `totalSize` muda → o effect roda de novo → expande de novo → … até `!hasMore`. Em telas grandes com `pageIncrement=60` revelando 60 itens por frame, **cada expansão também dispara 60 onload de imagens**, o que reflowa o virtualizer e pode travar 200-500ms no mobile.

O `requestAnimationFrame` ajuda mas não rate-limita: ainda gera várias expansões em rápida sucessão.

**Fix**: adicionar guard "esperar terminar de carregar a leva atual antes de expandir" — por exemplo, aguardar `setTimeout(..., 150)` entre expansões, ou só expandir quando todas as imagens da janela atual já tiverem `onLoad` disparado.

## 5. BAIXA — Comportamento confuso ao trocar categoria com `activeId` "preso"

Em `Movies.tsx`/`Series.tsx` linhas 125-130 e 131-136:
```ts
useEffect(() => {
  if (items.length === 0) setActiveId(undefined);
  else if (activeId == null || !items.find((i) => i.id === activeId)) {
    setActiveId(items[0].id);
  }
}, [items, activeId]);
```

Quando o usuário troca de categoria, esse effect roda e seta `activeId` no primeiro item — o `PosterGrid.activeChange` então dispara `rowVirtualizer.scrollToIndex(0)`. **Mas** o `useEffect` do `PosterGrid` (linha 91-95) já reseta `scrollTop=0` ao mudar `items`. Combinado, isso pode causar um pequeno "flicker" ou rolagem dupla. Não quebra funcionalidade, mas vale uma única origem de verdade pro reset de scroll.

---

## Bugs **inexistentes** que checados e descartados

- **BottomNav cobre conteúdo**: `pb-bottom-nav` no `<main>` em `App.tsx` está correto, com safe-area inclusa. ✅
- **Header sticky + LibraryTopBar sticky**: `top-16` está correto após o ajuste anterior. ✅
- **`prefers-reduced-motion`**: aplica corretamente. ✅
- **Hover stuck em touch**: `@media (hover: none)` cobre ambos os transforms. ✅
- **dvh fallback**: `[height:calc(100dvh-Xrem)]` é aplicado depois do `h-[calc(100vh-Xrem)]` — browsers sem suporte ignoram o segundo. ✅

---

## Plano de correções (em ordem de prioridade)

### Etapa 1 — Conter requisições TMDB (bug #1)
- Em `PosterCard.tsx`, montar o `useTmdbFallback` com **gate por viewport**: usar `IntersectionObserver` no botão para só habilitar a query quando o card entrar em view (pelo menos 1x). Isso elimina o burst inicial.
- Alternativa mais simples: adicionar um `useState(seen)` que vira `true` no primeiro `onMouseEnter`/`onLoad`/após X ms — e passar `enabled: seen` no hook.

### Etapa 2 — Tornar viewport detection reativa (bug #3)
- Criar/usar hook `useMediaQuery(query: string)` reativo.
- `PosterGrid` consome `useMediaQuery("(max-width: 767px)")` para decidir `pageSize`/`pageIncrement` dinamicamente.
- `PosterCard` consome `useMediaQuery("(hover: hover) and (pointer: fine)")` para o hover guard.

### Etapa 3 — Rate-limit do auto-fill (bug #4)
- Adicionar um `useRef<number>(0)` com timestamp do último expand; só permitir nova expansão se passou ≥150ms.
- Bonus: parar o auto-fill se o `totalSize` excede `clientHeight*3` (já tem buffer suficiente).

### Etapa 4 — Padronizar id de "favoritos" (bug #2)
- Trocar `"favorites"` por `"__favorites__"` em `Live.tsx` e `ChannelCategoryRail.tsx` (3 ocorrências) — alinhando com Movies/Series.
- Não é urgente, mas evita armadilha futura.

### Etapa 5 — Centralizar reset de scroll ao trocar lista (bug #5)
- Remover o `containerRef.current.scrollTop = 0` do `PosterGrid` e deixar **só** o `scrollToIndex(0)` no caminho de `activeId` mudar.
- Ou, ao contrário: remover o auto-set de `activeId` para o primeiro item nas páginas Movies/Series e deixar o grid lidar com isso internamente.

---

## Estimativa
- **Arquivos tocados**: `src/components/library/PosterCard.tsx`, `src/components/library/PosterGrid.tsx`, `src/hooks/useMediaQuery.ts` (novo), `src/pages/Live.tsx`, `src/components/live/ChannelCategoryRail.tsx`.
- **Risco de regressão**: baixo — todas mudanças são refinamentos sobre código existente.
- **Tempo**: 1 ciclo de implementação.

Quer que eu prossiga com **todas as 5 etapas** ou só com a #1 e #3 (as de maior impacto real para o usuário)?
