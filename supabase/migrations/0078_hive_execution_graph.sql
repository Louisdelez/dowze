-- Graphe d'exécution réel de la Ruche : une intention devient un run borné puis des tâches traçables.
create table if not exists public.hive_runs (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  root_event_id uuid references public.hive_events(id) on delete set null,
  initiator_agent_id uuid references public.companion_agents(id) on delete set null,
  objective text not null,
  status text not null default 'planning'
    check (status in ('planning','running','waiting_approval','completed','failed','cancelled')),
  max_depth integer not null default 4 check (max_depth between 1 and 12),
  max_fanout integer not null default 3 check (max_fanout between 1 and 20),
  max_tasks integer not null default 24 check (max_tasks between 1 and 500),
  max_runtime_seconds integer not null default 900 check (max_runtime_seconds between 10 and 86400),
  used_tasks integer not null default 0 check (used_tasks >= 0),
  metadata jsonb not null default '{}'::jsonb,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.hive_tasks (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.hive_runs(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  parent_task_id uuid references public.hive_tasks(id) on delete cascade,
  handoff_id uuid references public.hive_handoffs(id) on delete set null,
  assigned_agent_id uuid references public.companion_agents(id) on delete set null,
  depth integer not null default 0 check (depth between 0 and 12),
  sequence integer not null default 0,
  objective text not null,
  context jsonb not null default '{}'::jsonb,
  source_event_ids uuid[] not null default '{}',
  status text not null default 'pending'
    check (status in ('pending','accepted','running','waiting_approval','completed','failed','cancelled','skipped')),
  output text,
  error text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists hive_runs_profile_status_idx
  on public.hive_runs(profile_id, status, created_at desc);
create index if not exists hive_tasks_run_parent_idx
  on public.hive_tasks(run_id, parent_task_id, sequence);
create index if not exists hive_tasks_agent_status_idx
  on public.hive_tasks(assigned_agent_id, status, created_at desc);

alter table public.hive_runs enable row level security;
alter table public.hive_tasks enable row level security;
create policy "hive_runs: propriétaire" on public.hive_runs
  for all to authenticated using (public.owns_profile(profile_id)) with check (public.owns_profile(profile_id));
create policy "hive_tasks: propriétaire" on public.hive_tasks
  for all to authenticated using (public.owns_profile(profile_id)) with check (public.owns_profile(profile_id));
