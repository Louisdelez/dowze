-- Mémoire d'apprentissage : erreurs/confusions récurrentes (« misconceptions ») par
-- compétence. Extraites du résumé de séance par le Copilote, réconciliées (add/incrémente/
-- résout) au lieu d'être empilées, puis réinjectées dans le prompt de la séance suivante.
-- Voir docs/10-APP-WEB/16-architecture-etat-memoire.md (items FORT #2 + #3).
create table if not exists public.learner_misconceptions (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid not null references public.profiles (id) on delete cascade,
  skill_id    uuid not null references public.skills (id) on delete cascade,
  label       text not null,                          -- l'erreur/confusion, en langage naturel
  status      text not null default 'active',         -- 'active' | 'resolved'
  occurrences integer not null default 1,             -- nombre de fois observée
  first_seen  timestamptz not null default now(),
  last_seen   timestamptz not null default now(),
  constraint learner_misconceptions_status_chk check (status in ('active', 'resolved'))
);

create index if not exists learner_misconceptions_lookup_idx
  on public.learner_misconceptions (profile_id, skill_id, status);

-- RLS backend-only (l'API passe en service_role ; pas d'accès direct client).
alter table public.learner_misconceptions enable row level security;
