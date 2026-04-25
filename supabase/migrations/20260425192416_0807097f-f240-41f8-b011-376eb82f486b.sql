CREATE TABLE IF NOT EXISTS public.pending_admin_signups (
  user_id uuid PRIMARY KEY,
  email text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.pending_admin_signups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read pending signups"
  ON public.pending_admin_signups
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Users read own pending"
  ON public.pending_admin_signups
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.handle_new_admin_signup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Bootstrap: se ainda não existe nenhum admin, o primeiro user vira admin
  -- automaticamente. Útil quando o banco é resetado/restaurado.
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') THEN
    INSERT INTO public.user_roles(user_id, role) VALUES (NEW.id, 'admin')
    ON CONFLICT DO NOTHING;
  ELSE
    -- Caso contrário, novo cadastro fica pendente até aprovação manual.
    INSERT INTO public.pending_admin_signups(user_id, email)
    VALUES (NEW.id, COALESCE(NEW.email, ''))
    ON CONFLICT (user_id) DO NOTHING;
  END IF;
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_admin_signup ON auth.users;
CREATE TRIGGER on_auth_user_created_admin_signup
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_admin_signup();