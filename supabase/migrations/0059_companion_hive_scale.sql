-- Ruche « infinie » : indexer pour retrouver vite la bonne abeille parmi des millions.
-- (Plus aucune limite dure sur le nombre d'abeilles/open-spaces côté application.)

-- Recherche par mots-clés (ILIKE) rapide sur nom/rôle des compagnons, même à très grande échelle.
create extension if not exists pg_trgm;
create index if not exists companion_agents_name_trgm on companion_agents using gin (name gin_trgm_ops);
create index if not exists companion_agents_role_trgm on companion_agents using gin (role gin_trgm_ops);

-- Filtre de base de l'orchestration (abeilles d'open-space d'un profil) + tri par récence.
create index if not exists companion_agents_profile_mode_space_idx on companion_agents (profile_id, mode, space);
create index if not exists companion_agents_profile_updated_idx on companion_agents (profile_id, updated_at desc);
