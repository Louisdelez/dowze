-- Recherche & dédoublonnage SÉMANTIQUES de la ruche (v2) : pgvector + HNSW.
-- Modèle d'embedding de la ruche = Jina v3 (1024 dimensions), réutilise la config « Mon Copilote » du profil.
create extension if not exists vector;

alter table companion_agents add column if not exists embedding_vec vector(1024);

-- Index HNSW (cosinus) pour un KNN rapide même avec des millions d'abeilles.
create index if not exists companion_agents_embedding_hnsw
  on companion_agents using hnsw (embedding_vec vector_cosine_ops);
