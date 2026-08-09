-- Test de placement adaptatif : une session par tentative, l'état (historique
-- Q/R + bornes de la recherche dichotomique) vit dans `state`.
create table if not exists public.placement_sessions (
  id            uuid primary key default gen_random_uuid(),
  profile_id    uuid not null references public.profiles(id) on delete cascade,
  state         jsonb not null,
  status        text not null default 'en-cours',
  entry_skill_id uuid,
  created_at    timestamptz not null default now()
);

create index if not exists idx_placement_sessions_profile on public.placement_sessions(profile_id);

alter table public.placement_sessions enable row level security;

create policy placement_sessions_owner on public.placement_sessions
  for all using (owns_profile(profile_id)) with check (owns_profile(profile_id));
