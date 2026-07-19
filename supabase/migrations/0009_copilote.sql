-- Le Copilote — l'IA interne orchestratrice (par API), avec crédits prépayés et BYOK.
-- Voir docs/10-APP-WEB/15-copilote-orchestrateur.md.

-- 1. Catalogue de modèles (multi-fournisseurs). Ajouter un modèle = une ligne.
create table if not exists public.ai_model (
  id          text primary key,             -- identifiant public stable (ex. 'gpt-4o-mini')
  provider    text not null,                -- openai | google | mistral | deepseek | anthropic
  model_id    text not null,                -- identifiant technique côté fournisseur
  label       text not null,
  price_in    double precision not null,    -- USD / M tokens (entrée)
  price_out   double precision not null,    -- USD / M tokens (sortie)
  strict      boolean not null default false, -- structured outputs stricts supportés
  eu_hosted   boolean not null default false, -- hébergement UE (RGPD)
  active      boolean not null default true,
  sort        integer not null default 100,
  note        text not null default ''
);

-- Seed du catalogue de lancement (prix indicatifs 2026, USD / M tokens).
insert into public.ai_model (id, provider, model_id, label, price_in, price_out, strict, eu_hosted, active, sort, note) values
  ('gpt-4o-mini',      'openai',    'gpt-4o-mini',            'GPT-4o mini (OpenAI)',        0.15, 0.60, true,  false, true, 10, 'Valeur sûre : JSON strict garanti.'),
  ('gemini-flash-lite','google',    'gemini-2.5-flash-lite',  'Gemini 2.5 Flash-Lite (Google)', 0.10, 0.40, true,  false, true, 20, 'Le moins cher, très grand contexte.'),
  ('mistral-small',    'mistral',   'mistral-small-latest',   'Mistral Small (Mistral, UE)', 0.10, 0.30, false, true,  true, 30, 'Français natif, hébergement UE (RGPD).'),
  ('deepseek-chat',    'deepseek',  'deepseek-chat',          'DeepSeek V3 (DeepSeek)',      0.14, 0.28, false, false, true, 40, 'Très bon marché (API hors UE).'),
  ('claude-haiku',     'anthropic', 'claude-haiku-4-5',       'Claude Haiku 4.5 (Anthropic)',1.00, 5.00, true,  false, true, 50, 'Premium : rédaction soignée.')
on conflict (id) do nothing;

-- Catalogue public : lisible par tout compte authentifié (données non sensibles).
alter table public.ai_model enable row level security;
drop policy if exists ai_model_read on public.ai_model;
create policy ai_model_read on public.ai_model for select to authenticated using (true);

-- 2. Réglages Copilote par profil (modèle choisi + facturation + clé BYOK chiffrée).
create table if not exists public.copilote_settings (
  profile_id       uuid primary key references public.profiles (id) on delete cascade,
  model_id         text not null default 'gpt-4o-mini' references public.ai_model (id),
  billing          text not null default 'credits',   -- 'credits' | 'byok'
  byok_provider    text,                               -- fournisseur de la clé BYOK
  byok_key_enc     text,                               -- clé API chiffrée (AES-256-GCM), JAMAIS en clair
  updated_at       timestamptz not null default now(),
  constraint copilote_settings_billing_chk check (billing in ('credits', 'byok'))
);

-- 3. Solde de crédits (ligne unique par profil) — décrément atomique.
create table if not exists public.credit_balances (
  profile_id  uuid primary key references public.profiles (id) on delete cascade,
  balance     double precision not null default 0,   -- en crédits Dowze (1 crédit ≈ 0,1 centime)
  updated_at  timestamptz not null default now(),
  constraint credit_balances_nonneg_chk check (balance >= 0)
);

-- 4. Grand livre append-only (audit de chaque mouvement).
create table if not exists public.credit_ledger (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid not null references public.profiles (id) on delete cascade,
  delta       double precision not null,   -- + recharge, - consommation
  reason      text not null,               -- 'recharge' | 'hold' | 'reconcile' | 'refund' | 'grant'
  ref         text,                        -- corrélation (id de séance, id d'événement Stripe…)
  created_at  timestamptz not null default now()
);

create index if not exists credit_ledger_profile_idx
  on public.credit_ledger (profile_id, created_at desc);

-- RLS : ces tables portent des données sensibles (clé API, solde). L'API applicative
-- passe en service_role (contourne la RLS) ; on interdit tout accès direct anon/authenticated
-- en activant la RLS sans policy permissive.
alter table public.copilote_settings enable row level security;
alter table public.credit_balances enable row level security;
alter table public.credit_ledger enable row level security;
