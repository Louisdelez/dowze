-- Compagnon (« pet ») personnel : le choix (planche, taille, masqué) est stocké PAR COMPTE,
-- comme une photo de profil ou un skin — perso à chacun, visible que par lui, synchronisé
-- entre appareils. Forme : { "url": string|null, "size": int, "hidden": bool }.
alter table public.profiles add column if not exists companion jsonb;
