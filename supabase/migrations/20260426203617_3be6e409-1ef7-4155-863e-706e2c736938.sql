-- 1. Lock down watch_progress: only service_role (edge function) + admins.
DROP POLICY IF EXISTS "Anyone can read watch_progress" ON public.watch_progress;
DROP POLICY IF EXISTS "Anyone can insert watch_progress" ON public.watch_progress;
DROP POLICY IF EXISTS "Anyone can update watch_progress" ON public.watch_progress;
DROP POLICY IF EXISTS "Anyone can delete watch_progress" ON public.watch_progress;

-- Admins keep full access (already exists for SELECT, add for write):
DROP POLICY IF EXISTS "Admins manage watch_progress" ON public.watch_progress;
CREATE POLICY "Admins manage watch_progress"
ON public.watch_progress
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Note: service_role bypasses RLS by default, so the edge function can do everything.
-- No anon/authenticated policy → direct PostgREST access is denied.

-- 2. Harden has_role: NULL guard.
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  caller uuid := auth.uid();
BEGIN
  -- Reject NULL inputs explicitly (prevents accidental anon role lookups).
  IF _user_id IS NULL OR _role IS NULL THEN
    RETURN false;
  END IF;

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