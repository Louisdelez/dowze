-- Profil élève : photo de profil. (birth_date existe déjà depuis 0001.)
alter table public.profiles add column if not exists photo_url text;
