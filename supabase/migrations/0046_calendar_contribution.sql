-- 0046 — Contribution au planning (P2) : « source + projection ».
-- Un plugin déclare une ACTIVITÉ RÉCURRENTE (ex. sport 3×/sem) ou une ENTRÉE PONCTUELLE (match, événement).
-- Le cœur orchestre le récurrent DÉTERMINISTEMENT (cf. @dowze/core weeklySchedule, généré à la volée, non
-- stocké) et projette les entrées ponctuelles dans une table de référence. Le plugin garde sa séance
-- complète (son schéma) ; le cœur ne détient qu'une référence + les invariants. Cf. docs/12-PLUGINS/02.

-- Déclarations d'activités récurrentes des plugins (le cœur les orchestre à la volée avec l'étude).
create table if not exists public.recurring_commitments (
  id                 uuid primary key default gen_random_uuid(),
  profile_id         uuid not null references public.profiles(id) on delete cascade,
  source_app         text not null,                        -- 'fitness' (slug plugin)
  source_ref         text not null,                        -- id de la ressource côté plugin (ownership)
  type               text not null,                        -- 'fitness.workout' (déclaré dans contributes)
  title              text not null,                        -- libellé générique (pas de détail santé)
  frequency_per_week integer not null default 3,
  duration_min       integer not null default 50,
  intensity          text not null default 'moderee',      -- legere|moderee|intense
  hard_constraints   jsonb not null default '{}'::jsonb,   -- minRecoveryHoursSameType, minRestDaysPerWeek, weeklyCapMin, notBefore
  soft_preferences   jsonb not null default '{}'::jsonb,   -- preferredTime, stackAfter, cognitiveBoostBeforeStudy
  priority           integer not null default 50,          -- l'étude reste le socle
  miss_policy        jsonb not null default '{"catchUp":true,"windowDays":3}'::jsonb,
  adherence_metric   text not null default 'rolling-regularity',
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (profile_id, source_app, source_ref)
);
create index if not exists recurring_commitments_profile_idx on public.recurring_commitments (profile_id);

-- Entrées ponctuelles projetées (match, événement à date fixe) — la référence du cœur.
create table if not exists public.calendar_entries (
  id           uuid primary key default gen_random_uuid(),
  profile_id   uuid not null references public.profiles(id) on delete cascade,
  source_app   text not null,
  source_ref   text not null,
  entry_type   text not null,                              -- 'sports.event'…
  title        text not null,
  start_at     timestamptz not null,
  duration_min integer not null default 60,
  scope        text not null default 'calendar:write',
  status       text not null default 'confirmed',          -- confirmed|tentative|cancelled
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (source_app, source_ref)
);
create index if not exists calendar_entries_profile_idx on public.calendar_entries (profile_id, start_at);
