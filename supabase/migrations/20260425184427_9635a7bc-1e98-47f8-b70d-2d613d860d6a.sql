create table public.client_diagnostics (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  login_event_id uuid null references public.login_events(id) on delete set null,
  username text null,
  server_url text null,
  outcome text not null,
  client_error text null,
  duration_ms integer null,
  ip text null,
  user_agent text null,
  effective_type text null,
  downlink_mbps numeric null,
  rtt_ms integer null,
  save_data boolean null,
  device_memory numeric null,
  hardware_concurrency integer null,
  screen text null,
  language text null,
  timezone text null,
  country text null,
  region text null,
  city text null,
  isp text null,
  speed_kbps integer null
);

alter table public.client_diagnostics enable row level security;

create policy "Admins read diagnostics"
  on public.client_diagnostics for select to authenticated
  using (has_role(auth.uid(), 'admin'::app_role));

create index client_diagnostics_created_at_idx
  on public.client_diagnostics (created_at desc);
create index client_diagnostics_outcome_idx
  on public.client_diagnostics (outcome);