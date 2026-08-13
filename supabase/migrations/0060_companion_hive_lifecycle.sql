-- Cycle de vie / efficacité des abeilles (« jardinage de la ruche ») : métriques + soft-delete + fusion.
alter table companion_agents
  add column if not exists use_count integer not null default 0,
  add column if not exists last_used_at timestamptz,
  add column if not exists quality_ema real,
  add column if not exists rating_count integer not null default 0,
  add column if not exists protected boolean not null default false,
  add column if not exists status text not null default 'active',
  add column if not exists merged_into uuid;

-- Filtre courant : les abeilles ACTIVES d'un profil (on exclut retired/merged partout).
create index if not exists companion_agents_profile_status_idx on companion_agents (profile_id, status);

-- Journal des fusions (traçabilité + rollback éventuel).
create table if not exists companion_agent_merges (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  survivor_id uuid not null,
  absorbed_id uuid not null,
  reason text,
  created_at timestamptz not null default now()
);
create index if not exists companion_agent_merges_profile_idx on companion_agent_merges (profile_id);
