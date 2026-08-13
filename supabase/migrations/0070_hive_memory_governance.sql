-- Gouvernance et consolidation de la mémoire universelle : préférences, faits dérivés et oubli sélectif.

create table if not exists public.hive_memory_policies (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  cross_space_enabled boolean not null default false,
  personal_data_enabled boolean not null default false,
  proactive_memory_enabled boolean not null default true,
  retention_days integer check (retention_days is null or retention_days between 1 and 3650),
  updated_at timestamptz not null default now()
);

create table if not exists public.hive_memories (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  scope text not null default 'profile' check (scope in ('profile', 'space', 'agent')),
  scope_id text,
  category text not null,
  content text not null,
  source_event_ids uuid[] not null default '{}',
  confidence real not null default 0.7 check (confidence between 0 and 1),
  status text not null default 'active' check (status in ('active', 'superseded', 'forgotten')),
  metadata jsonb not null default '{}'::jsonb,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists hive_memories_profile_scope_idx
  on public.hive_memories (profile_id, scope, scope_id, status, updated_at desc);
create index if not exists hive_memories_sources_idx
  on public.hive_memories using gin (source_event_ids);

alter table public.hive_memory_policies enable row level security;
alter table public.hive_memories enable row level security;
create policy "hive_memory_policies: propriétaire" on public.hive_memory_policies
  for all using (owns_profile(profile_id)) with check (owns_profile(profile_id));
create policy "hive_memories: propriétaire" on public.hive_memories
  for all using (owns_profile(profile_id)) with check (owns_profile(profile_id));
