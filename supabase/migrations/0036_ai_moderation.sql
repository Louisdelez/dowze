-- Phase D+ : IA de modération (doc 26 §7.3). Détecte, suspecte, signale — ne bannit JAMAIS.
-- Dès détection : alerte IMMÉDIATE et simultanée au parent (parental_alerts) ET à la modération (ci-dessous).

create table if not exists public.ai_moderation_flags (
  id              uuid primary key default gen_random_uuid(),
  message_id      uuid not null references public.chat_messages(id) on delete cascade,
  author_id       uuid not null references public.profiles(id) on delete cascade,
  conversation_id uuid not null,
  category        text not null,               -- insulte | menace | harcelement | inapproprie
  reason          text not null,
  severity        text not null default 'moyen', -- moyen | grave | critique
  status          text not null default 'open',  -- open | resolved
  created_at      timestamptz not null default now(),
  resolved_at     timestamptz,
  resolver_id     uuid
);
create index if not exists ai_flags_status_idx on public.ai_moderation_flags (status, created_at);
create index if not exists ai_flags_author_idx on public.ai_moderation_flags (author_id);
