-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║ 0001 — Extensions, comptes, profils, système parental                  ║
-- ╚══════════════════════════════════════════════════════════════════════╝

create extension if not exists "pgcrypto"; -- gen_random_uuid()

-- ── Types énumérés ──────────────────────────────────────────────────────
create type account_role as enum ('eleve', 'pair', 'mentor', 'moderateur', 'parent', 'admin');
create type consent_status as enum ('en-attente', 'accorde', 'refuse');
create type cursus_phase as enum ('tronc-commun', 'specialisation');

-- ── Comptes ─────────────────────────────────────────────────────────────
-- Lien optionnel vers auth.users (Supabase Auth). Les mineurs ne sont PAS
-- bridés : même expérience pour tous ; la sûreté vient du suivi + modération.
create table accounts (
  id           uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique,                       -- references auth.users(id)
  email        text not null unique,
  role         account_role not null default 'eleve',
  is_minor     boolean not null default false,
  created_at   timestamptz not null default now()
);

-- ── Profils (persona pédagogique) ───────────────────────────────────────
create table profiles (
  id          uuid primary key default gen_random_uuid(),
  account_id  uuid not null references accounts(id) on delete cascade,
  display_name text not null,
  locale      text not null,                       -- BCP-47 (fr, fr-CH…)
  timezone    text not null,                       -- IANA (Europe/Zurich)
  birth_date  date,
  phase       cursus_phase not null default 'tronc-commun',
  created_at  timestamptz not null default now()
);
create index idx_profiles_account on profiles(account_id);

-- ── Responsables légaux (façon Pronote) ─────────────────────────────────
create table guardians (
  id               uuid primary key default gen_random_uuid(),
  minor_account_id uuid not null references accounts(id) on delete cascade,
  email            text not null,
  consent_status   consent_status not null default 'en-attente',
  consent_at       timestamptz,
  has_dashboard_account boolean not null default false,
  created_at       timestamptz not null default now()
);
create index idx_guardians_minor on guardians(minor_account_id);

comment on table accounts is 'Comptes utilisateurs (élève, pair, mentor, modérateur, parent, admin).';
comment on table guardians is 'Responsables légaux d''un compte mineur (consentement « email plus »).';
