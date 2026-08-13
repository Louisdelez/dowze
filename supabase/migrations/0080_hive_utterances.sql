-- Couche de communication humaine : faits séparés du rendu, prosodie, animation et interruption.
create table if not exists public.hive_utterances (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  event_id uuid not null references public.hive_events(id) on delete cascade,
  delivery_id uuid references public.hive_deliveries(id) on delete set null,
  companion_id uuid references public.companion_agents(id) on delete set null,
  channel text not null,
  intent text not null default 'inform',
  facts jsonb not null default '[]'::jsonb,
  emotion text not null default 'neutral',
  confidence real not null default 0.7 check (confidence between 0 and 1),
  prosody jsonb not null default '{}'::jsonb,
  animation text,
  state text not null default 'ready'
    check (state in ('acknowledge','thinking','ready','speaking','interrupted','completed','failed')),
  interrupted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists hive_utterances_profile_time_idx
  on public.hive_utterances(profile_id, created_at desc);
create index if not exists hive_utterances_event_idx on public.hive_utterances(event_id);

alter table public.hive_utterances enable row level security;
create policy "hive_utterances: propriétaire" on public.hive_utterances
  for all to authenticated using (public.owns_profile(profile_id)) with check (public.owns_profile(profile_id));
