## Melhorias na tela de Séries + capas via TMDB

### 1. Aumentar fonte e tamanho dos episódios (`SeriesEpisodesPanel.tsx`)

A lista de episódios hoje usa fontes muito pequenas (`text-xs`, `text-[10px]`, thumb 12×20). Ajustes:

- Thumb maior: `h-16 w-28` (era `h-12 w-20`) para leitura confortável.
- Título do episódio: `text-sm md:text-base font-semibold` (era `text-xs`).
- Sinopse: `text-xs md:text-sm leading-snug line-clamp-2` (era `text-[10px]`).
- Badge de formato (MP4/HLS): `text-[11px]` (era `text-[9px]`), padding maior.
- Botões da temporada (T1, T2…): `px-3 py-1.5 text-sm` (era `text-xs`).
- Botão play/external: `h-9 w-9` com ícone `h-4 w-4`.
- Container do episódio: `p-3 gap-3` para respirar.
- `max-h-[40vh]` → `max-h-[50vh]` para mostrar mais episódios sem rolar.

### 2. Aumentar header "Episódios" e textos do dialog (`SeriesDetailsDialog.tsx`)

- "Episódios": `text-xl md:text-2xl font-bold` (era `text-lg`).
- Sinopse: remover `line-clamp-5` (deixar texto completo) e usar `text-base md:text-lg`.
- Elenco/Direção: `text-base` (era `text-sm`).
- Botão "Favoritar": `size="lg"` com ícone `h-5 w-5`.

### 3. Botão de fechar mais chamativo (`src/components/ui/dialog.tsx`)

Atualmente usa `bg-background/60` translúcido — pouco visível em backdrops claros. Trocar para visual destacado em **azul** (combina com a `--primary` do sistema):

```tsx
<DialogPrimitive.Close className="absolute right-3 top-3 z-10 inline-flex h-10 w-10 
  items-center justify-center rounded-full 
  bg-primary text-primary-foreground 
  shadow-lg ring-2 ring-background/40
  hover:bg-primary/90 hover:scale-110 
  focus:outline-none focus:ring-2 focus:ring-ring 
  transition-all">
  <X className="h-5 w-5 stroke-[2.5]" />
</DialogPrimitive.Close>
```

Botão circular azul `h-10 w-10` com ícone branco grosso. Mantém afetando todos os dialogs (Filmes, Séries, Admin).

### 4. Fallback de capas via TMDB

**Problema:** algumas séries/filmes vêm sem `cover` ou `stream_icon` da fonte IPTV, gerando cards/posters em branco. O Xtream às vezes devolve `tmdb_id` no `get_series_info`/`get_vod_info`.

**Solução:** criar uma edge function `tmdb-image` que recebe `{ type: 'series' | 'movie', tmdb_id?, name?, year? }` e retorna `{ poster, backdrop }` da TMDB API:

1. Se `tmdb_id` fornecido → `GET /3/{type}/{tmdb_id}` direto.
2. Senão → `GET /3/search/{type}?query={name}&year={year}` e pega o primeiro resultado.
3. Monta URLs `https://image.tmdb.org/t/p/w500{poster_path}` e `w1280{backdrop_path}`.
4. Cacheia resultado em tabela `tmdb_image_cache` (key = `type:tmdb_id` ou `type:slug:year`) por 30 dias para não estourar rate limit.

**Frontend:**

- Hook `useTmdbFallback(item, kind)` que dispara só quando `!item.cover` (ou cover vazia), usando React Query com `staleTime` longo.
- `PosterCard` / `MediaCard` / `SeriesDetailsDialog` / `MovieDetailsDialog`: quando `cover` ausente, renderizam `useTmdbFallback`. Enquanto carrega, mostra skeleton/iniciais (já existente). Se TMDB também falhar, mantém placeholder atual.
- Usar `proxyImageUrl` em cima da URL TMDB (mantém otimização).

**Migration (nova tabela):**

```sql
create table public.tmdb_image_cache (
  cache_key text primary key,
  poster_url text,
  backdrop_url text,
  fetched_at timestamptz not null default now()
);
-- RLS: leitura pública (anon), escrita apenas via service role (edge function).
alter table public.tmdb_image_cache enable row level security;
create policy "tmdb cache readable" on public.tmdb_image_cache 
  for select using (true);
```

**Secret necessário:** `TMDB_API_KEY` (v4 read access token ou v3 key). Vou solicitar via `add_secret` antes de implementar a edge function — a API da TMDB é gratuita, basta criar conta em themoviedb.org → Settings → API.

### Arquivos a alterar

- `src/components/library/SeriesEpisodesPanel.tsx` — fontes/dimensões.
- `src/components/SeriesDetailsDialog.tsx` — header episódios, sinopse sem clamp, fontes maiores, hook TMDB.
- `src/components/MovieDetailsDialog.tsx` — hook TMDB.
- `src/components/MediaCard.tsx` / `src/components/library/PosterCard.tsx` — hook TMDB.
- `src/components/ui/dialog.tsx` — botão fechar azul.
- `src/hooks/useTmdbFallback.ts` (novo).
- `supabase/functions/tmdb-image/index.ts` (nova edge function).
- Migration nova para `tmdb_image_cache`.

### Observação

Ao iniciar a implementação, vou pedir o `TMDB_API_KEY` (gratuito). Sem ele, faço apenas as melhorias visuais (1, 2 e 3) e deixo o fallback TMDB pronto para ativar quando a chave for fornecida.