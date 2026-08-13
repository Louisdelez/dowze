-- 0042 — Cours secondaire « Ma passion » (électif, optionnel, choisi à 100 %).
-- Philosophie : une passion/loisir qu'on peut pousser jusqu'au niveau pro (Plan A / Plan B), temps
-- PLAFONNÉ (~20 %, bloc-tampon). Recherche : Hidi & Renninger (développement de l'intérêt), SDT /
-- Patall 2008 (le choix = levier n°1 de persistance), Iyengar & Lepper (5 options = zone optimale),
-- Deci-Koestner-Ryan (effet de surjustification → séparer « plaisir » et « pro »), Kahneman DRM
-- (journal saisi dans le vif), Bryan/Ruiz-Yabut (verrou DUR déconseillé pour l'ado → engagement DOUX
-- + rampe de sortie ; on garde le délai de réflexion d'1 mois).

-- L'électif courant d'un apprenant (au plus un actif). Le changement passe par une PROPOSITION puis une
-- re-confirmation après 1 mois de réflexion (anti-décision impulsive). Verrou « doux » : `commit_until`
-- est AFFICHÉ (engagement moral) mais ne bloque jamais techniquement.
create table if not exists public.electives (
  id                uuid primary key default gen_random_uuid(),
  profile_id        uuid not null references public.profiles(id) on delete cascade,
  label             text not null,                    -- la passion, champ 100 % libre (ex. « Valorant », « Cuisine »)
  discipline_hint   text not null default '',         -- famille libre pour l'IA (esport, art, cuisine, dev…)
  mode              text not null default 'plaisir',  -- 'plaisir' (pour soi) | 'pro' (professionnaliser)
  status            text not null default 'active',   -- 'active' | 'change_pending'
  chosen_at         timestamptz not null default now(),
  commit_until      timestamptz,                       -- fin d'engagement AFFICHÉE (~6 mois), non bloquante
  change_target     text,                              -- la nouvelle passion proposée (en réflexion)
  change_proposed_at timestamptz,                       -- début du délai de réflexion
  change_confirm_at timestamptz,                        -- date à partir de laquelle on peut confirmer (+1 mois)
  created_at        timestamptz not null default now(),
  unique (profile_id)
);

-- Mode découverte : 5 disciplines testées 1 semaine chacune (exploration structurée bornée). Au plus
-- une découverte active. Un 2e tour propose des pistes IA si rien n'a plu (champ libre conservé).
create table if not exists public.elective_discovery (
  id             uuid primary key default gen_random_uuid(),
  profile_id     uuid not null references public.profiles(id) on delete cascade,
  round          integer not null default 1,          -- 1er tour libre ; 2e tour = avec propositions IA
  disciplines    jsonb not null,                       -- tableau de 5 { label, disciplineHint }
  current_index  integer not null default 0,           -- discipline en cours (0..4)
  week_started_at timestamptz not null default now(),   -- début de la semaine courante
  status         text not null default 'active',       -- 'active' | 'done'
  created_at     timestamptz not null default now()
);
create index if not exists elective_discovery_profile_idx on public.elective_discovery (profile_id, status);

-- Journal de bord quotidien (semi-structuré, saisi DANS LE VIF ; l'IA agrège des motifs → propositions
-- formulées comme HYPOTHÈSES, jamais verdict). Sert la découverte ET le suivi de la passion active.
create table if not exists public.elective_journal (
  id           uuid primary key default gen_random_uuid(),
  profile_id   uuid not null references public.profiles(id) on delete cascade,
  discovery_id uuid references public.elective_discovery(id) on delete set null,
  discipline   text not null,                          -- la discipline vécue ce jour
  entry_date   date not null,
  did          text not null default '',               -- « ce que j'ai fait »
  liked        text not null default '',               -- « ce que j'ai aimé »
  disliked     text not null default '',               -- « ce que je n'ai pas aimé »
  intensity    smallint not null default 3,            -- 1-5 : « perdu la notion du temps » (flow)
  created_at   timestamptz not null default now()
);
create index if not exists elective_journal_profile_idx on public.elective_journal (profile_id, entry_date);

-- Plan de la passion active (mêmes jalons/projets/badges que la spécialisation, mais cadrage Plan A/B).
create table if not exists public.elective_plans (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid not null references public.profiles(id) on delete cascade,
  label       text not null,
  distal_goal text not null default '',
  paths       jsonb not null default '[]',             -- débouchés adjacents (Plan A/B) : [{ title, note }]
  base_rate   text not null default '',                -- taux de base honnête (« <5 % vivent du streaming »)
  milestones  jsonb not null,
  created_at  timestamptz not null default now(),
  unique (profile_id, label)
);
