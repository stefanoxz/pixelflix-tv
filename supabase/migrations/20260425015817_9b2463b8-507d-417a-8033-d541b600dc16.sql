ALTER TABLE public.allowed_servers
  ADD COLUMN IF NOT EXISTS last_working_variant text,
  ADD COLUMN IF NOT EXISTS last_working_at timestamptz,
  ADD COLUMN IF NOT EXISTS consecutive_failures integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS unreachable_until timestamptz;

CREATE INDEX IF NOT EXISTS idx_allowed_servers_unreachable_until
  ON public.allowed_servers (unreachable_until)
  WHERE unreachable_until IS NOT NULL;