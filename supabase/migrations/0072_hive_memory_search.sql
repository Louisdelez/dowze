-- Recherche hybride de la Bibliothèque : plein texte, fautes approximatives et embeddings.
create extension if not exists pg_trgm;

alter table public.hive_events add column if not exists embedding_vec vector(1024);
alter table public.hive_memories add column if not exists embedding_vec vector(1024);

create index if not exists hive_events_content_fts_idx
  on public.hive_events using gin (to_tsvector('simple', content));
create index if not exists hive_events_content_trgm_idx
  on public.hive_events using gin (content gin_trgm_ops);
create index if not exists hive_events_embedding_hnsw_idx
  on public.hive_events using hnsw (embedding_vec vector_cosine_ops);
create index if not exists hive_memories_content_fts_idx
  on public.hive_memories using gin (to_tsvector('simple', content));
create index if not exists hive_memories_content_trgm_idx
  on public.hive_memories using gin (content gin_trgm_ops);
create index if not exists hive_memories_embedding_hnsw_idx
  on public.hive_memories using hnsw (embedding_vec vector_cosine_ops);
