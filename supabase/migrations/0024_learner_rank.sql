-- Progression de rang « façon jeu vidéo compétitif » : le rang courant est un ÉTAT (il ne change que
-- quand l'élève ACCEPTE la montée), pas un simple calcul. On stocke le rang, la date de début du rang
-- (pour le plancher d'1 an), et les choix élève/parent lors d'une montée proposée.
create table if not exists public.learner_rank (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  rank smallint not null default 1,
  rank_started_at timestamptz not null default now(),
  -- null | 'accept' | 'consolidate' — vote de l'élève quand une montée est débloquée.
  student_choice text,
  -- null | 'accept' | 'consolidate' — confirmation du responsable (si compte parental).
  parent_choice text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
