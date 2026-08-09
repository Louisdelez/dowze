-- Relais Claude Code / Codex : jetons Bearer pour le serveur MCP Dowze.
-- L'utilisateur colle le jeton dans SON Claude Code (son abonnement) → il se connecte à Dowze en MCP.
create table if not exists companion_relay_tokens (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  token_hash text not null unique,
  label text,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);
create index if not exists companion_relay_tokens_profile_idx on companion_relay_tokens(profile_id);
