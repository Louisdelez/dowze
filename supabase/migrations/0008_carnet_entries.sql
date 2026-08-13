-- Carnet de bord : entrées de note par profil (attendu par le schéma Drizzle de l'API
-- mais absent des migrations initiales -> corrige le 500 sur /carnet).
create table if not exists public.carnet_entries (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  skill_id uuid references public.skills (id) on delete set null,
  note text not null,
  created_at timestamptz not null default now()
);

create index if not exists carnet_entries_profile_created_idx
  on public.carnet_entries (profile_id, created_at desc);

-- RLS : la table est dans le schéma public (exposé par PostgREST). L'API applicative
-- passe en superuser (postgres) et contourne la RLS ; on refuse tout accès direct
-- anon/authenticated en activant la RLS sans policy permissive.
alter table public.carnet_entries enable row level security;
