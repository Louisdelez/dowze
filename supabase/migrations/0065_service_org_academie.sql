-- Orgs de SERVICE Dowze (Académie…) : une seule org de service par (élève, service).
-- `template` porte le marqueur de service (ex. 'service:academie'). L'index partiel empêche
-- les doublons quand la provision auto est déclenchée en parallèle (montage du compagnon + dashboard).
create unique index if not exists companion_spaces_service_uidx
  on companion_spaces (profile_id, template)
  where owner_kind = 'service';
