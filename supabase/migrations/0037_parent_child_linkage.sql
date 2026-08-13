-- Comptes parent/enfant liés (doc 26bis / recherche). Paliers d'âge <13 / 13-17 / 18+.
-- Le compte enfant <13 reste en attente de validation parentale (double confirmation).

-- Statut d'activation du compte : 'active' | 'pending_parent' (enfant <13 tant que le parent n'a pas confirmé).
alter table public.accounts add column if not exists activation_status text not null default 'active';

-- Extension de guardians = lien de tutelle/confiance (l'account "supervisé" reste minor_account_id).
alter table public.guardians add column if not exists guardian_account_id uuid references public.accounts(id) on delete set null;
alter table public.guardians add column if not exists tier text not null default 'mineur';        -- enfant | mineur | majeur
alter table public.guardians add column if not exists child_confirmed_at timestamptz;             -- l'enfant a confirmé son email
alter table public.guardians add column if not exists parent_confirmed_at timestamptz;            -- le parent a confirmé/lié
alter table public.guardians add column if not exists invite_token text;                          -- lien d'invitation (usage unique)
alter table public.guardians add column if not exists invite_expires_at timestamptz;

create index if not exists guardians_email_idx on public.guardians (email);
create index if not exists guardians_guardian_acct_idx on public.guardians (guardian_account_id);
create index if not exists guardians_invite_token_idx on public.guardians (invite_token);
