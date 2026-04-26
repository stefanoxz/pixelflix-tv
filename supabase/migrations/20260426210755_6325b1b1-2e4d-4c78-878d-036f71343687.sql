-- Hardens has_role(): only allow the no-auth bypass branch when the call is
-- actually coming from the trusted server-side role (service_role). Any other
-- no-auth context (e.g. an unexpected SECURITY DEFINER chain) is denied.
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  caller uuid := auth.uid();
  caller_role text := current_setting('request.jwt.claim.role', true);
BEGIN
  -- Reject NULL inputs explicitly (prevents accidental anon role lookups).
  IF _user_id IS NULL OR _role IS NULL THEN
    RETURN false;
  END IF;

  -- No auth context: only allow if the request explicitly carries the
  -- service_role claim (i.e. internal edge function with service key).
  IF caller IS NULL THEN
    IF caller_role = 'service_role' THEN
      RETURN EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = _user_id AND role = _role
      );
    END IF;
    RETURN false;
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