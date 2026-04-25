## Corrigir capas/sinopses ausentes no TMDB

### Problema

Investiguei o caso "Esgotado por Voce (2026)". O cache em `tmdb_image_cache` tem **duas entradas vazias** para esse título (`poster_url=null`, `backdrop_url=null`) — armazenadas há minutos. A edge function consultou o TMDB filtrando por `name + year=2026` e não achou nada, salvou o "vazio" e ficou preso por **30 dias** (TTL atual).

Causas prováveis do miss:

1. **Filtro de ano restritivo demais.** Se o IPTV diz "(2026)" mas o TMDB tem outro ano de estreia (muito comum em pré-lançamentos / dublagens BR), a busca retorna 0.
2. **Acentos.** "Voce" no IPTV vs "Você" no TMDB — `search` tolera, mas combinado com filtro de ano errado mata o resultado.
3. **Sinopse também faltando.** Hoje o fallback só puxa imagem; quando a fonte IPTV não tem `plot`, fica "Sem sinopse disponível".
4. **Cache de "miss" igual ao de "hit" (30 dias)** — entradas vazias antigas não tentam de novo.

### Plano

**1. `supabase/functions/tmdb-image/index.ts`** — busca em cascata + sinopse:

- Limpar a query (remover sufixos como `(2026)`, `S01`, " - subtítulo").
- Tentar 4 estratégias na ordem: (a) original+ano, (b) limpa+ano, (c) limpa SEM ano, (d) original SEM ano. Retornar no primeiro hit.
- Ordenar resultados por `popularity` (desempata títulos comuns).
- Buscar também `overview` (sinopse PT-BR) e devolver no payload. Se o `search` não trouxer `overview`, fazer um `GET /tv/{id}` complementar.
- TTL de cache split: **30 dias** quando há hit, **1 dia** quando vazio (auto-retry).

**2. Migration** — adicionar coluna `overview` ao cache e limpar entradas vazias antigas:

```sql
ALTER TABLE public.tmdb_image_cache ADD COLUMN IF NOT EXISTS overview TEXT;
DELETE FROM public.tmdb_image_cache 
WHERE poster_url IS NULL AND backdrop_url IS NULL;
```

**3. `src/hooks/useTmdbFallback.ts`** — expor `overview` no tipo de retorno.

**4. `src/components/SeriesDetailsDialog.tsx` e `MovieDetailsDialog.tsx`** — quando `plot`/`info.plot` estiver vazio, usar `tmdb.overview` como fallback antes de mostrar "Sem sinopse disponível".

### Resultado esperado

- "Esgotado por Voce (2026)" e similares vão buscar de novo no próximo `open` e provavelmente encontrar (uma das 4 tentativas vai bater).
- Se realmente não existir no TMDB (conteúdo muito obscuro), o cache vazio expira em 24h em vez de 30 dias.
- Sinopse passa a vir do TMDB quando o IPTV não fornece.

### Arquivos alterados

- `supabase/functions/tmdb-image/index.ts` (reescrito)
- `src/hooks/useTmdbFallback.ts` (adiciona `overview`)
- `src/components/SeriesDetailsDialog.tsx` (fallback de sinopse)
- `src/components/MovieDetailsDialog.tsx` (fallback de sinopse)
- Nova migration: coluna `overview` + limpeza de cache vazio