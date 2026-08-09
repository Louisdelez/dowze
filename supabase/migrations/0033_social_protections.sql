-- Phase D « Protections » du système ÉCHANGER (doc 26 §7) :
-- blocage, signalement, espace modérateur, Remise à 0, mode supervisé (validation parentale).

-- ============ BLOCAGE (bidirectionnel en MP) ============
create table if not exists public.blocks (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id)
);
create index if not exists blocks_blocked_idx on public.blocks (blocked_id);

-- ============ SIGNALEMENT d'un utilisateur (avec message) ============
create table if not exists public.user_reports (
  id           uuid primary key default gen_random_uuid(),
  reporter_id  uuid not null references public.profiles(id) on delete cascade,
  reported_id  uuid not null references public.profiles(id) on delete cascade,
  reason       text not null,                 -- message du signalement
  conversation_id uuid,                        -- contexte (fenêtre d'historique côté modo)
  status       text not null default 'open',  -- 'open' | 'reviewing' | 'resolved'
  created_at   timestamptz not null default now(),
  resolved_at  timestamptz,
  resolver_id  uuid
);
create index if not exists user_reports_status_idx on public.user_reports (status, created_at);
create index if not exists user_reports_reported_idx on public.user_reports (reported_id);

-- ============ REMISE À 0 (messages + amis), validée par un modérateur ============
-- Flux : un élève SOUS accord parental ne peut pas demander seul → sa demande passe D'ABORD par le
-- parent (status 'pending_parent'), puis part au modérateur ('pending_moderator'). Un élève sans
-- accord parental, ou une demande faite par le parent, va directement au modérateur.
create table if not exists public.reset_requests (
  id            uuid primary key default gen_random_uuid(),
  profile_id    uuid not null references public.profiles(id) on delete cascade, -- élève concerné
  scope         text not null default 'messages', -- 'messages' (messages+amis) | 'account'
  requested_by  text not null,                 -- 'self' | 'parent'
  requester_ref text not null default '',      -- email parent, ou profil élève (traçabilité)
  status        text not null default 'pending_moderator',
                -- 'pending_parent' | 'pending_moderator' | 'approved' | 'rejected'
  parent_approved_at timestamptz,
  moderator_id  uuid,
  created_at    timestamptz not null default now(),
  resolved_at   timestamptz
);
create index if not exists reset_requests_status_idx on public.reset_requests (status, created_at);

-- ============ MODE SUPERVISÉ (validation parentale de chaque message / demande d'ami) ============
alter table public.guardians add column if not exists supervised boolean not null default false;

alter table public.chat_messages add column if not exists hold_state text not null default 'clear'; -- 'clear' | 'held_out'

create table if not exists public.supervision_items (
  id               uuid primary key default gen_random_uuid(),
  child_profile_id uuid not null references public.profiles(id) on delete cascade,
  child_account_id uuid not null references public.accounts(id) on delete cascade,
  direction        text not null,              -- 'in' | 'out'
  kind             text not null,              -- 'message' | 'friend_request'
  message_id       uuid,                       -- si kind='message'
  friend_target_id uuid,                        -- l'autre profil si kind='friend_request'
  status           text not null default 'pending', -- 'pending' | 'approved' | 'rejected'
  created_at       timestamptz not null default now(),
  resolved_at      timestamptz
);
create index if not exists supervision_items_child_idx on public.supervision_items (child_account_id, status, created_at);
