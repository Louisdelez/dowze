-- État opérationnel des compagnons et scheduler matériel séparé de l'interface isométrique.
create table if not exists public.hive_companion_states (
  agent_id uuid primary key references public.companion_agents(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  availability text not null default 'available'
    check (availability in ('available','busy','away','sleeping','offline')),
  activity text not null default 'idle',
  relationship_state text not null default 'neutral',
  current_task_id uuid references public.hive_tasks(id) on delete set null,
  urgency text not null default 'normal' check (urgency in ('low','normal','high','critical')),
  visual_mood text not null default 'neutral',
  location text,
  metadata jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.hive_compute_resources (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  asset_id uuid references public.hive_assets(id) on delete set null,
  name text not null,
  kind text not null check (kind in ('cpu','gpu','npu','remote_api')),
  locality text not null default 'local' check (locality in ('local','private_cloud','public_cloud')),
  modalities text[] not null default '{text}',
  memory_mb integer not null default 0 check (memory_mb >= 0),
  accelerator_memory_mb integer not null default 0 check (accelerator_memory_mb >= 0),
  max_concurrency integer not null default 1 check (max_concurrency between 1 and 10000),
  active_allocations integer not null default 0 check (active_allocations >= 0),
  cost_per_hour real not null default 0 check (cost_per_hour >= 0),
  health text not null default 'unknown' check (health in ('healthy','degraded','offline','unknown')),
  enabled boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.hive_compute_allocations (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  resource_id uuid not null references public.hive_compute_resources(id) on delete cascade,
  task_id uuid not null references public.hive_tasks(id) on delete cascade,
  status text not null default 'reserved' check (status in ('reserved','running','released','failed')),
  requirements jsonb not null default '{}'::jsonb,
  started_at timestamptz,
  released_at timestamptz,
  created_at timestamptz not null default now(),
  unique(resource_id, task_id)
);

create index if not exists hive_companion_states_profile_idx on public.hive_companion_states(profile_id, availability);
create index if not exists hive_compute_resources_profile_idx on public.hive_compute_resources(profile_id, health, enabled);
create index if not exists hive_compute_allocations_task_idx on public.hive_compute_allocations(task_id, status);

alter table public.hive_companion_states enable row level security;
alter table public.hive_compute_resources enable row level security;
alter table public.hive_compute_allocations enable row level security;
create policy "hive_companion_states: propriétaire" on public.hive_companion_states for all to authenticated
  using (public.owns_profile(profile_id)) with check (public.owns_profile(profile_id));
create policy "hive_compute_resources: propriétaire" on public.hive_compute_resources for all to authenticated
  using (public.owns_profile(profile_id)) with check (public.owns_profile(profile_id));
create policy "hive_compute_allocations: propriétaire" on public.hive_compute_allocations for all to authenticated
  using (public.owns_profile(profile_id)) with check (public.owns_profile(profile_id));
