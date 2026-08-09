-- 0067 — Intégrité P1 (audit 03-08-2026, docs/11-IMPLEMENTATION/03-audit-complet-2026-08.md)
-- (1) Idempotence des clôtures de cours natif : une clôture par (profil, compétence, jour) —
--     le double-clic / retry réseau ne doit plus produire une double observation BKT + double FSRS.
-- (2) Anti-races find-or-create : les « ensure* » (select-puis-insert) pouvaient dupliquer sous
--     concurrence les espaces et les agents système (pont/relais), et activer deux langues à la fois.
--     Vérifié avant pose : AUCUN doublon existant en prod (03-08-2026).

-- (1) Journal des clôtures de cours natif (idempotence serveur).
create table if not exists course_closures (
  profile_id uuid not null,
  skill_id uuid not null,
  closure_date date not null,
  outcome text not null,
  created_at timestamptz not null default now(),
  primary key (profile_id, skill_id, closure_date)
);

-- (2a) Un espace par nom (insensible à la casse) et par profil.
create unique index if not exists companion_spaces_profile_name_uniq
  on companion_spaces (profile_id, lower(name));

-- (2b) Un seul agent « pont IA » et un seul agent « relais » par profil.
create unique index if not exists companion_agents_bridge_uniq
  on companion_agents (profile_id) where mode = 'bridge';
create unique index if not exists companion_agents_relay_uniq
  on companion_agents (profile_id) where mode = 'relay';

-- (2c) Une seule langue ACTIVE par profil (les autres sont en maintenance).
create unique index if not exists learner_languages_active_uniq
  on learner_languages (profile_id) where status = 'active';
