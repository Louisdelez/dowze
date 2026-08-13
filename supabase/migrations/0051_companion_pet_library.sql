-- Bibliothèque de pets : plusieurs pets importés par profil (jusqu'à 50 côté app), nommés et gérables
-- (sélection / renommage / suppression). On passe de « 1 pet par profil » (PK profile_id) à « id propre ».
alter table public.companion_pets add column if not exists id uuid;
alter table public.companion_pets add column if not exists name text;
alter table public.companion_pets add column if not exists created_at timestamptz not null default now();

-- Lignes existantes : id = profile_id (préserve les URL /companion/pet/<profileId> déjà servies).
update public.companion_pets set id = profile_id where id is null;
update public.companion_pets set name = 'Mon pet' where name is null;

alter table public.companion_pets alter column id set default gen_random_uuid();
alter table public.companion_pets alter column id set not null;

-- Bascule la clé primaire de profile_id vers id (plusieurs pets par profil désormais).
alter table public.companion_pets drop constraint companion_pets_pkey;
alter table public.companion_pets add constraint companion_pets_pkey primary key (id);
create index if not exists companion_pets_profile_idx on public.companion_pets (profile_id);
