-- A1 : pré-test « above-level » pour la jauge de Saut (score de maîtrise anticipée du rang visé).
create table if not exists public.rank_jump_pretests (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  target_rank smallint not null,
  score double precision not null default 0,
  created_at timestamptz not null default now(),
  primary key (profile_id, target_rank)
);

-- A3 : check-ins bien-être (humeur quotidienne 1-5, WHO-5 hebdo 0-100). Jamais un diagnostic — un soutien.
create table if not exists public.wellbeing_checkins (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null, -- 'mood' | 'who5'
  score double precision not null,
  created_at timestamptz not null default now()
);
create index if not exists wellbeing_profile_idx on public.wellbeing_checkins (profile_id);

-- C1 : points RR accumulés (gain variable façon Elo), découplés du gate rigoureux (les 3 conditions).
alter table public.learner_rank add column if not exists rr_points double precision not null default 0;
