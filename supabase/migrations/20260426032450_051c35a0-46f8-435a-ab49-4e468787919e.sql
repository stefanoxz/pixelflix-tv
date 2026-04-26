-- 1) Permitir email NULL (vamos tratar no app); preferível a deixar string vazia
ALTER TABLE public.pending_admin_signups ALTER COLUMN email DROP NOT NULL;

-- 2) Trigger function mais robusto: tenta NEW.email, depois metadata
CREATE OR REPLACE FUNCTION public.handle_new_admin_signup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  resolved_email text;
BEGIN
  resolved_email := COALESCE(
    NULLIF(NEW.email, ''),
    NULLIF(NEW.raw_user_meta_data->>'email', ''),
    NULLIF(NEW.raw_app_meta_data->>'email', '')
  );

  -- Bootstrap: primeiro usuário vira admin automaticamente
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') THEN
    INSERT INTO public.user_roles(user_id, role) VALUES (NEW.id, 'admin')
    ON CONFLICT DO NOTHING;
  ELSE
    INSERT INTO public.pending_admin_signups(user_id, email)
    VALUES (NEW.id, resolved_email)
    ON CONFLICT (user_id) DO UPDATE
      SET email = COALESCE(NULLIF(EXCLUDED.email, ''), public.pending_admin_signups.email);
  END IF;
  RETURN NEW;
END
$function$;

-- 3) Backfill: preencher e-mails vazios dos 22 registros existentes a partir de auth.users
UPDATE public.pending_admin_signups p
SET email = COALESCE(
  NULLIF(u.email::text, ''),
  NULLIF(u.raw_user_meta_data->>'email', ''),
  NULLIF(u.raw_app_meta_data->>'email', ''),
  p.email
)
FROM auth.users u
WHERE p.user_id = u.id
  AND (p.email IS NULL OR p.email = '');