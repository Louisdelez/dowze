-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║ 0003 — Apprentissage : maîtrise (BKT), révision (SM-2), planning        ║
-- ╚══════════════════════════════════════════════════════════════════════╝

create type planning_entry_kind as enum ('apprentissage', 'revision', 'expedition', 'pause');
create type presence_status as enum ('prevu', 'realise', 'partiel', 'non-realise');

-- ── Maîtrise (état BKT par compétence et par profil) ────────────────────
create table mastery_states (
  profile_id    uuid not null references profiles(id) on delete cascade,
  skill_id      uuid not null references skills(id) on delete cascade,
  p_mastery     double precision not null default 0.1 check (p_mastery >= 0 and p_mastery <= 1),
  attempts      integer not null default 0,
  correct       integer not null default 0,
  last_updated  timestamptz,
  primary key (profile_id, skill_id)
);

-- ── Cartes de révision SM-2 ─────────────────────────────────────────────
create table sm2_cards (
  profile_id     uuid not null references profiles(id) on delete cascade,
  skill_id       uuid not null references skills(id) on delete cascade,
  repetitions    integer not null default 0,
  ease_factor    double precision not null default 2.5 check (ease_factor >= 1.3),
  interval_days  integer not null default 0,
  due_date       timestamptz,
  last_reviewed  timestamptz,
  primary key (profile_id, skill_id)
);
create index idx_sm2_due on sm2_cards(profile_id, due_date);

-- ── Disponibilités hebdomadaires (créneaux) ─────────────────────────────
create table availability_slots (
  id            uuid primary key default gen_random_uuid(),
  profile_id    uuid not null references profiles(id) on delete cascade,
  day_of_week   smallint not null check (day_of_week between 0 and 6),
  start_minute  smallint not null check (start_minute between 0 and 1439),
  duration_min  smallint not null check (duration_min between 5 and 600)
);
create index idx_slots_profile on availability_slots(profile_id);

-- ── Entrées de planning ─────────────────────────────────────────────────
create table planning_entries (
  id            uuid primary key default gen_random_uuid(),
  profile_id    uuid not null references profiles(id) on delete cascade,
  date          timestamptz not null,
  kind          planning_entry_kind not null,
  skill_id      uuid references skills(id) on delete set null,
  expedition_id uuid,                                  -- FK ajoutée en 0004bis si besoin
  duration_min  smallint not null check (duration_min between 5 and 600),
  status        presence_status not null default 'prevu'
);
create index idx_planning_profile_date on planning_entries(profile_id, date);

-- ── Bilan de présence (miroir bienveillant, non punitif) ────────────────
create table attendance_records (
  id              uuid primary key default gen_random_uuid(),
  profile_id      uuid not null references profiles(id) on delete cascade,
  date            timestamptz not null,
  entries_planned integer not null default 0,
  entries_done    integer not null default 0,
  status          presence_status not null,
  unique (profile_id, date)
);

comment on table mastery_states is 'Probabilité de maîtrise (BKT) par profil × compétence.';
comment on table attendance_records is 'Présence comme donnée d''ajustement, jamais punitive.';
