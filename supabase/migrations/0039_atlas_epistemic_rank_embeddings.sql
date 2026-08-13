-- 0039 — Atlas : couche épistémique activée + rang ISCED explicite + colonnes d'embedding.
-- (1) rang explicite (1→10) qui prime sur la déduction par regex ;
-- (2) demi-vie du savoir par domaine (programme la réactualisation) ;
-- (3) statut épistémique des nœuds de front (recherche => savoir en évolution) ;
-- (4) embeddings (real[]) pour la récupération sémantique (cosinus en JS, pas de pgvector).

alter table skills add column if not exists rank integer;
alter table skills add column if not exists embedding real[];
alter table carnet_entries add column if not exists embedding real[];

-- (1) Backfill du rang, miroir SQL de rankOfSkill() (ISCED). Autoritatif ensuite.
update skills set rank = case
  when (description || ' ' || title) ~* '(frontières|direction de recherche|post-doctorat|redéfin|repouss)' then 9
  when (description || ' ' || title) ~* '(état de l.art|doctorat et au-delà|recherche.{0,15}pointe|contribution.{0,25}recherche)' then 8
  when (description || ' ' || title) ~* 'doctorat' then 7
  when (description || ' ' || title) ~* '(master|\ym1\y|\ym2\y)' then 6
  when (description || ' ' || title) ~* '(licence|\yl1\y|\yl2\y|\yl3\y)' then 5
  when (description || ' ' || title) ~* 'lyc[ée]e' then 4
  when (description || ' ' || title) ~* 'coll[èe]ge' then 3
  when depth <= 0 then 1
  else 2
end
where rank is null;

-- (2) Demi-vie par domaine (années). Les savoirs formels ne périment quasi pas (null) ;
-- la tech/science appliquée, vite. Sert à signaler « à réactualiser » et à moduler la révision.
update skills set half_life_years = 5  where half_life_years is null and slug like 'info-%';
update skills set half_life_years = 12 where half_life_years is null and slug like 'pc-%';
update skills set half_life_years = 10 where half_life_years is null and slug like 'svt-%';
-- math / lettres / philo : stables → on laisse null (pas d'obsolescence programmée).

-- (3) Nœuds de front de recherche (rang >= 8) : savoir en évolution, pas « établi » figé.
update skills set epistemic_status = 'emergent'
  where epistemic_status = 'etabli' and rank >= 8;

create index if not exists idx_carnet_profile on carnet_entries (profile_id);
