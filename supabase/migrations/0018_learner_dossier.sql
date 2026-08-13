-- Dossier élève : l'IA extrait un modèle d'apprenant depuis la présentation libre,
-- que l'élève valide/corrige (Open Learner Model). Un dossier par profil.
create table if not exists public.learner_dossiers (
  profile_id       uuid primary key references public.profiles(id) on delete cascade,
  raw_presentation text not null default '',
  structured       jsonb not null,
  validated        boolean not null default false,
  updated_at       timestamptz not null default now()
);

alter table public.learner_dossiers enable row level security;

-- L'élève ne voit/écrit que son propre dossier (le backend service_role bypass la RLS).
create policy learner_dossiers_owner on public.learner_dossiers
  for all using (owns_profile(profile_id)) with check (owns_profile(profile_id));
