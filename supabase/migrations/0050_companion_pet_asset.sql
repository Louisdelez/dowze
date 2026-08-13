-- Planche du compagnon « importée » (déposée en .zip, via commande d'install, ou fichier) :
-- téléchargée/extraite et VALIDÉE côté serveur, puis stockée et servie par l'API. Ça contourne
-- le hotlink cross-site (petdex renvoie 403) ET le bug d'upload storage. Une planche par profil.
create table if not exists public.companion_pets (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  mime text not null,
  bytes bytea not null,
  updated_at timestamptz not null default now()
);
