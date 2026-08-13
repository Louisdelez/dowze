-- B1 : plan de spécialisation généré par le guide-IA (jalons + projets), backward design.
create table if not exists public.specialization_plans (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  discipline text not null,
  distal_goal text not null default '',
  milestones jsonb not null,
  created_at timestamptz not null default now(),
  unique (profile_id, discipline)
);

-- B4 : badges / micro-crédentiels (Open Badges-like : critères + preuve + alignement).
create table if not exists public.learner_badges (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  discipline text not null default '',
  criteria text not null default '',
  milestone_id text,
  created_at timestamptz not null default now()
);

-- A4 : checkpoints de rétention espacée après un saut de rang (J+7 / J+30 / J+90).
create table if not exists public.retention_checkpoints (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  rank smallint not null,
  scheduled_at timestamptz not null,
  status text not null default 'due', -- 'due' | 'passed' | 'remediate'
  created_at timestamptz not null default now()
);

create index if not exists retention_profile_idx on public.retention_checkpoints (profile_id);
