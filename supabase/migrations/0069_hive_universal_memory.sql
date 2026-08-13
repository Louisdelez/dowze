-- Mémoire universelle de la Ruche : la session d'exécution est jetable, les événements significatifs persistent.
-- Handoffs organisationnels et livraisons multi-canaux sont des objets de premier ordre, auditables de bout en bout.

alter table public.companion_agents
  add column if not exists role_contract jsonb not null default '{}'::jsonb;

create table if not exists public.hive_events (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  actor_agent_id uuid references public.companion_agents(id) on delete set null,
  subject_agent_id uuid references public.companion_agents(id) on delete set null,
  space text,
  kind text not null,
  channel text not null default 'system',
  visibility text not null default 'private',
  importance real not null default 0.5 check (importance between 0 and 1),
  content text not null,
  metadata jsonb not null default '{}'::jsonb,
  source_event_ids uuid[] not null default '{}',
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists hive_events_profile_time_idx
  on public.hive_events (profile_id, occurred_at desc);
create index if not exists hive_events_profile_kind_idx
  on public.hive_events (profile_id, kind, occurred_at desc);
create index if not exists hive_events_space_time_idx
  on public.hive_events (profile_id, space, occurred_at desc);
create index if not exists hive_events_actor_time_idx
  on public.hive_events (actor_agent_id, occurred_at desc);
create index if not exists hive_events_metadata_idx
  on public.hive_events using gin (metadata);

create table if not exists public.hive_handoffs (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  from_agent_id uuid references public.companion_agents(id) on delete set null,
  to_agent_id uuid references public.companion_agents(id) on delete set null,
  target_space text,
  original_request text not null,
  summarized_context text not null default '',
  source_event_ids uuid[] not null default '{}',
  urgency text not null default 'normal' check (urgency in ('low', 'normal', 'high', 'critical')),
  permissions jsonb not null default '{}'::jsonb,
  expected_next_action text,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'in_progress', 'completed', 'declined', 'cancelled', 'failed')),
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists hive_handoffs_profile_status_idx
  on public.hive_handoffs (profile_id, status, created_at desc);
create index if not exists hive_handoffs_to_status_idx
  on public.hive_handoffs (to_agent_id, status, created_at desc);

create table if not exists public.hive_deliveries (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  event_id uuid not null references public.hive_events(id) on delete cascade,
  companion_id uuid references public.companion_agents(id) on delete set null,
  channel text not null check (channel in ('direct', 'messages', 'email', 'push', 'voice', 'system')),
  rendered_content text not null,
  status text not null default 'queued'
    check (status in ('queued', 'sent', 'delivered', 'read', 'failed', 'cancelled')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  delivered_at timestamptz,
  read_at timestamptz
);

create index if not exists hive_deliveries_profile_time_idx
  on public.hive_deliveries (profile_id, created_at desc);
create index if not exists hive_deliveries_event_idx on public.hive_deliveries (event_id);

alter table public.hive_events enable row level security;
alter table public.hive_handoffs enable row level security;
alter table public.hive_deliveries enable row level security;

create policy "hive_events: propriétaire" on public.hive_events
  for all using (owns_profile(profile_id)) with check (owns_profile(profile_id));
create policy "hive_handoffs: propriétaire" on public.hive_handoffs
  for all using (owns_profile(profile_id)) with check (owns_profile(profile_id));
create policy "hive_deliveries: propriétaire" on public.hive_deliveries
  for all using (owns_profile(profile_id)) with check (owns_profile(profile_id));
