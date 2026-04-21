-- Remover blocked_servers (substituído por allowlist)
DROP TABLE IF EXISTS public.blocked_servers;

-- Lista de DNS autorizadas
CREATE TABLE public.allowed_servers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  server_url TEXT NOT NULL UNIQUE,
  label TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_allowed_servers_url ON public.allowed_servers(server_url);

ALTER TABLE public.allowed_servers ENABLE ROW LEVEL SECURITY;