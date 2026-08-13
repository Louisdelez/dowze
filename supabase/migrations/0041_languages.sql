-- 0041 — Cours de langue « Parler » (séparé de « Ma séance »).
-- Philosophie : savoir PARLER > par-cœur (TBLT), tuteur IA vocal non-jugeant, communication entre
-- pairs. UNE langue active à la fois ; l'IA débloque la suivante par PROFICIENCE ; les anciennes
-- passent en MAINTENANCE (récupération active espacée orientée production, effet de « savings »).
-- Recherche : Krashen/Swain/Long (input+output+interaction), Nation (seuil lexical 95-98 %),
-- Cepeda (espacement), Schmid (attrition), Gardner/Dörnyei (ideal L2 self), CECRL.
--
-- NB : les nœuds `lang-*` de l'Atlas sont GÉNÉRIQUES (partagés par toutes les langues) et servent de
-- RÉFÉRENTIEL de niveau (ce qu'est A1/A2/B1). La maîtrise réelle est suivie PAR LANGUE ici (sinon
-- apprendre l'anglais marquerait l'espagnol comme déjà avancé).

-- État d'une langue étrangère pour un apprenant. Une seule 'active' à la fois ; les autres 'maintenance'.
create table if not exists public.learner_languages (
  profile_id   uuid not null references public.profiles(id) on delete cascade,
  lang         text not null,                      -- code court : en, de, es, it, nl, pt, ar…
  status       text not null default 'active',     -- 'active' (en apprentissage) | 'maintenance'
  -- Niveau PAR LANGUE, continu 0→5 (≈ A1=1, A2=2, B1=3, B2=4, C1=5). Avancé par les séances.
  level        real not null default 0,
  reason_pitch text not null default '',           -- le « pourquoi cette langue » (1-2 lignes, projectif)
  streak       integer not null default 0,         -- jours consécutifs de pratique (régularité > volume)
  last_practice_date date,                          -- dernière pratique (pour le streak + la maintenance)
  started_at   timestamptz not null default now(),
  created_at   timestamptz not null default now(),
  primary key (profile_id, lang)
);
create index if not exists learner_languages_profile_idx on public.learner_languages (profile_id);
create index if not exists learner_languages_active_idx on public.learner_languages (profile_id, status);

-- Journal d'activité (streak + preuve de maintenance). Une ligne par séance faite.
create table if not exists public.language_activity (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid not null references public.profiles(id) on delete cascade,
  lang        text not null,
  activity_date date not null,
  kind        text not null default 'session',     -- 'session' (langue active) | 'maintenance' (ancienne)
  minutes     integer not null default 0,
  score       real,                                 -- performance de la séance (0..1), pour l'avancement
  summary     text not null default '',
  created_at  timestamptz not null default now()
);
create index if not exists language_activity_profile_idx on public.language_activity (profile_id, activity_date);

-- Classes de langue : on étend la table `classes`. Une classe de langue (type='language') regroupe des
-- apprenants de la MÊME langue cible et d'un niveau proche, quelle que soit leur langue maternelle ;
-- on n'y parle QUE la langue cible (charte). `target_lang` = la langue de la classe.
alter table public.classes
  add column if not exists target_lang text;        -- null pour les classes académiques (tronc-commun)

-- `classes.type` est un enum (classe_type) : on y ajoute la valeur 'language'.
alter type classe_type add value if not exists 'language';
