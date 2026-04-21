-- Tabela de eventos de login (telemetria)
CREATE TABLE public.login_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  server_url TEXT NOT NULL,
  username TEXT NOT NULL,
  success BOOLEAN NOT NULL DEFAULT true,
  reason TEXT,
  user_agent TEXT,
  ip_address TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_login_events_created_at ON public.login_events(created_at DESC);
CREATE INDEX idx_login_events_server ON public.login_events(server_url);
CREATE INDEX idx_login_events_username ON public.login_events(username);

-- Tabela de servidores bloqueados
CREATE TABLE public.blocked_servers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  server_url TEXT NOT NULL UNIQUE,
  reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_blocked_servers_url ON public.blocked_servers(server_url);

-- RLS: ativado, mas sem políticas públicas — só edge functions com service role acessam
ALTER TABLE public.login_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blocked_servers ENABLE ROW LEVEL SECURITY;

-- Função utilitária para normalizar URL de servidor (sem barra final, lowercase)
CREATE OR REPLACE FUNCTION public.normalize_server_url(url TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT lower(regexp_replace(trim(url), '/+$', ''));
$$;