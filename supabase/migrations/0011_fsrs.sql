-- Révision espacée FSRS (Free Spaced Repetition Scheduler) — remplace SM-2 comme
-- planificateur de référence. Modèle Difficulté / Stabilité / Rétrievabilité :
-- ~20-30 % de révisions en moins à rétention égale. Voir docs/10-APP-WEB/16-…
create table if not exists public.fsrs_cards (
  profile_id     uuid not null references public.profiles (id) on delete cascade,
  skill_id       uuid not null references public.skills (id) on delete cascade,
  due            timestamptz not null,
  stability      double precision not null default 0,
  difficulty     double precision not null default 0,
  elapsed_days   integer not null default 0,
  scheduled_days integer not null default 0,
  reps           integer not null default 0,
  lapses         integer not null default 0,
  state          smallint not null default 0,   -- 0 New | 1 Learning | 2 Review | 3 Relearning
  last_review    timestamptz,
  primary key (profile_id, skill_id)
);

create index if not exists fsrs_cards_due_idx on public.fsrs_cards (profile_id, due);

alter table public.fsrs_cards enable row level security;
