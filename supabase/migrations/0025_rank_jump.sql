-- « Saut de Rang » : mois intensif (type piscine 42/Epitech) pour franchir un rang plus vite.
-- Volontairement exigeant (80 % requis), avec filtre d'éligibilité et garde-fous. Échec = retour
-- au rang sans pénalité. Un seul saut actif à la fois par élève.
create table if not exists public.rank_jumps (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  from_rank smallint not null,
  target_rank smallint not null,
  -- 'in-progress' | 'passed' | 'failed' | 'abandoned'
  status text not null default 'in-progress',
  eligibility_score smallint not null default 0,
  current_day smallint not null default 1,
  -- plan des 28 jours : [{ day, type, label, weight, done, score }]
  plan jsonb not null,
  started_at timestamptz not null default now(),
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists rank_jumps_profile_idx on public.rank_jumps (profile_id);
