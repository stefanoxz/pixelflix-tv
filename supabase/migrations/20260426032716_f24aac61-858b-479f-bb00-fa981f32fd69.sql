-- Trigger atualizado: ignorar contas anônimas (signInAnonymously)
CREATE OR REPLACE FUNCTION public.handle_new_admin_signup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  resolved_email text;
BEGIN
  -- Visitantes anônimos do webplayer (signInAnonymously) NÃO são cadastros admin.
  IF COALESCE(NEW.is_anonymous, false) THEN
    RETURN NEW;
  END IF;

  resolved_email := COALESCE(
    NULLIF(NEW.email, ''),
    NULLIF(NEW.raw_user_meta_data->>'email', ''),
    NULLIF(NEW.raw_app_meta_data->>'email', '')
  );

  -- Bootstrap: primeiro admin não-anônimo vira admin automaticamente
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

-- Limpa cadastros pendentes que correspondem a usuários anônimos (lixo)
DELETE FROM public.pending_admin_signups p
USING auth.users u
WHERE p.user_id = u.id
  AND COALESCE(u.is_anonymous, false) = true;

-- Limpa também órfãos: pending sem usuário correspondente em auth.users
DELETE FROM public.pending_admin_signups p
WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = p.user_id);