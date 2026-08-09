-- Refonte ÉCHANGER : discriminateur d'ami (pseudo Nom#1234, type Discord) + slots de classe.

-- Discriminateur : le pseudo n'est plus unique, mais "displayName#tag" l'est (à peu près).
alter table public.profiles add column if not exists tag text;
-- Backfill des profils existants avec un code à 4 chiffres.
update public.profiles set tag = lpad((floor(random()*10000))::int::text, 4, '0') where tag is null;

create index if not exists profiles_tag_idx on public.profiles (tag);
