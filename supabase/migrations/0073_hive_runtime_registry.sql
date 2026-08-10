-- Registre ouvert des couples modèle + harness + adaptateur exécutables par la Ruche.
create table if not exists public.hive_runtimes (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  model text not null,
  harness text not null,
  adapter text not null check (adapter in ('copilote','relay_mcp','external')),
  modalities text[] not null default '{text}',
  capabilities text[] not null default '{}',
  quality real not null default 0.7 check (quality between 0 and 1),
  cost real not null default 0.5 check (cost between 0 and 1),
  latency real not null default 0.5 check (latency between 0 and 1),
  privacy text not null default 'public_cloud' check (privacy in ('local','private_cloud','public_cloud')),
  entitlement text not null default 'metered' check (entitlement in ('included','subscription','metered')),
  enabled boolean not null default true,
  configuration jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(profile_id, name)
);
create index if not exists hive_runtimes_profile_enabled_idx on public.hive_runtimes(profile_id, enabled);
alter table public.hive_runtimes enable row level security;
create policy "hive_runtimes: propriétaire" on public.hive_runtimes
  for all using (owns_profile(profile_id)) with check (owns_profile(profile_id));
