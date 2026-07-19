-- Mémoire sémantique : vecteur d'embedding par misconception, pour regrouper les
-- confusions par le SENS (et non par mots exacts). Stocké en real[] ; la similarité
-- cosinus est calculée côté app (volumes faibles par profil×compétence).
-- Voir docs/10-APP-WEB/16-architecture-etat-memoire.md (item #4).
alter table public.learner_misconceptions
  add column if not exists embedding real[];
