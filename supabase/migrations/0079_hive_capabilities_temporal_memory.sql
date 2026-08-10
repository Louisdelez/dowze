-- Compétences/capacités distinctes des agents et runtimes + temporalité explicite des connaissances.
create table if not exists public.hive_capabilities (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  key text not null,
  label text not null,
  description text not null default '',
  modality text not null default 'text',
  risk text not null default 'low' check (risk in ('low','medium','high','critical')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(profile_id, key)
);

create table if not exists public.hive_capability_bindings (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  capability_id uuid not null references public.hive_capabilities(id) on delete cascade,
  subject_kind text not null check (subject_kind in ('agent','runtime','tool','space')),
  subject_id text not null,
  proficiency real not null default 0.7 check (proficiency between 0 and 1),
  enabled boolean not null default true,
  constraints jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(profile_id, capability_id, subject_kind, subject_id)
);

alter table public.hive_memories
  add column if not exists memory_key text,
  add column if not exists valid_from timestamptz,
  add column if not exists valid_to timestamptz,
  add column if not exists supersedes_id uuid references public.hive_memories(id) on delete set null,
  add column if not exists entities jsonb not null default '[]'::jsonb;

create unique index if not exists hive_memories_active_key_idx
  on public.hive_memories(profile_id, scope, coalesce(scope_id, ''), memory_key)
  where status = 'active' and memory_key is not null;
create index if not exists hive_memories_temporal_idx
  on public.hive_memories(profile_id, memory_key, valid_from desc, valid_to desc);
create index if not exists hive_capabilities_profile_key_idx
  on public.hive_capabilities(profile_id, key);
create index if not exists hive_capability_bindings_subject_idx
  on public.hive_capability_bindings(profile_id, subject_kind, subject_id, enabled);

alter table public.hive_capabilities enable row level security;
alter table public.hive_capability_bindings enable row level security;
create policy "hive_capabilities: propriétaire" on public.hive_capabilities
  for all to authenticated using (public.owns_profile(profile_id)) with check (public.owns_profile(profile_id));
create policy "hive_capability_bindings: propriétaire" on public.hive_capability_bindings
  for all to authenticated using (public.owns_profile(profile_id)) with check (public.owns_profile(profile_id));

-- Rétro-indexation : les tableaux existants restent compatibles, le registre devient la vue normalisée.
insert into public.hive_capabilities(profile_id, key, label, modality)
select distinct r.profile_id,
  lower(regexp_replace(trim(c), '[^[:alnum:]]+', '-', 'g')),
  trim(c),
  coalesce(r.modalities[1], 'text')
from public.hive_runtimes r cross join lateral unnest(r.capabilities) c
where trim(c) <> ''
on conflict(profile_id, key) do nothing;

insert into public.hive_capability_bindings(profile_id, capability_id, subject_kind, subject_id, proficiency)
select r.profile_id, c.id, 'runtime', r.id::text, r.quality
from public.hive_runtimes r
cross join lateral unnest(r.capabilities) rc
join public.hive_capabilities c on c.profile_id = r.profile_id
  and c.key = lower(regexp_replace(trim(rc), '[^[:alnum:]]+', '-', 'g'))
on conflict(profile_id, capability_id, subject_kind, subject_id) do nothing;
