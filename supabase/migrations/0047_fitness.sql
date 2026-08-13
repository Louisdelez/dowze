-- 0047 — Plugin FITNESS (P4) : schéma propre au plugin (« database-per-service » : le plugin possède sa
-- donnée). Accès direct par l'app fitness via le client Supabase (session partagée .dowze.ch) sous RLS.
-- RGPD : on ne stocke PAS de donnée de santé médicale ici (résumés de séance non sensibles) ; le
-- consentement santé (Art. 9) est géré séparément côté activation (config du plugin), révocable.

create table if not exists public.fitness_sessions (
  id         uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  title      text not null default 'Séance',
  summary    text not null default '',
  snapshot   jsonb not null default '{}'::jsonb,  -- extrait structuré par l'IA de Dowze (ingest)
  done_at    timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists fitness_sessions_profile_idx on public.fitness_sessions (profile_id, done_at desc);

-- RLS : chacun ne voit/écrit QUE ses séances (le rôle `authenticated` porte le JWT de l'utilisateur).
alter table public.fitness_sessions enable row level security;

drop policy if exists fitness_sessions_select on public.fitness_sessions;
create policy fitness_sessions_select on public.fitness_sessions for select to authenticated
  using (
    profile_id in (
      select p.id from public.profiles p
      join public.accounts a on a.id = p.account_id
      where a.auth_user_id = auth.uid()
    )
  );

drop policy if exists fitness_sessions_insert on public.fitness_sessions;
create policy fitness_sessions_insert on public.fitness_sessions for insert to authenticated
  with check (
    profile_id in (
      select p.id from public.profiles p
      join public.accounts a on a.id = p.account_id
      where a.auth_user_id = auth.uid()
    )
  );

drop policy if exists fitness_sessions_delete on public.fitness_sessions;
create policy fitness_sessions_delete on public.fitness_sessions for delete to authenticated
  using (
    profile_id in (
      select p.id from public.profiles p
      join public.accounts a on a.id = p.account_id
      where a.auth_user_id = auth.uid()
    )
  );
