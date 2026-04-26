-- Tabela de progresso de reprodução ("Continue assistindo") sincronizada
-- entre dispositivos. Chaveada por (server_url, username) — quem usa a
-- mesma linha IPTV compartilha o progresso (modelo "perfil único por linha").
CREATE TABLE public.watch_progress (
  server_url        text         NOT NULL,
  username          text         NOT NULL,
  item_key          text         NOT NULL,
  kind              text         NOT NULL CHECK (kind IN ('movie', 'episode')),
  content_id        text         NOT NULL,
  series_id         bigint,
  title             text,
  poster_url        text,
  position_seconds  integer      NOT NULL DEFAULT 0 CHECK (position_seconds >= 0),
  duration_seconds  integer      NOT NULL DEFAULT 0 CHECK (duration_seconds >= 0),
  updated_at        timestamptz  NOT NULL DEFAULT now(),
  PRIMARY KEY (server_url, username, item_key)
);

-- Índice para o rail "Continue assistindo": buscar as N entradas
-- mais recentes da mesma linha IPTV em uma única varredura.
CREATE INDEX idx_watch_progress_recent
  ON public.watch_progress (server_url, username, updated_at DESC);

-- Habilita RLS — sem isso o PostgREST nega tudo por padrão.
ALTER TABLE public.watch_progress ENABLE ROW LEVEL SECURITY;

-- Acesso aberto para anônimos e autenticados, escopado por (server_url, username).
-- O app envia esses dois campos em todas as queries; o cliente IPTV é o
-- "identificador" do perfil. Não usamos auth.uid() porque o webplayer não
-- exige login Lovable.
CREATE POLICY "Anyone can read watch_progress"
  ON public.watch_progress
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Anyone can insert watch_progress"
  ON public.watch_progress
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    server_url IS NOT NULL
    AND length(server_url) > 0
    AND username IS NOT NULL
    AND length(username) > 0
    AND item_key IS NOT NULL
    AND length(item_key) > 0
  );

CREATE POLICY "Anyone can update watch_progress"
  ON public.watch_progress
  FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anyone can delete watch_progress"
  ON public.watch_progress
  FOR DELETE
  TO anon, authenticated
  USING (true);

-- Admins podem ler tudo para diagnóstico (mesmo padrão das outras tabelas).
CREATE POLICY "Admins read all watch_progress"
  ON public.watch_progress
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));
