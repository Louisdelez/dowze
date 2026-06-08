-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║ 0006 — Modération (façon Discord) + alertes parentales graduées        ║
-- ╚══════════════════════════════════════════════════════════════════════╝

create type incident_source as enum ('automod', 'ml-toxicite', 'signalement-humain');
create type incident_severity as enum ('faible', 'moyen', 'grave', 'critique');
create type incident_status as enum ('ouvert', 'en-revue-humaine', 'resolu', 'escalade');
create type moderation_action_kind as enum ('aucune', 'avertissement', 'masquage', 'suspension', 'escalade');

create table moderation_incidents (
  id          uuid primary key default gen_random_uuid(),
  source      incident_source not null,
  severity    incident_severity not null,
  content_ref text not null,
  author_id   uuid references profiles(id) on delete set null,
  victim_id   uuid references profiles(id) on delete set null,   -- détection bidirectionnelle
  status      incident_status not null default 'ouvert',
  created_at  timestamptz not null default now()
);
create index idx_incidents_status on moderation_incidents(status, created_at);

create table moderation_actions (
  id          uuid primary key default gen_random_uuid(),
  incident_id uuid not null references moderation_incidents(id) on delete cascade,
  actor_id    uuid not null references profiles(id) on delete restrict, -- toujours un humain
  kind        moderation_action_kind not null,
  reason      text not null default '',
  created_at  timestamptz not null default now()
);

-- Alerte parentale — toujours validée par un humain avant envoi.
create table parental_alerts (
  id               uuid primary key default gen_random_uuid(),
  minor_account_id uuid not null references accounts(id) on delete cascade,
  guardian_email   text not null,
  incident_id      uuid references moderation_incidents(id) on delete set null,
  severity         incident_severity not null,
  reason           text not null,
  human_validated  boolean not null default false,
  sent_at          timestamptz,
  created_at       timestamptz not null default now()
);

comment on table moderation_incidents is 'Chaîne AutoMod → ML toxicité bidirectionnel → modérateurs humains.';
comment on table parental_alerts is 'Alerte au responsable si un mineur est auteur OU victime (validée par un humain).';
