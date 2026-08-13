-- Coffre de la Ruche : secrets chiffrés côté application et accès éphémères à usage unique.

create table if not exists public.hive_vault_items (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  space text,
  label text not null,
  kind text not null default 'secret',
  ciphertext text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.hive_access_requests (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  vault_item_id uuid not null references public.hive_vault_items(id) on delete cascade,
  requester_agent_id uuid references public.companion_agents(id) on delete set null,
  purpose text not null,
  requested_seconds integer not null check (requested_seconds between 60 and 86400),
  status text not null default 'pending' check (status in ('pending','approved','denied','revoked','expired','consumed')),
  decision_reason text,
  token_hash text unique,
  expires_at timestamptz,
  decided_at timestamptz,
  consumed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists hive_vault_items_profile_idx on public.hive_vault_items(profile_id, space, created_at desc);
create index if not exists hive_access_requests_profile_status_idx on public.hive_access_requests(profile_id, status, created_at desc);

alter table public.hive_vault_items enable row level security;
alter table public.hive_access_requests enable row level security;
create policy "hive_vault_items: propriétaire" on public.hive_vault_items
  for all using (owns_profile(profile_id)) with check (owns_profile(profile_id));
create policy "hive_access_requests: propriétaire" on public.hive_access_requests
  for all using (owns_profile(profile_id)) with check (owns_profile(profile_id));
