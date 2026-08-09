-- P3 — RAG PAR ORGANISATION : base de connaissances propre à chaque open-space (entreprise/école).
-- Scopée par `space` (id de l'open-space) → aucune contamination inter-projets. KNN pgvector (HNSW).
create table if not exists companion_space_knowledge (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null,
  space text not null,                       -- id de l'open-space propriétaire de la connaissance
  title text not null,
  content text not null,
  embedding_vec vector(1024),                -- même dim que la ruche (Jina v3) ; NULL si embeddings non configurés
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists companion_space_knowledge_space_idx on companion_space_knowledge (profile_id, space);
create index if not exists companion_space_knowledge_embed_idx on companion_space_knowledge using hnsw (embedding_vec vector_cosine_ops);
