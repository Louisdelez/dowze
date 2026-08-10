-- Espaces installables : bâtiment, rôles, capacités, workflows et permissions voyagent ensemble.
create table if not exists public.hive_space_packages (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  key text not null,
  name text not null,
  version text not null default '1.0.0',
  description text not null default '',
  visibility text not null default 'private' check (visibility in ('private','shared','official')),
  manifest jsonb not null,
  checksum text not null,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(profile_id, key, version)
);

create table if not exists public.hive_space_installations (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  package_id uuid not null references public.hive_space_packages(id) on delete restrict,
  space_id uuid not null references public.companion_spaces(id) on delete cascade,
  mode text not null check (mode in ('join','create')),
  installed_version text not null,
  configuration jsonb not null default '{}'::jsonb,
  installed_at timestamptz not null default now(),
  unique(profile_id, space_id)
);

create index if not exists hive_space_packages_profile_idx on public.hive_space_packages(profile_id, enabled, name);
alter table public.hive_space_packages enable row level security;
alter table public.hive_space_installations enable row level security;
create policy "hive_space_packages: propriétaire" on public.hive_space_packages for all to authenticated
  using (public.owns_profile(profile_id)) with check (public.owns_profile(profile_id));
create policy "hive_space_installations: propriétaire" on public.hive_space_installations for all to authenticated
  using (public.owns_profile(profile_id)) with check (public.owns_profile(profile_id));
