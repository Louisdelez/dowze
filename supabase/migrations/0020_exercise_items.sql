-- Items d'exercices générés (cache + futur suivi psychométrique). Non spécifiques
-- à un élève : réutilisables. Accès backend (service_role).
create table if not exists public.exercise_items (
  id         uuid primary key default gen_random_uuid(),
  skill_id   uuid not null references public.skills(id) on delete cascade,
  type       text not null,
  payload    jsonb not null,
  source_ref text not null default '',
  difficulty integer,
  created_at timestamptz not null default now()
);

create index if not exists idx_exercise_items_skill on public.exercise_items(skill_id);
