-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║ 0005 — Communauté : classes, communication, binômes                    ║
-- ╚══════════════════════════════════════════════════════════════════════╝

create type classe_type as enum ('tronc-commun', 'specialisation', 'projet');
create type classe_cycle as enum ('trimestre', 'semestre', 'annee');
create type classe_status as enum ('active', 'en-brassage', 'archivee');
create type membership_role as enum ('membre', 'pont');
create type channel_kind as enum ('dm', 'groupe', 'classe', 'binome');

create table classes (
  id         uuid primary key default gen_random_uuid(),
  slug       text not null unique,
  name       text not null,
  locale     text not null,
  timezone   text not null,
  type       classe_type not null,
  cycle      classe_cycle not null default 'trimestre',
  status     classe_status not null default 'active',
  created_at timestamptz not null default now()
);

create table memberships (
  classe_id  uuid not null references classes(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  role       membership_role not null default 'membre',
  joined_at  timestamptz not null default now(),
  primary key (classe_id, profile_id)
);
create index idx_memberships_profile on memberships(profile_id);

create table channels (
  id         uuid primary key default gen_random_uuid(),
  kind       channel_kind not null,
  classe_id  uuid references classes(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table channel_members (
  channel_id uuid not null references channels(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  primary key (channel_id, profile_id)
);

create table messages (
  id         uuid primary key default gen_random_uuid(),
  channel_id uuid not null references channels(id) on delete cascade,
  author_id  uuid not null references profiles(id) on delete cascade,
  body       text not null,
  created_at timestamptz not null default now()
);
create index idx_messages_channel on messages(channel_id, created_at);

create table binomes (
  id         uuid primary key default gen_random_uuid(),
  classe_id  uuid not null references classes(id) on delete cascade,
  week       timestamptz not null,
  created_at timestamptz not null default now()
);

create table binome_members (
  binome_id  uuid not null references binomes(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  primary key (binome_id, profile_id)
);

comment on table classes is 'Unité sociale (~24), formée automatiquement, avec cycle de vie + brassage.';
