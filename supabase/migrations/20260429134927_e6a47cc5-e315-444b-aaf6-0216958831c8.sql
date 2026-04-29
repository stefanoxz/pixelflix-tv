CREATE TABLE public.demo_credentials (
  singleton boolean PRIMARY KEY DEFAULT true,
  server_url text NOT NULL DEFAULT '',
  username text NOT NULL DEFAULT '',
  password text NOT NULL DEFAULT '',
  enabled boolean NOT NULL DEFAULT false,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_by uuid,
  CONSTRAINT demo_credentials_singleton_check CHECK (singleton = true)
);

ALTER TABLE public.demo_credentials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read demo_credentials"
  ON public.demo_credentials
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins manage demo_credentials"
  ON public.demo_credentials
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

INSERT INTO public.demo_credentials (singleton, server_url, username, password, enabled)
VALUES (true, '', '', '', false)
ON CONFLICT (singleton) DO NOTHING;