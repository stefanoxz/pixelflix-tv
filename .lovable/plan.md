# Otimização de performance — Filmes e Séries

Objetivo: reduzir tempo percebido de carregamento, eliminar tela vazia e evitar requests desnecessários, mantendo 100% do comportamento atual (Player, proxy, fallback, autenticação e backend permanecem intactos).

---

## Diagnóstico confirmado

Após inspeção do código atual:

- `src/main.tsx` define apenas `staleTime: 5 min` e `retry: 1`. Sem `gcTime` longo e sem persistência → sair da aba já descarta o cache em ~5 min de inatividade.
- `src/pages/Movies.tsx` e `src/pages/Series.tsx` chamam `useQuery(['vod-cats' / 'vod-streams' / 'series-cats' / 'series'])` sem opções específicas → herdam o staleTime curto.
- `src/pages/Sync.tsx` já hidrata o cache via `setQueryData` após o login, mas como o cache não é persistido entre reloads, todo refresh faz tudo de novo.
- `src/components/library/PosterGrid.tsx` mostra a área central completamente vazia até `items.length > 0` (só exibe a `emptyMessage` quando 0). Sem skeleton.
- `supabase/functions/iptv-categories/index.ts` itera 4 User-Agents × 2 tentativas (até 8 retries sequenciais com 300–600 ms de espera entre transitórios). Em servidor lento isso amplifica latência.

---

## Mudanças propostas (incrementais e seguras)

### 1. Cache global mais longo (`src/main.tsx`)

Adicionar `gcTime` de 24 h no `QueryClient` para que dados saiam da memória só após muito tempo de inatividade. Mantém `staleTime: 5 min` como default.

```ts
defaultOptions: {
  queries: {
    staleTime: 5 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
    retry: 1,
    refetchOnWindowFocus: false,
  },
}
```

### 2. Cache específico para catálogo (Filmes e Séries)

Em `src/pages/Movies.tsx` e `src/pages/Series.tsx`, aplicar nos 4 `useQuery` (`vod-cats`, `vod-streams`, `series-cats`, `series`):

```ts
staleTime: 30 * 60 * 1000,   // 30 min "fresco" → não refaz fetch
gcTime: 24 * 60 * 60 * 1000, // 24 h em memória
```

Comportamento preservado: ao mudar de credencial (queryKey inclui `creds.username`) o cache se separa naturalmente.

### 3. Persistência do cache entre sessões

Instalar:

- `@tanstack/react-query-persist-client`
- `@tanstack/query-sync-storage-persister`

Em `src/main.tsx`, envolver o `QueryClientProvider` com `PersistQueryClientProvider`, persistindo em `localStorage` com `maxAge: 12 h`. Usar `dehydrateOptions.shouldDehydrateQuery` para persistir **apenas** queries de catálogo:

```ts
shouldDehydrateQuery: (q) => {
  const k = q.queryKey?.[0];
  return k === "vod-cats" || k === "vod-streams"
      || k === "series-cats" || k === "series"
      || k === "live-cats"  || k === "live-streams";
}
```

Não persistimos: `vod-info`, `series-info`, `tmdb-fallback`, `epg-now`, queries do Account/Admin → mantém tamanho do `localStorage` baixo e evita persistir respostas potencialmente grandes/sensíveis. Adicionamos um `buster` (versão) para invalidar cache antigo em deploys que mudam o shape dos dados.

### 4. Prefetch do catálogo após login

O fluxo atual já passa pela tela `/sync` que chama `setQueryData` para hidratar o catálogo — isto **já é uma forma de prefetch** e funciona bem. Para reforçar:

- Em `src/context/IptvContext.tsx`, ao detectar uma sessão IPTV válida no boot, disparar (sem `await`) `queryClient.prefetchQuery` para `vod-cats`, `vod-streams`, `series-cats` e `series` somente se o cache ainda não tiver dados frescos. Isso cobre o caso de F5 quando a persistência expira ou o usuário pula `/sync`.
- Importante: usa o mesmo `queryClient` global (via `import { queryClient } from "@/main"` exportado novo) e respeita o queue global de `iptv.ts` (limita concorrência).
- Não muda o fluxo de `/sync`.

### 5. Skeleton loading no `PosterGrid`

Em `src/components/library/PosterGrid.tsx`:

- Adicionar prop opcional `isLoading?: boolean`.
- Quando `isLoading && items.length === 0`, renderizar 18 cards skeleton dentro do mesmo grid responsivo (mesma estrutura `gridTemplateColumns` e `aspect 2:3`) usando `<Skeleton />` (`src/components/ui/skeleton.tsx`, já existe).
- Não toca virtualizer nem comportamento de scroll/teclado.

Em `Movies.tsx` e `Series.tsx`, capturar `isLoading` dos `useQuery` da lista principal (`vod-streams` / `series`) e passar para `PosterGrid`.

Resultado: durante o primeiro fetch o usuário vê grid pulsante em vez de tela vazia.

### 6. Edge function `iptv-categories` — retry menos agressivo

Em `supabase/functions/iptv-categories/index.ts`, dentro de `fetchWithRetries`:

- Reduzir `attemptsPerUa` de 2 → 1.
- Reordenar `USER_AGENTS` para colocar `VLC/3.0.20` em primeiro (já está) e cortar a lista para `[VLC, IPTVSmarters, Mozilla]` (3 em vez de 4).
- Total máximo de tentativas: 3 (uma por UA) em vez de 8. Mantém fallback de UA para servidores Xtream que bloqueiam um agente específico.
- Mantém set de `TRANSIENT_STATUSES`, mantém retorno de erro real, mantém `cache` da allowlist.

Sem mudanças em CORS, allowlist, validação de parâmetros ou interface da função.

---

## Detalhes técnicos

### Arquivos editados

| Arquivo | Mudança |
|---|---|
| `src/main.tsx` | Exporta `queryClient`, adiciona `gcTime`, envolve com `PersistQueryClientProvider` + persister filtrado |
| `src/pages/Movies.tsx` | `staleTime`/`gcTime` longos nos 2 `useQuery` + repassa `isLoading` ao `PosterGrid` |
| `src/pages/Series.tsx` | Idem para `series-cats`/`series` |
| `src/components/library/PosterGrid.tsx` | Nova prop `isLoading` + render de 18 skeletons quando vazio + carregando |
| `src/context/IptvContext.tsx` | Prefetch de catálogo em background no boot quando há sessão e cache vazio |
| `supabase/functions/iptv-categories/index.ts` | `attemptsPerUa = 1`, lista de UAs reduzida para 3 |
| `package.json` | Adiciona `@tanstack/react-query-persist-client` e `@tanstack/query-sync-storage-persister` |

### O que NÃO muda

- `Player`, `PlayerOverlay`, `stream-token`, `stream-proxy`, `stream-event` — intactos.
- Edge functions `iptv-login`, `tmdb-image`, `check-server`, `client-diagnostic`, `admin-api` — intactas.
- Banco, RLS, tabelas, autenticação Supabase, allowlist de servidores — intactos.
- Estrutura de rotas e `/sync` — intactos.
- Lógica de fallback TMDB, proxy de imagens, queue global de `iptv.ts` — intactos.

### Riscos e mitigações

- **Cache persistido pode ficar "velho"** após troca de servidor → mitigado pelo `buster` (versão) e por o `queryKey` incluir `creds.username` (cache trocado automaticamente quando o usuário muda).
- **localStorage cheio** → persistimos apenas 6 chaves de catálogo; cada usuário tem ~1–3 MB no pior caso, bem dentro do limite.
- **Skeleton aparecer brevemente em navegação subsequente** → só renderizamos skeleton quando `items.length === 0 && isLoading`; em re-entradas com cache, `items` já vem populado e nada muda visualmente.
- **Edge function com menos retries** → mantida lógica de fallback de UA e de status transitórios; em servidor estável reduz latência média; em servidor instável o cliente já tem `retriesData: 2` no `iptv.ts` que reenvia a request inteira.

---

## Resultado esperado

- Primeira carga: skeleton no lugar de tela vazia.
- Reload (até 12 h depois): catálogo aparece **instantaneamente** do `localStorage`, com revalidação silenciosa em background.
- Navegação Filmes ↔ Séries ↔ Home: dados já em memória → 0 requests.
- Edge function de categorias: até 3× mais rápida em cenário de erro transitório.
- Zero impacto em Player, autenticação, proxy ou backend.
