-- 1) Adiciona tmdb_id ao cache de imagens (para reuso em buscas de episódios/ratings)
ALTER TABLE public.tmdb_image_cache
  ADD COLUMN IF NOT EXISTS tmdb_id BIGINT;

CREATE INDEX IF NOT EXISTS idx_tmdb_image_cache_tmdb_id
  ON public.tmdb_image_cache (tmdb_id)
  WHERE tmdb_id IS NOT NULL;

-- 2) Cache de episódios TMDB em pt-BR (1 linha por temporada)
CREATE TABLE IF NOT EXISTS public.tmdb_episode_cache (
  cache_key TEXT PRIMARY KEY,           -- ex: "tv:12345:s:1"
  tmdb_id BIGINT NOT NULL,
  season_number INT NOT NULL,
  episodes JSONB NOT NULL DEFAULT '[]'::jsonb, -- [{episode_number, name, overview, still_path}]
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tmdb_episode_cache_fetched_at
  ON public.tmdb_episode_cache (fetched_at);

CREATE INDEX IF NOT EXISTS idx_tmdb_episode_cache_tmdb_season
  ON public.tmdb_episode_cache (tmdb_id, season_number);

ALTER TABLE public.tmdb_episode_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read tmdb episode cache" ON public.tmdb_episode_cache;
CREATE POLICY "Anyone can read tmdb episode cache"
  ON public.tmdb_episode_cache
  FOR SELECT
  USING (true);
