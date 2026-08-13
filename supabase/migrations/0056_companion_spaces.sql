-- Espaces de travail des compagnons : la Maison ('home') est implicite (famille + Tamagotchi) ;
-- les open-spaces sont des lieux nommables où vivent des agents « de travail » (sans Tamagotchi).
-- Un agent référence son espace via companion_agents.space ('home' | id d'un open-space).

create table if not exists public.companion_spaces (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid not null,
  name        text not null,
  created_at  timestamptz not null default now()
);

create index if not exists companion_spaces_profile_idx on public.companion_spaces (profile_id);
