-- 0068 — pgvector pour `skills` et `carnet_entries` (audit perf 08-2026, P4.13).
-- Avant : la similarité était calculée EN JS après un full scan (toutes les lignes + leurs real[] de
-- 1024 floats chargées en mémoire à CHAQUE compose/cours) → latence + risque OOM sur l'API (mem 1g).
-- Après : KNN SQL (HNSW, cosinus) comme la ruche (migration 0061).
-- Les colonnes `embedding real[]` restent la source d'écriture ; un TRIGGER synchronise `embedding_vec`
-- (aucun chemin d'écriture applicatif à modifier).

create extension if not exists vector;

alter table skills add column if not exists embedding_vec vector(1024);
alter table carnet_entries add column if not exists embedding_vec vector(1024);

-- Synchro écriture → vecteur (silencieuse si dimension ≠ 1024).
create or replace function sync_embedding_vec() returns trigger as $$
begin
  if new.embedding is not null and array_length(new.embedding, 1) = 1024 then
    new.embedding_vec := new.embedding::vector(1024);
  else
    new.embedding_vec := null;
  end if;
  return new;
end $$ language plpgsql;

drop trigger if exists skills_embedding_sync on skills;
create trigger skills_embedding_sync
  before insert or update of embedding on skills
  for each row execute function sync_embedding_vec();

drop trigger if exists carnet_embedding_sync on carnet_entries;
create trigger carnet_embedding_sync
  before insert or update of embedding on carnet_entries
  for each row execute function sync_embedding_vec();

-- Backfill des vecteurs existants (1024 dims uniquement).
update skills set embedding_vec = embedding::vector(1024)
  where embedding is not null and array_length(embedding, 1) = 1024 and embedding_vec is null;
update carnet_entries set embedding_vec = embedding::vector(1024)
  where embedding is not null and array_length(embedding, 1) = 1024 and embedding_vec is null;

-- Index HNSW (cosinus) pour le KNN.
create index if not exists skills_embedding_hnsw
  on skills using hnsw (embedding_vec vector_cosine_ops);
create index if not exists carnet_entries_embedding_hnsw
  on carnet_entries using hnsw (embedding_vec vector_cosine_ops);
