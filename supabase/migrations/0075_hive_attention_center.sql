-- Centre d'attention : seules les décisions, approbations et anomalies utiles remontent à l'humain.
create table if not exists public.hive_attention_items (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  source_event_id uuid references public.hive_events(id) on delete set null,
  requester_agent_id uuid references public.companion_agents(id) on delete set null,
  kind text not null check (kind in ('approval','decision','blocker','warning','information')),
  priority text not null default 'normal' check (priority in ('low','normal','high','critical')),
  title text not null,
  details text not null default '',
  options jsonb not null default '[]'::jsonb,
  context jsonb not null default '{}'::jsonb,
  status text not null default 'open' check (status in ('open','resolved','dismissed','expired')),
  resolution jsonb,
  due_at timestamptz,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists hive_attention_profile_status_idx on public.hive_attention_items(profile_id, status, priority, created_at desc);
alter table public.hive_attention_items enable row level security;
create policy "hive_attention_items: propriétaire" on public.hive_attention_items
  for all using (owns_profile(profile_id)) with check (owns_profile(profile_id));
