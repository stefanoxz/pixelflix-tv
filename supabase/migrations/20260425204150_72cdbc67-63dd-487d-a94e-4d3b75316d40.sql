CREATE TABLE public.tmdb_image_cache (
  cache_key TEXT PRIMARY KEY,
  poster_url TEXT,
  backdrop_url TEXT,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.tmdb_image_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read tmdb cache"
ON public.tmdb_image_cache
FOR SELECT
USING (true);

CREATE INDEX idx_tmdb_cache_fetched_at ON public.tmdb_image_cache(fetched_at);