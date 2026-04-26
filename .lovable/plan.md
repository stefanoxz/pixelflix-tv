## Problema

Na tela **Filmes** (e por consequência **Séries**, que usa o mesmo `PosterGrid`), aparece eternamente:

> ⟳ Mostrando 120 de 48159

Não é falha de sincronização do login. Os 48.159 filmes já foram baixados pela query `vod-streams` logo após o login. O que está travado é a **paginação incremental no client** dentro de `src/components/library/PosterGrid.tsx`:

- O grid revela 120 itens iniciais e usa um `IntersectionObserver` num "sentinela" no fim da lista virtual para revelar mais 60 a cada vez.
- O sentinela é posicionado em `totalSize - 1` (fim do conteúdo virtual já renderizado, ~5 linhas com 120 itens), então **fica visível desde o primeiro render**, sem precisar rolar.
- Como o IO foi criado com o sentinela já intersectando, em vários ciclos ele não dispara um evento novo — o spinner fica girando indefinidamente e a UX vira "carregamento infinito".
- Além disso, o rodapé com o spinner aparece **mesmo quando o usuário não está perto do fim**, sugerindo que ainda está baixando dados (não está — é só revelação local).

## Solução

Trocar a estratégia de revelação para algo determinístico, sem depender do sentinela "entrar em view":

1. **Revelar mais conforme o scroll real do container**, usando o evento `scroll` do `containerRef`. Quando faltarem menos de ~800px para o fim do `totalSize`, incrementar `visibleCount` em `pageIncrement`.
2. **Auto-revelar enquanto a grade não preenche a viewport**: após cada render, se `totalSize <= clientHeight + 600` e `hasMore`, revelar o próximo chunk imediatamente em um `requestAnimationFrame`. Isso resolve o caso atual (120 itens cabem na tela → expande sozinho até preencher).
3. **Remover o sentinela** e o `IntersectionObserver` — substituídos pelos dois mecanismos acima, que são mais previsíveis.
4. **Trocar o rótulo do rodapé** para refletir o estado correto:
   - Enquanto está revelando: `Mostrando X de Y` sem spinner (a revelação é instantânea, não é I/O).
   - Mostrar spinner **apenas** se `moviesLoading` (a query do backend) ainda estiver em andamento.
   - Quando `visibleCount === items.length`: `Y itens` (sem spinner, sem "carregados").

## Arquivos alterados

- **`src/components/library/PosterGrid.tsx`**
  - Remover `sentinelRef`, o `useEffect` do `IntersectionObserver` e o `<div ref={sentinelRef}>`.
  - Adicionar handler de `onScroll` no container que, ao chegar a ~800px do fim, chama `setVisibleCount(c => Math.min(c + pageIncrement, items.length))`.
  - Adicionar `useEffect` (deps: `totalSize`, `containerWidth`, `hasMore`, `items.length`) que, se `hasMore && totalSize <= clientHeight + 600`, agenda `requestAnimationFrame` para revelar mais um chunk — repete até preencher a viewport.
  - Aceitar uma nova prop opcional `isLoading` para diferenciar "buscando no backend" de "revelando localmente". Já existe — só ajustar o rodapé.
  - Rodapé: spinner apenas quando `isLoading` da query externa for true; caso contrário mostra apenas o contador `Mostrando X de Y` (sem spinner) ou `Y itens` quando completo.

## Detalhes técnicos

```ts
// dentro do PosterGrid
const onScroll = () => {
  const el = containerRef.current;
  if (!el || !hasMore) return;
  const remaining = el.scrollHeight - el.scrollTop - el.clientHeight;
  if (remaining < 800) {
    setVisibleCount(c => Math.min(c + pageIncrement, items.length));
  }
};

// auto-fill enquanto a grade não preenche a viewport
useEffect(() => {
  const el = containerRef.current;
  if (!el || !hasMore) return;
  if (totalSize <= el.clientHeight + 600) {
    const id = requestAnimationFrame(() => {
      setVisibleCount(c => Math.min(c + pageIncrement, items.length));
    });
    return () => cancelAnimationFrame(id);
  }
}, [totalSize, containerWidth, hasMore, items.length, pageIncrement]);
```

## Resultado esperado

- Ao abrir Filmes, a grade revela rapidamente o suficiente para preencher a viewport (sem spinner perpétuo).
- Ao rolar, mais itens aparecem antes de bater no fim, sem travas.
- O spinner do rodapé só aparece se a query `vod-streams` realmente estiver buscando dados do backend.
- Mesma correção beneficia automaticamente a tela **Séries** (que reusa `PosterGrid`).
