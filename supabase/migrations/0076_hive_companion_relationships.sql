-- Relation durable humain-compagnon, distincte de la personnalité et de l'humeur instantanée.
create table if not exists public.hive_companion_relationships (
  agent_id uuid primary key references public.companion_agents(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  affinity real not null default 0.3 check (affinity between 0 and 1),
  trust real not null default 0.3 check (trust between 0 and 1),
  familiarity real not null default 0.1 check (familiarity between 0 and 1),
  interaction_count integer not null default 0,
  last_interaction_at timestamptz,
  updated_at timestamptz not null default now()
);
create index if not exists hive_relationships_profile_idx on public.hive_companion_relationships(profile_id, affinity desc);
alter table public.hive_companion_relationships enable row level security;
create policy "hive_companion_relationships: propriétaire" on public.hive_companion_relationships
  for all using (owns_profile(profile_id)) with check (owns_profile(profile_id));
