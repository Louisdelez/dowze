-- Spécialisation : les directions (disciplines) que l'élève choisit de creuser (le « pic » du profil
-- en T). Réversible (« respec ») ; on peut en avoir plusieurs (vertical/horizontal/hybride).
create table if not exists public.specializations (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  discipline text not null,
  status text not null default 'active', -- 'active' | 'paused'
  created_at timestamptz not null default now(),
  unique (profile_id, discipline)
);

create index if not exists specializations_profile_idx on public.specializations (profile_id);
