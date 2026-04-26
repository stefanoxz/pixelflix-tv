## Diagnóstico

### "Filmes populares" e "Séries em alta" (Highlights)

Em `src/pages/Highlights.tsx` (linhas 33-40):

```ts
const topMovies = [...movies].sort((a, b) => b.rating_5based - a.rating_5based).slice(0, 12);
const topSeries = [...series].sort((a, b) => b.rating_5based - a.rating_5based).slice(0, 12);
```

- **Não é aleatório** — é ordenação por `rating_5based` desc.
- **Mas o efeito é equivalente a aleatório**: o catálogo Xtream tem dezenas de milhares de itens com `rating_5based = 5` (default do provedor / herança ruim do TMDB). O desempate é a ordem de inserção da API → sempre os mesmos itens obscuros sobem ao topo, e clássicos óbvios não aparecem.

### Notas "5,0" nos cards

`MediaCard` e `PosterCard` mostram `rating_5based.toFixed(1)` direto do Xtream. O valor é real (vem do provedor), mas como a maioria é `5` ou `0`, o badge informa pouco.

## Solução

### 1. Nova edge function `tmdb-rate`

Recebe `{type, name, year, tmdb_id?}` → consulta TMDB → devolve `{vote_average, vote_count, tmdb_id}`. Sem persistência em DB (cache fica no React Query, 24h). Reaproveita a lógica de busca cascata já presente em `tmdb-image`.

### 2. Hook `useTmdbRating`

Wrapper de `useQuery` chamando `tmdb-rate`. Habilitável por flag (só dispara para os candidatos do top), com `staleTime: 24h`.

### 3. Refatorar `Highlights.tsx`

- **Pré-filtro local**: candidatos = top 60 filmes + top 30 séries com `rating_5based > 0`, priorizando `added` recente (lançamentos dos últimos 24 meses sobem na seleção inicial).
- **Enriquecimento TMDB em paralelo**: dispara `useTmdbRating` para cada candidato (60+30 = 90 chamadas, mas todas cacheadas após primeira visita).
- **Re-rank** por `vote_average` (TMDB), exigindo `vote_count >= 50` para evitar nichos. Quem não tiver TMDB válido cai pra fim da lista.
- **Rotação diária**: shuffle determinístico com seed = data (`YYYY-MM-DD`). Pega top 24, embaralha com seed do dia, mostra 12. Cada dia uma seleção diferente, mesmo dia → mesma ordem.
- **Hero**: a fila de destaques (8 filmes + 4 séries) usa o mesmo top já refinado.

### 4. Polir badge de notas (`PosterCard`/`MediaCard`)

- Aceitar nova prop opcional `tmdbRating?: { vote_average: number; vote_count: number }`.
- Quando `tmdbRating` presente e `vote_count >= 20`: exibir `vote_average.toFixed(1)` em escala 0-10 (ex.: `8.4`) com badge dourada.
- Quando ausente: usar `rating_5based`, mas **ocultar quando for exatamente 5.0** (default suspeito do provedor) ou `0`.
- Em Highlights, o `MediaCard` recebe `tmdbRating` dos candidatos enriquecidos. Em Movies/Series listagem geral, fica como está (não vamos enriquecer 48k itens — só o que aparece nos destaques).

## Arquivos alterados

- **Novo** `supabase/functions/tmdb-rate/index.ts` — edge function de rating TMDB
- **Novo** `src/hooks/useTmdbRating.ts` — hook do React Query
- **Novo** `src/lib/dailyShuffle.ts` — shuffle determinístico com seed do dia
- **Editado** `src/pages/Highlights.tsx` — pipeline de seleção + ranking + rotação + propagação do `tmdbRating`
- **Editado** `src/components/MediaCard.tsx` — aceitar `tmdbRating`, ocultar 5.0 default
- **Editado** `src/components/library/PosterCard.tsx` — aceitar `tmdbRating`, ocultar 5.0 default

## Resultado esperado

- Hero rotativo e sessões "Filmes populares" / "Séries em alta" passam a destacar **conteúdo realmente popular segundo TMDB** (votos reais), priorizando lançamentos recentes.
- A cada dia o usuário vê uma seleção diferente dentro do top (rotação diária determinística).
- O badge "5,0" eternamente visível some quando for default do provedor; cards do topo exibem nota real do TMDB em escala 0-10.

## Sem migration de DB

Diferente da abordagem inicial considerada, **não vamos adicionar colunas** em `tmdb_image_cache`. Cache do TMDB rating fica no React Query (cliente, 24h) — TMDB tolera bem ~90 lookups por sessão e o impacto na primeira visita é desprezível (chamadas em paralelo, ~300ms total).
