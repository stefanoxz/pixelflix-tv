ALTER TABLE public.active_sessions
  ADD COLUMN IF NOT EXISTS content_kind text,
  ADD COLUMN IF NOT EXISTS content_title text,
  ADD COLUMN IF NOT EXISTS content_id text,
  ADD COLUMN IF NOT EXISTS content_started_at timestamptz;

CREATE OR REPLACE FUNCTION public.evict_idle_sessions()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  removed integer;
BEGIN
  WITH del AS (
    DELETE FROM public.active_sessions
    WHERE last_seen_at < now() - interval '60 minutes'
       OR (content_kind = 'idle' AND content_started_at IS NOT NULL
           AND content_started_at < now() - interval '60 minutes')
    RETURNING 1
  )
  SELECT count(*) INTO removed FROM del;
  RETURN removed;
END
$$;

REVOKE ALL ON FUNCTION public.evict_idle_sessions() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.evict_idle_sessions() TO service_role;