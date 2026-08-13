-- SYSTÈME DE NIVEAU & XP (engagement/assiduité, personnel & monotone — distinct des rangs pédagogiques).
-- Courbe quadratique (jamais de mur). XP calculé côté serveur, plafonné (anti-idle / anti multi-comptes).
create table if not exists public.learner_xp (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  xp bigint not null default 0,
  streak int not null default 0,
  last_login_date date,
  -- plafonds journaliers (remis à zéro quand la date change)
  xp_today int not null default 0,
  active_seconds_today int not null default 0,
  today date,
  updated_at timestamptz not null default now()
);

-- VALIDATION PAR LES PAIRS (exposé oral) : on crée un SUJET à valider (titre + description), puis des pairs
-- éligibles l'évaluent (validé + étoiles + commentaire). Validé si ≥ 3 évaluations, moyenne d'étoiles ≥ 3.
create table if not exists public.validation_subjects (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  description text not null default '',
  evidence_url text,                 -- lien optionnel (vidéo YouTube/TikTok/Twitch…) ; visio sinon
  format text not null default 'visio', -- 'visio' | 'video'
  status text not null default 'open',  -- 'open' | 'validated'
  created_at timestamptz not null default now(),
  validated_at timestamptz
);
create index if not exists validation_subjects_profile_idx on public.validation_subjects (profile_id);
create index if not exists validation_subjects_status_idx on public.validation_subjects (status);

create table if not exists public.validation_reviews (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references public.validation_subjects(id) on delete cascade,
  reviewer_id uuid not null references public.profiles(id) on delete cascade,
  validated boolean not null,
  stars smallint not null,           -- 1..5
  comment text not null default '',
  created_at timestamptz not null default now(),
  unique (subject_id, reviewer_id)   -- un pair n'évalue pas deux fois le même sujet
);
create index if not exists validation_reviews_subject_idx on public.validation_reviews (subject_id);
create index if not exists validation_reviews_reviewer_idx on public.validation_reviews (reviewer_id);
