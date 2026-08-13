-- Économie du compagnon : monnaie « gold » + meubles/accessoires possédés (débloqués via la Boutique).
-- `owned` = liste d'ids d'objets débloqués (placeables dans « Aménager »). Départ : un lot de base gratuit.
alter table public.pet_care
  add column if not exists gold integer not null default 300,
  add column if not exists owned jsonb not null default '["plante","tapis","chaise","lampe","fleur"]'::jsonb;
