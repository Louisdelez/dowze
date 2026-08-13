-- Compagnons-agents : plusieurs compagnons par profil (« famille » dans la Maison + « collègues » dans les open-spaces).
-- Chaque ligne = un compagnon : nom + skin + personnalité (mode PNJ scripté d'abord, mode agent IA plus tard).
-- Le compagnon PRINCIPAL (is_primary) est fourni/contrôlé par Dowze et ne peut pas être supprimé.
-- Le Tamagotchi (pet_care) reste par profil = le « foyer » ; le champ `space` distingue Maison ('home') vs open-space.

create table if not exists public.companion_agents (
  id           uuid primary key default gen_random_uuid(),
  profile_id   uuid not null,
  name         text not null,
  -- skin : slug curated ("/pets/x.webp"), pet importé ("/companion/pet/:id") ou URL externe.
  skin_url     text,
  size         integer not null default 96,
  -- Persona PNJ : { tone, traits[], description, emoji? } — pilote les répliques scriptées (aucune IA).
  personality  jsonb,
  -- Spécialisation (libellé) — utile au mode agent (phases ultérieures).
  role         text,
  -- Lieu de vie : 'home' (Maison, avec Tamagotchi) ou l'id d'un open-space.
  space        text not null default 'home',
  -- Position iso mémorisée dans sa salle : { c, r }.
  pos          jsonb,
  -- Compagnon principal (fourni par Dowze, non supprimable, non entièrement custom).
  is_primary   boolean not null default false,
  -- Mode : 'pnj' (répliques scriptées) ou 'agent' (IA/RAG, plus tard).
  mode         text not null default 'pnj',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists companion_agents_profile_idx on public.companion_agents (profile_id);
create index if not exists companion_agents_space_idx   on public.companion_agents (profile_id, space);
-- Un seul compagnon principal par profil.
create unique index if not exists companion_agents_primary_uniq on public.companion_agents (profile_id) where is_primary;
