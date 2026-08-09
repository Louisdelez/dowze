-- Tamagotchi du compagnon : état de soin par compte. Les jauges (0..100) décroissent en TEMPS RÉEL —
-- on ne stocke que l'état + `last_tick` ; la décroissance est recalculée au timestamp à chaque lecture/action
-- (pas de cron). born_at = pour l'âge. Non-punitif : pas de mort permanente (négligé → triste/malade, réveillable).
create table if not exists public.pet_care (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  satiety   integer not null default 80,   -- satiété (faim inversée)
  happiness integer not null default 80,   -- bonheur
  energy    integer not null default 80,   -- énergie / sommeil
  hygiene   integer not null default 80,   -- propreté
  health    integer not null default 90,   -- santé
  born_at   timestamptz not null default now(),
  last_tick timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
