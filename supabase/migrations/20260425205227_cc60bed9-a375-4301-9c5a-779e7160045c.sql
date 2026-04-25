ALTER TABLE public.tmdb_image_cache ADD COLUMN IF NOT EXISTS overview TEXT;

DELETE FROM public.tmdb_image_cache 
WHERE poster_url IS NULL AND backdrop_url IS NULL;