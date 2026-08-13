-- Mémoire de conversation des compagnons-agents : les messages sont persistés (le compagnon se souvient).
-- Utilisé par le chat IA (historique injecté dans le prompt) et par les apps Messages du téléphone/tablette.

create table if not exists public.companion_messages (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid not null,
  agent_id    uuid not null,
  sender      text not null,           -- 'me' (l'élève) | 'agent'
  text        text not null,
  created_at  timestamptz not null default now()
);

create index if not exists companion_messages_agent_idx on public.companion_messages (agent_id, created_at);
