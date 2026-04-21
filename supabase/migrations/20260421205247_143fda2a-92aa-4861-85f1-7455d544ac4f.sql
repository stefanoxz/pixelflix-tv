-- Roles enum
create type public.app_role as enum ('admin', 'user');

-- user_roles table (separate from any profile table)
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);

alter table public.user_roles enable row level security;

-- security-definer function to avoid recursive RLS
create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role = _role
  )
$$;

-- Policies on user_roles
create policy "Users can read own roles"
  on public.user_roles
  for select
  to authenticated
  using (user_id = auth.uid());

create policy "Admins can read all roles"
  on public.user_roles
  for select
  to authenticated
  using (public.has_role(auth.uid(), 'admin'));

create policy "Admins can manage roles"
  on public.user_roles
  for all
  to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

-- Enable RLS on admin tables (currently unprotected)
alter table public.allowed_servers enable row level security;
alter table public.login_events enable row level security;

create policy "Admins manage allowed_servers"
  on public.allowed_servers
  for all
  to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

create policy "Admins read login_events"
  on public.login_events
  for select
  to authenticated
  using (public.has_role(auth.uid(), 'admin'));