-- =========================================
-- 1) SECURITY: Restrict has_role visibility
-- =========================================
-- Previously any authenticated user could probe roles of any other user.
-- Now only the owner or an existing admin can check.
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  caller uuid := auth.uid();
BEGIN
  -- Allow service_role / internal calls (no auth context) to keep working.
  IF caller IS NULL THEN
    RETURN EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = _user_id AND role = _role
    );
  END IF;

  -- Owner can check own roles. Admins can check anyone's.
  IF caller <> _user_id THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = caller AND role = 'admin'
    ) THEN
      RETURN false;
    END IF;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
END
$function$;

-- =========================================
-- 2) SECURITY: Lock down used_nonces
-- =========================================
-- Table is internal-only; deny all client access explicitly.
ALTER TABLE public.used_nonces ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Deny all client access to nonces" ON public.used_nonces;
CREATE POLICY "Deny all client access to nonces"
ON public.used_nonces
AS RESTRICTIVE
FOR ALL
TO authenticated, anon
USING (false)
WITH CHECK (false);

-- =========================================
-- 3) HOUSEKEEPING: extensions + cleanup fns
-- =========================================
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE OR REPLACE FUNCTION public.cleanup_used_nonces()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE removed integer;
BEGIN
  WITH del AS (
    DELETE FROM public.used_nonces
    WHERE used_at < now() - interval '24 hours'
    RETURNING 1
  ) SELECT count(*) INTO removed FROM del;
  RETURN removed;
END $$;

CREATE OR REPLACE FUNCTION public.cleanup_stream_events()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE removed integer;
BEGIN
  WITH del AS (
    DELETE FROM public.stream_events
    WHERE created_at < now() - interval '30 days'
    RETURNING 1
  ) SELECT count(*) INTO removed FROM del;
  RETURN removed;
END $$;

CREATE OR REPLACE FUNCTION public.cleanup_client_diagnostics()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE removed integer;
BEGIN
  WITH del AS (
    DELETE FROM public.client_diagnostics
    WHERE created_at < now() - interval '30 days'
    RETURNING 1
  ) SELECT count(*) INTO removed FROM del;
  RETURN removed;
END $$;

CREATE OR REPLACE FUNCTION public.cleanup_login_events()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE removed integer;
BEGIN
  WITH del AS (
    DELETE FROM public.login_events
    WHERE created_at < now() - interval '90 days'
    RETURNING 1
  ) SELECT count(*) INTO removed FROM del;
  RETURN removed;
END $$;

-- =========================================
-- 4) Schedule cron jobs (idempotent)
-- =========================================
DO $$
BEGIN
  PERFORM cron.unschedule('cleanup-used-nonces-hourly');
EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$
BEGIN
  PERFORM cron.unschedule('cleanup-stream-events-daily');
EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$
BEGIN
  PERFORM cron.unschedule('cleanup-client-diagnostics-daily');
EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$
BEGIN
  PERFORM cron.unschedule('cleanup-login-events-daily');
EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$
BEGIN
  PERFORM cron.unschedule('evict-idle-sessions-hourly');
EXCEPTION WHEN OTHERS THEN NULL; END $$;

SELECT cron.schedule(
  'cleanup-used-nonces-hourly',
  '0 * * * *',
  $$ SELECT public.cleanup_used_nonces(); $$
);

SELECT cron.schedule(
  'cleanup-stream-events-daily',
  '15 3 * * *',
  $$ SELECT public.cleanup_stream_events(); $$
);

SELECT cron.schedule(
  'cleanup-client-diagnostics-daily',
  '30 3 * * *',
  $$ SELECT public.cleanup_client_diagnostics(); $$
);

SELECT cron.schedule(
  'cleanup-login-events-daily',
  '45 3 * * *',
  $$ SELECT public.cleanup_login_events(); $$
);

SELECT cron.schedule(
  'evict-idle-sessions-hourly',
  '*/30 * * * *',
  $$ SELECT public.evict_idle_sessions(); $$
);