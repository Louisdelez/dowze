-- Phase A du système ÉCHANGER : amis + messagerie (MP, groupes, canaux de classe).
-- Voir docs/10-APP-WEB/26-social-classes-moderation-traduction.md
--
-- Note légale : les messages sont immuables PAR DÉFAUT (pas d'UPDATE du corps, pas de DELETE physique),
-- mais effaçables sur demande RGPD/nLPD valide via anonymisation (status='anonymized', body vidé).
-- Un journal d'audit non identifiant (audit_hash) préserve l'intégrité sans figer les données perso.

-- ============ AMIS (symétrique, ordre canonique : une seule ligne par paire) ============
create table if not exists public.friendships (
  user_low     uuid not null references public.profiles(id) on delete cascade,  -- least(a,b)
  user_high    uuid not null references public.profiles(id) on delete cascade,  -- greatest(a,b)
  requested_by uuid not null references public.profiles(id) on delete cascade,  -- qui a initié
  status       text not null default 'pending',   -- 'pending' | 'accepted' | 'blocked'
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  primary key (user_low, user_high),
  check (user_low < user_high)
);
create index if not exists friendships_high_idx on public.friendships (user_high);

-- ============ CONVERSATIONS (unifie MP / groupe / canal de classe) ============
create table if not exists public.conversations (
  id              uuid primary key default gen_random_uuid(),
  type            text not null,            -- 'direct' | 'group' | 'class_channel'
  class_id        uuid,                     -- renseigné si canal de classe (Phase B)
  name            text,                     -- null pour MP
  created_by      uuid references public.profiles(id) on delete set null,
  last_message_at timestamptz,              -- dénormalisé (tri de l'inbox)
  created_at      timestamptz not null default now()
);
create index if not exists conversations_last_msg_idx on public.conversations (last_message_at desc);

create table if not exists public.conversation_participants (
  conversation_id       uuid not null references public.conversations(id) on delete cascade,
  profile_id            uuid not null references public.profiles(id) on delete cascade,
  role                  text not null default 'member',   -- 'member' | 'admin'
  last_read_message_id  uuid,                             -- pointeur de lecture (léger)
  joined_at             timestamptz not null default now(),
  primary key (conversation_id, profile_id)
);
create index if not exists conv_participants_profile_idx on public.conversation_participants (profile_id);

-- ============ MESSAGES (immuables par défaut ; effacement = anonymisation) ============
-- Nommée chat_messages : l'ancienne table `messages` (design community channels/messages) existe déjà.
create table if not exists public.chat_messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id       uuid not null references public.profiles(id) on delete cascade,
  body            text not null default '',
  kind            text not null default 'text',      -- 'text' | 'image' | 'file' | 'subject_share'
  meta            jsonb,                             -- ex. { subjectId } pour un partage de sujet
  status          text not null default 'active',    -- 'active' | 'anonymized'
  audit_hash      text,                              -- hash horodaté non identifiant (intégrité)
  created_at      timestamptz not null default now()
);
create index if not exists chat_messages_conv_idx on public.chat_messages (conversation_id, created_at);
