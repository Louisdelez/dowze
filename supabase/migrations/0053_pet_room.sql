-- « Maison » du compagnon (jeu isométrique façon Habbo/Animal Crossing) : la pièce choisie + les meubles
-- placés, par compte. `items` = liste [{ item: string, c: int, r: int }] (case sur la grille iso).
create table if not exists public.pet_room (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  room text not null default 'chambre',
  items jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);
