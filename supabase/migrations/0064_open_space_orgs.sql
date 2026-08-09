-- Open-spaces = organisations (entreprise / SaaS / école). Type + mission + template + propriétaire.
-- Chaque open-space est peuplé d'agents-employés aux rôles distincts (catalogue de rôles côté API).
alter table companion_spaces add column if not exists type text not null default 'custom';       -- company | saas | school | custom
alter table companion_spaces add column if not exists mission text;                               -- north-star injecté dans chaque agent
alter table companion_spaces add column if not exists template text;                              -- clé de template de rôles utilisée au seeding
alter table companion_spaces add column if not exists owner_kind text not null default 'user';    -- user | service (Dowze : Académie…)

-- Rôle/métier du catalogue (ex. 'cto', 'dev-back', 'graphiste', 'enseignant'). `role` (texte) reste le libellé humain.
alter table companion_agents add column if not exists role_key text;
create index if not exists companion_agents_space_rolekey_idx on companion_agents (profile_id, space, role_key);
