-- 0044 — Planning refait : profil de disponibilité (preset) + vacances. L'emploi du temps hebdomadaire
-- est GÉNÉRÉ de façon déterministe par le moteur de Dowze (cf. @dowze/core weekly-schedule), pas stocké.
-- Recherche 2026 : espacement (Cepeda), profils/andragogie (Knowles, presets nommés + défaut intelligent),
-- régularité > intensité, jour de repos, remplissage ≤ 80 %, vacances = maintenance (streak gelé).

-- Le profil de disponibilité de l'apprenant (au plus un). Autonomie encadrée : on part d'un preset.
create table if not exists public.learner_schedule (
  profile_id    uuid primary key references public.profiles(id) on delete cascade,
  preset        text not null default 'leger',            -- plein-temps|matinee|apres-midi|soir|weekend|leger|sur-mesure
  active_days   integer[] not null default '{1,2,3,4,5}', -- 0=dim … 6=sam
  day_start_min integer not null default 480,             -- 08:00
  day_end_min   integer not null default 1080,            -- 18:00
  intensity     text not null default 'moyen',            -- leger|moyen|soutenu
  updated_at    timestamptz not null default now()
);

-- Périodes de vacances / pauses longues (le quota « OFF »). Pendant, tout devient facultatif.
create table if not exists public.schedule_vacations (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid not null references public.profiles(id) on delete cascade,
  start_date  date not null,
  end_date    date not null,
  label       text not null default 'Vacances',
  created_at  timestamptz not null default now()
);
create index if not exists schedule_vacations_profile_idx on public.schedule_vacations (profile_id);
