-- Catalogue de modèles d'EMBEDDING (mémoire sémantique : dédup + rappel par le sens).
-- Sélection curée couvrant qualité / rapport qualité-prix / UE-RGPD / auto-hébergé.
-- Voir docs/10-APP-WEB/16-architecture-etat-memoire.md.
create table if not exists public.ai_embedding_model (
  id           text primary key,
  provider     text not null,               -- openai|google|mistral|voyage|cohere|jina (cloud, par clé API)
  model_id     text not null,
  label        text not null,
  price_per_m  double precision not null,    -- USD / M tokens (0 = auto-hébergé)
  dimensions   integer not null,
  context_max  integer not null,
  eu_hosted    boolean not null default false,
  multilingual boolean not null default true,
  active       boolean not null default true,
  sort         integer not null default 100,
  note         text not null default ''
);

insert into public.ai_embedding_model
  (id, provider, model_id, label, price_per_m, dimensions, context_max, eu_hosted, multilingual, active, sort, note) values
  ('gemini-embedding-001','google','gemini-embedding-001','Gemini Embedding (Google)',        0.15, 3072,  2048, false, true, true, 10, 'Top qualité multilingue (état de l''art).'),
  ('voyage-4-large',      'voyage','voyage-4-large',       'Voyage 4 Large (Voyage AI)',        0.12, 2048, 32000, false, true, true, 20, 'Qualité état de l''art, grand contexte.'),
  ('voyage-3-5',          'voyage','voyage-3.5',           'Voyage 3.5 (Voyage AI)',            0.06, 1024, 32000, false, true, true, 30, 'Meilleur rapport qualité/prix.'),
  ('openai-3-large',      'openai','text-embedding-3-large','OpenAI 3 Large',                   0.13, 3072,  8191, false, true, true, 40, 'Solide, SDK simple.'),
  ('openai-3-small',      'openai','text-embedding-3-small','OpenAI 3 Small',                   0.02, 1536,  8191, false, true, true, 50, 'Économique et simple.'),
  ('cohere-embed-v4',     'cohere','embed-v4.0',           'Cohere Embed v4',                   0.12, 1536,128000, false, true, true, 60, 'Très grand contexte (128k), 100+ langues.'),
  ('mistral-embed',       'mistral','mistral-embed',       'Mistral Embed (UE)',                0.10, 1024,  8192, true,  true, true, 70, 'Hébergement UE (RGPD), bon en français.'),
  ('jina-v3',             'jina', 'jina-embeddings-v3',    'Jina v3 (UE)',                      0.02, 1024,  8192, true,  true, true, 80, 'UE (Allemagne), excellent rapport qualité/prix.')
on conflict (id) do nothing;

alter table public.ai_embedding_model enable row level security;
drop policy if exists ai_embedding_model_read on public.ai_embedding_model;
create policy ai_embedding_model_read on public.ai_embedding_model for select to authenticated using (true);

-- Réglage embedding par profil (modèle choisi + clé chiffrée dédiée).
alter table public.copilote_settings
  add column if not exists embedding_model_id text references public.ai_embedding_model (id),
  add column if not exists embedding_provider text,
  add column if not exists embedding_key_enc  text;
