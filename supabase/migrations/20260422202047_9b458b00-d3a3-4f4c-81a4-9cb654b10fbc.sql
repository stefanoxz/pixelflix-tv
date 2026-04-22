-- =========================================
-- active_sessions
-- =========================================
create table if not exists public.active_sessions (
  id uuid primary key default gen_random_uuid(),
  anon_user_id uuid not null unique,
  iptv_username text,
  ip text,
  ua_hash text,
  started_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create index if not exists idx_active_sessions_last_seen on public.active_sessions(last_seen_at);
create index if not exists idx_active_sessions_iptv_user on public.active_sessions(iptv_username);

alter table public.active_sessions enable row level security;

create policy "Users read own session"
  on public.active_sessions for select
  to authenticated
  using (anon_user_id = auth.uid());

create policy "Admins read all sessions"
  on public.active_sessions for select
  to authenticated
  using (has_role(auth.uid(), 'admin'::app_role));

create policy "Users delete own session"
  on public.active_sessions for delete
  to authenticated
  using (anon_user_id = auth.uid());

create policy "Admins manage sessions"
  on public.active_sessions for all
  to authenticated
  using (has_role(auth.uid(), 'admin'::app_role))
  with check (has_role(auth.uid(), 'admin'::app_role));

-- =========================================
-- used_nonces (server-only)
-- =========================================
create table if not exists public.used_nonces (
  nonce text primary key,
  used_at timestamptz not null default now()
);

create index if not exists idx_used_nonces_used_at on public.used_nonces(used_at);

alter table public.used_nonces enable row level security;
-- no policies => only service role can access

-- =========================================
-- usage_counters
-- =========================================
create table if not exists public.usage_counters (
  anon_user_id uuid not null,
  window_start timestamptz not null,
  request_count integer not null default 0,
  segment_count integer not null default 0,
  primary key (anon_user_id, window_start)
);

create index if not exists idx_usage_counters_window on public.usage_counters(window_start);

alter table public.usage_counters enable row level security;

create policy "Users read own usage"
  on public.usage_counters for select
  to authenticated
  using (anon_user_id = auth.uid());

create policy "Admins read all usage"
  on public.usage_counters for select
  to authenticated
  using (has_role(auth.uid(), 'admin'::app_role));

-- =========================================
-- user_blocks
-- =========================================
create table if not exists public.user_blocks (
  anon_user_id uuid primary key,
  blocked_until timestamptz not null,
  reason text,
  created_at timestamptz not null default now()
);

create index if not exists idx_user_blocks_until on public.user_blocks(blocked_until);

alter table public.user_blocks enable row level security;

create policy "Users read own block"
  on public.user_blocks for select
  to authenticated
  using (anon_user_id = auth.uid());

create policy "Admins manage blocks"
  on public.user_blocks for all
  to authenticated
  using (has_role(auth.uid(), 'admin'::app_role))
  with check (has_role(auth.uid(), 'admin'::app_role));

-- =========================================
-- stream_events
-- =========================================
create table if not exists public.stream_events (
  id uuid primary key default gen_random_uuid(),
  anon_user_id uuid,
  event_type text not null,
  ip text,
  ua_hash text,
  url_hash text,
  meta jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_stream_events_created on public.stream_events(created_at desc);
create index if not exists idx_stream_events_user on public.stream_events(anon_user_id, created_at desc);
create index if not exists idx_stream_events_type on public.stream_events(event_type, created_at desc);

alter table public.stream_events enable row level security;

create policy "Users read own events"
  on public.stream_events for select
  to authenticated
  using (anon_user_id = auth.uid());

create policy "Admins read all events"
  on public.stream_events for select
  to authenticated
  using (has_role(auth.uid(), 'admin'::app_role));