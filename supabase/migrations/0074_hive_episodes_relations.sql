-- Projections des abeilles bibliothécaires : épisodes temporels et relations de mandat.
create table if not exists public.hive_episodes (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  fingerprint text not null,
  space text,
  title text not null,
  summary text not null,
  source_event_ids uuid[] not null default '{}',
  started_at timestamptz not null,
  ended_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique(profile_id, fingerprint)
);

create table if not exists public.hive_memory_relations (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  source_handoff_id uuid references public.hive_handoffs(id) on delete set null,
  subject_kind text not null,
  subject_id text,
  predicate text not null,
  object_kind text not null,
  object_id text,
  description text not null,
  source_event_ids uuid[] not null default '{}',
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique(profile_id, source_handoff_id, predicate)
);

create index if not exists hive_episodes_profile_time_idx on public.hive_episodes(profile_id, started_at desc);
create index if not exists hive_relations_profile_subject_idx on public.hive_memory_relations(profile_id, subject_kind, subject_id, occurred_at desc);
alter table public.hive_episodes enable row level security;
alter table public.hive_memory_relations enable row level security;
create policy "hive_episodes: propriétaire" on public.hive_episodes
  for all using (owns_profile(profile_id)) with check (owns_profile(profile_id));
create policy "hive_memory_relations: propriétaire" on public.hive_memory_relations
  for all using (owns_profile(profile_id)) with check (owns_profile(profile_id));
