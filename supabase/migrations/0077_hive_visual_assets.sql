-- Inventaire opérationnel lié aux objets visuels des open-spaces ; les secrets restent dans le coffre.
create table if not exists public.hive_assets (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  space text not null,
  name text not null,
  asset_type text not null check (asset_type in ('server','database','firewall','vps','service','device','other')),
  visual_key text not null default 'serveur-informatique',
  room text,
  position jsonb,
  endpoint text,
  purpose text not null default '',
  environment text not null default 'production' check (environment in ('development','staging','production','personal')),
  status text not null default 'unknown' check (status in ('healthy','degraded','offline','unknown')),
  vault_item_id uuid references public.hive_vault_items(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists hive_assets_profile_space_idx on public.hive_assets(profile_id, space, asset_type);
alter table public.hive_assets enable row level security;
create policy "hive_assets: propriétaire" on public.hive_assets
  for all using (owns_profile(profile_id)) with check (owns_profile(profile_id));
