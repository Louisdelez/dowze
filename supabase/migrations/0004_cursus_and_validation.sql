-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║ 0004 — Cursus (expéditions) + validation par paliers (grilles)         ║
-- ╚══════════════════════════════════════════════════════════════════════╝

create type expedition_phase as enum ('etincelle', 'question', 'defi', 'acte', 'trace');
create type expedition_status as enum ('proposee', 'en-cours', 'terminee', 'archivee');
create type validation_tier as enum ('auto', 'ia-precorrection', 'pair', 'expert');
create type badge_level as enum ('auto-declare', 'valide-par-pair', 'endosse-expert');

-- ── Expéditions (le moteur du Cursus) ───────────────────────────────────
create table expeditions (
  id             uuid primary key default gen_random_uuid(),
  slug           text not null unique,
  title          text not null,
  grande_question text not null,
  fils           text[] not null default '{}',
  duration_weeks smallint not null check (duration_weeks between 2 and 6),
  phase          expedition_phase not null default 'etincelle',
  status         expedition_status not null default 'proposee',
  created_at     timestamptz not null default now()
);

create table expedition_skills (
  expedition_id uuid not null references expeditions(id) on delete cascade,
  skill_id      uuid not null references skills(id) on delete cascade,
  primary key (expedition_id, skill_id)
);

alter table planning_entries
  add constraint fk_planning_expedition
  foreign key (expedition_id) references expeditions(id) on delete set null;

-- ── Grilles (rubriques binaires) ────────────────────────────────────────
create table rubrics (
  skill_id   uuid primary key references skills(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table rubric_criteria (
  id          text not null,                          -- slug du critère
  skill_id    uuid not null references rubrics(skill_id) on delete cascade,
  label       text not null,
  description text not null default '',
  required    boolean not null default true,
  primary key (skill_id, id)
);

-- ── Validations (auto / IA / pair / expert) ─────────────────────────────
create table validations (
  id           uuid primary key default gen_random_uuid(),
  skill_id     uuid not null references skills(id) on delete cascade,
  learner_id   uuid not null references profiles(id) on delete cascade,
  tier         validation_tier not null,
  reviewer_id  uuid references profiles(id) on delete set null,
  passed       boolean not null,
  evidence_url text,
  created_at   timestamptz not null default now()
);
create index idx_validations_skill_learner on validations(skill_id, learner_id);

create table validation_verdicts (
  validation_id uuid not null references validations(id) on delete cascade,
  criterion_id  text not null,
  met           boolean not null,
  comment       text not null default '',
  primary key (validation_id, criterion_id)
);

-- ── File de revue par les pairs (asynchrone, non bloquante) ─────────────
create table peer_review_queue (
  id          uuid primary key default gen_random_uuid(),
  skill_id    uuid not null references skills(id) on delete cascade,
  learner_id  uuid not null references profiles(id) on delete cascade,
  evidence_url text,
  claimed_by  uuid references profiles(id) on delete set null,
  resolved    boolean not null default false,
  created_at  timestamptz not null default now()
);
create index idx_peer_queue_open on peer_review_queue(resolved, created_at);

comment on table rubrics is 'La grille d''une compétence : ce qui doit être démontré (pas de QCM).';
comment on table peer_review_queue is 'File asynchrone de validation par les pairs (modèle École 42).';
