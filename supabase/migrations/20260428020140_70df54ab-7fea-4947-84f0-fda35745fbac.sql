-- Tabela principal de DNS bloqueados (catálogo)
CREATE TABLE public.blocked_dns_servers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  server_url text NOT NULL UNIQUE,
  label text,
  provider_name text,
  block_type text NOT NULL DEFAULT 'anti_datacenter',
  status text NOT NULL DEFAULT 'suggested',
  notes text,
  evidence jsonb,
  failure_count integer NOT NULL DEFAULT 0,
  distinct_ip_count integer NOT NULL DEFAULT 0,
  first_detected_at timestamptz,
  last_detected_at timestamptz,
  confirmed_at timestamptz,
  dismissed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT blocked_dns_status_check CHECK (status IN ('suggested', 'confirmed', 'dismissed')),
  CONSTRAINT blocked_dns_block_type_check CHECK (block_type IN ('anti_datacenter', 'geoblock', 'waf', 'dns_error', 'outro'))
);

CREATE INDEX idx_blocked_dns_status ON public.blocked_dns_servers(status);
CREATE INDEX idx_blocked_dns_url ON public.blocked_dns_servers(server_url);

ALTER TABLE public.blocked_dns_servers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage blocked_dns_servers"
  ON public.blocked_dns_servers
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Moderators read blocked_dns_servers"
  ON public.blocked_dns_servers
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'moderator'));

-- Tabela auxiliar — janela rolante de falhas pra alimentar detecção automática
CREATE TABLE public.blocked_dns_failures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  server_url text NOT NULL,
  error_kind text NOT NULL,
  ip_hash text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_blocked_dns_failures_server_created ON public.blocked_dns_failures(server_url, created_at DESC);

ALTER TABLE public.blocked_dns_failures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read blocked_dns_failures"
  ON public.blocked_dns_failures
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Função de cleanup (remove falhas > 48h)
CREATE OR REPLACE FUNCTION public.cleanup_blocked_dns_failures()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE removed integer;
BEGIN
  WITH del AS (
    DELETE FROM public.blocked_dns_failures
    WHERE created_at < now() - interval '48 hours'
    RETURNING 1
  ) SELECT count(*) INTO removed FROM del;
  RETURN removed;
END $function$;

-- Trigger pra updated_at em blocked_dns_servers
CREATE OR REPLACE FUNCTION public.update_blocked_dns_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_blocked_dns_updated_at
  BEFORE UPDATE ON public.blocked_dns_servers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_blocked_dns_updated_at();