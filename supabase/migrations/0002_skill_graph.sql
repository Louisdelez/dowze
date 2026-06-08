-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║ 0002 — Graphe de compétences (Atlas) + clôture par CTE récursive       ║
-- ╚══════════════════════════════════════════════════════════════════════╝

create type skill_kind as enum (
  'savoir', 'savoir-faire', 'savoir-etre', 'capacite-corporelle', 'civique', 'esthetique'
);
create type epistemic_status as enum ('etabli', 'en-debat', 'emergent', 'obsolescent');

-- ── Compétences (nœuds) ─────────────────────────────────────────────────
create table skills (
  id               uuid primary key default gen_random_uuid(),
  slug             text not null unique,
  title            text not null,
  description      text not null default '',
  kind             skill_kind not null,
  depth            integer not null check (depth >= 0),
  is_root          boolean not null default false,
  epistemic_status epistemic_status not null default 'etabli',
  half_life_years  numeric,
  mastery_threshold double precision not null default 0.95
    check (mastery_threshold >= 0 and mastery_threshold <= 1),
  sources          text[] not null default '{}',
  created_at       timestamptz not null default now()
);

-- ── Prérequis (arêtes) — intégrité référentielle = pas de prérequis pendant
create table prerequisites (
  skill_id        uuid not null references skills(id) on delete cascade,
  prerequisite_id uuid not null references skills(id) on delete restrict,
  primary key (skill_id, prerequisite_id),
  check (skill_id <> prerequisite_id)
);
create index idx_prereq_skill on prerequisites(skill_id);
create index idx_prereq_prerequisite on prerequisites(prerequisite_id);

-- ── Clôture transitive d'une compétence (recursive CTE, colonne CYCLE) ───
-- Renvoie tous les prérequis (transitifs) d'une compétence. La colonne CYCLE
-- de Postgres ≥ 14 protège contre les boucles.
create or replace function skill_closure(target uuid)
returns table (prerequisite_id uuid, depth integer)
language sql stable
as $$
  with recursive chain as (
    select p.prerequisite_id, 1 as depth
    from prerequisites p
    where p.skill_id = target
    union
    select p.prerequisite_id, c.depth + 1
    from prerequisites p
    join chain c on p.skill_id = c.prerequisite_id
  ) cycle prerequisite_id set is_cycle using path
  select prerequisite_id, min(depth) as depth
  from chain
  group by prerequisite_id;
$$;

comment on table skills is 'Compétences (nœuds d''Atlas). Liste d''adjacence via prerequisites.';
comment on function skill_closure is 'Clôture transitive des prérequis (garantie zéro trou côté lecture).';
