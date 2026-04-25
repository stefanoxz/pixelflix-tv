## Diagnóstico

A tela de carregamento que aparece **depois** do sync **não é dos dados** (esses já estão em cache populados pelo `Sync.tsx`). Vêm de três outras fontes:

1. **Suspense fallback do lazy import (causa principal).** No `App.tsx`, todas as rotas (`Index`, `Live`, `Movies`, `Series`, `Account`) usam `React.lazy(...)`. O `Sync.tsx` pré-carrega os **dados** mas não os **chunks JS** dessas páginas. Quando o usuário clica em "Filmes" / "Séries" / "TV ao vivo", o navegador ainda precisa baixar o `.js` daquela rota, e o `<Suspense fallback={<RouteFallback />}>` exibe o spinner grande de tela cheia.

2. **Gate `loadingMovies && movies.length === 0` no `Highlights.tsx`** (linha 96). Mostra spinner enquanto a primeira query de filmes está `pending`. Em fluxo normal isso não dispara (o cache vem do Sync), mas é redundante e pode piscar em casos de borda.

3. **Skeletons das imagens dos pôsteres** (cada `<img>` carrega individualmente via `proxy-image`). É algo cosmético e separado — não é "tela de carregamento", é só o lazy-loading de capas.

## O que fazer

### 1. Pré-carregar os chunks das rotas durante o Sync

Em `src/App.tsx`, exportar funções de preload para os lazy imports e, no `Sync.tsx`, dispará-las em paralelo com a busca de dados. Quando o sync terminar e redirecionar para `/`, os bundles de `Movies/Series/Live/Account` já estarão no cache do navegador — o `Suspense` resolve sincronamente e nenhum fallback aparece.

Padrão:
```ts
// App.tsx
const Movies = lazy(() => import("./pages/Movies"));
export const preloadMovies = () => import("./pages/Movies");
// idem para Series, Live, Account, Index
```

```ts
// Sync.tsx
import { preloadMovies, preloadSeries, preloadLive, preloadAccount, preloadIndex } from "@/App";

// disparar logo no início do runSync (sem await — paralelo com fetches)
[preloadIndex, preloadMovies, preloadSeries, preloadLive, preloadAccount].forEach(fn => fn());
```

### 2. Remover o spinner redundante do Highlights

Em `src/pages/Highlights.tsx`, eliminar o bloco `if (loadingMovies && movies.length === 0)` (linhas 96-102). A página já lida bem com listas vazias: as seções "TOP MOVIES" e "TOP SERIES" têm `topMovies.length > 0 && (...)` que esconde a seção até os dados chegarem, e o hero usa `featured?.title || "Bem-vindo ao SuperTech"` como fallback. Sem o gate global, a transição do Sync → "/" é imediata e qualquer dado faltante aparece progressivamente.

### 3. (Opcional) Reduzir o flash do `RouteFallback` em transições futuras

Trocar o fallback do `<Suspense>` em `App.tsx` por `null` (ou um placeholder mínimo invisível por ~100ms) para evitar piscar mesmo em redes lentas. Como o passo 1 já garante que os chunks estão pré-carregados, o fallback praticamente não será exibido — mas deixar `null` é uma rede de segurança elegante.

## Arquivos a editar

- `src/App.tsx` — exportar funções `preload*` ao lado dos `lazy(...)`.
- `src/pages/Sync.tsx` — chamar os `preload*` no início do `runSync`.
- `src/pages/Highlights.tsx` — remover o bloco `if (loadingMovies && movies.length === 0)`.

## Resultado esperado

Após o sync terminar e redirecionar para `/`, o usuário vê o Highlights instantaneamente. Clicar em **Filmes**, **Séries** ou **TV ao vivo** abre a página **sem nenhum spinner intermediário** — dados em cache + chunk JS já baixado.