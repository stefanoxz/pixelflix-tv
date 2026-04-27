CREATE OR REPLACE FUNCTION public.cleanup_tmdb_image_cache()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE removed integer;
BEGIN
  WITH del AS (
    DELETE FROM public.tmdb_image_cache
    WHERE fetched_at < now() - interval '90 days'
    RETURNING 1
  ) SELECT count(*) INTO removed FROM del;
  RETURN removed;
END $$;

CREATE OR REPLACE FUNCTION public.cleanup_tmdb_episode_cache()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE removed integer;
BEGIN
  WITH del AS (
    DELETE FROM public.tmdb_episode_cache
    WHERE fetched_at < now() - interval '30 days'
    RETURNING 1
  ) SELECT count(*) INTO removed FROM del;
  RETURN removed;
END $$;