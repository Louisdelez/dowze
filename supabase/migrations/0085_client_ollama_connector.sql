-- Ollama reste sur la machine du client. La production ne stocke que des travaux temporaires
-- remis au connecteur Dowze Desktop authentifié sur le même compte.
alter table public.copilote_settings drop constraint if exists copilote_settings_billing_chk;
alter table public.copilote_settings
  add constraint copilote_settings_billing_chk check (billing in ('credits', 'byok', 'ollama'));
alter table public.copilote_settings add column if not exists ollama_model text;

create table if not exists public.local_ai_jobs (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  payload jsonb not null,
  status text not null default 'pending' check (status in ('pending','claimed','completed','failed')),
  result jsonb,
  error text,
  created_at timestamptz not null default now(),
  claimed_at timestamptz,
  completed_at timestamptz,
  expires_at timestamptz not null default (now() + interval '2 minutes')
);
create index if not exists local_ai_jobs_profile_pending_idx
  on public.local_ai_jobs(profile_id, status, created_at);
alter table public.local_ai_jobs enable row level security;
create policy local_ai_jobs_owner on public.local_ai_jobs for all to authenticated
  using (public.owns_profile(profile_id)) with check (public.owns_profile(profile_id));
