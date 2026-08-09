-- 0048 — Plugins SPORTS & ALIMENTATION (P5) : enregistrement au registre + schémas propres (RLS).
-- Réplication du patron Fitness (0045/0047). Garde-fous ALIMENTATION : régularité/meal-prep seulement,
-- JAMAIS de comptage calorique ni de conseil médical (pas de scope health:write).

-- ── Registre ───────────────────────────────────────────────────────────────
insert into public.plugin_registry
  (slug, name, subdomain, description, status, min_core_version, scopes_requested, scopes_optional, contributes, subscribes, config_schema)
values
(
  'sports', 'Dowze Sports', 'sports.dowze.ch',
  'La pratique d''un sport — entraînements réguliers et matchs, intégrés au planning.',
  'active', '3.0.0',
  '{profile:read,calendar:read,calendar:write}',
  '{ai:infer,xp:write}',
  jsonb_build_object('calendarEntryTypes', jsonb_build_array(
    jsonb_build_object('type','sports.training','label','Entraînement','color','sky','icon','zap'),
    jsonb_build_object('type','sports.event','label','Match','color','sky','icon','trophy')
  ), 'navTiles', jsonb_build_array()),
  '{}',
  jsonb_build_object('type','object','properties', jsonb_build_object(
    'discipline', jsonb_build_object('type','string','default','course'),
    'frequencyPerWeek', jsonb_build_object('type','integer','minimum',1,'maximum',6,'default',3)
  ))
),
(
  'alimentations', 'Dowze Alimentation', 'alimentations.dowze.ch',
  'Une alimentation régulière et planifiée — repas à heures stables et meal-prep. Jamais de comptage.',
  'active', '3.0.0',
  '{profile:read,calendar:read,calendar:write}',
  '{ai:infer}',
  jsonb_build_object('calendarEntryTypes', jsonb_build_array(
    jsonb_build_object('type','alimentation.meal','label','Repas','color','amber','icon','utensils'),
    jsonb_build_object('type','alimentation.prep','label','Meal-prep','color','amber','icon','chef-hat')
  ), 'navTiles', jsonb_build_array()),
  '{}',
  jsonb_build_object('type','object','properties', jsonb_build_object(
    'mealsPerDay', jsonb_build_object('type','integer','minimum',1,'maximum',5,'default',3),
    'prepPerWeek', jsonb_build_object('type','integer','minimum',0,'maximum',3,'default',1)
  ))
)
on conflict (slug) do nothing;

-- ── Fonction utilitaire RLS : le profil appartient-il à l'utilisateur courant ? ──
create or replace function public.owns_profile(pid uuid) returns boolean
language sql stable security invoker as $$
  select exists (
    select 1 from public.profiles p
    join public.accounts a on a.id = p.account_id
    where p.id = pid and a.auth_user_id = auth.uid()
  );
$$;

-- ── Schéma SPORTS : journal d'entraînement (les matchs = entrées ponctuelles calendar_entries) ──
create table if not exists public.sports_sessions (
  id         uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  discipline text not null default '',
  title      text not null default 'Entraînement',
  summary    text not null default '',
  snapshot   jsonb not null default '{}'::jsonb,
  done_at    timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists sports_sessions_profile_idx on public.sports_sessions (profile_id, done_at desc);
alter table public.sports_sessions enable row level security;
drop policy if exists sports_sessions_select on public.sports_sessions;
create policy sports_sessions_select on public.sports_sessions for select to authenticated using (public.owns_profile(profile_id));
drop policy if exists sports_sessions_insert on public.sports_sessions;
create policy sports_sessions_insert on public.sports_sessions for insert to authenticated with check (public.owns_profile(profile_id));
drop policy if exists sports_sessions_delete on public.sports_sessions;
create policy sports_sessions_delete on public.sports_sessions for delete to authenticated using (public.owns_profile(profile_id));

-- ── Schéma ALIMENTATION : journal repas/meal-prep (aucune donnée médicale, aucune calorie) ──
create table if not exists public.alimentation_entries (
  id         uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  kind       text not null default 'meal',   -- meal | prep
  title      text not null default 'Repas',
  summary    text not null default '',
  snapshot   jsonb not null default '{}'::jsonb,
  done_at    timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists alimentation_entries_profile_idx on public.alimentation_entries (profile_id, done_at desc);
alter table public.alimentation_entries enable row level security;
drop policy if exists alimentation_entries_select on public.alimentation_entries;
create policy alimentation_entries_select on public.alimentation_entries for select to authenticated using (public.owns_profile(profile_id));
drop policy if exists alimentation_entries_insert on public.alimentation_entries;
create policy alimentation_entries_insert on public.alimentation_entries for insert to authenticated with check (public.owns_profile(profile_id));
drop policy if exists alimentation_entries_delete on public.alimentation_entries;
create policy alimentation_entries_delete on public.alimentation_entries for delete to authenticated using (public.owns_profile(profile_id));
