-- 0045 — Plateforme de PLUGINS (P1) : registre & activation par utilisateur.
-- Modèle « first-party extensions » : un plugin déclare un manifest (scopes à moindre privilège,
-- contributions au calendrier, config), le cœur le référence, l'utilisateur l'active en accordant
-- des scopes révocables. Autorisation portée par l'API (service-role) — cf. docs/12-PLUGINS.

-- Registre des plugins connus du cœur (apps satellites first-party).
create table if not exists public.plugin_registry (
  id                 uuid primary key default gen_random_uuid(),
  slug               text not null unique,                 -- 'fitness'
  name               text not null,                        -- 'Dowze Fitness'
  subdomain          text not null unique,                 -- 'fitness.dowze.ch'
  description        text not null default '',
  status             text not null default 'draft',        -- draft|active|deprecated|disabled
  manifest_version   text not null default '1',
  api_version        text not null default 'v1',
  min_core_version   text not null default '3.0.0',
  scopes_requested   text[] not null default '{}',         -- requis (moindre privilège)
  scopes_optional    text[] not null default '{}',         -- facultatifs (à la demande)
  contributes        jsonb  not null default '{}'::jsonb,   -- types d'entrée calendrier, tuiles, nav
  subscribes         text[] not null default '{}',         -- événements écoutés
  config_schema      jsonb  not null default '{}'::jsonb,   -- JSON Schema de la config utilisateur
  client_secret_hash text,                                  -- identité d'app (Client Credentials) — rempli en P4
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

-- Activation d'un plugin PAR un utilisateur (profil), avec octroi de scopes révocable + config validée.
create table if not exists public.user_plugin_activation (
  id             uuid primary key default gen_random_uuid(),
  profile_id     uuid not null references public.profiles(id) on delete cascade,
  plugin_id      uuid not null references public.plugin_registry(id) on delete cascade,
  enabled        boolean not null default true,
  granted_scopes text[] not null default '{}',             -- ⊆ (requested ∪ optional), révocable
  config         jsonb  not null default '{}'::jsonb,
  activated_at   timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (profile_id, plugin_id)
);
create index if not exists user_plugin_activation_profile_idx on public.user_plugin_activation (profile_id);
create index if not exists user_plugin_activation_plugin_idx on public.user_plugin_activation (plugin_id);

-- Plugin fictif « Fitness » (catalogue de démonstration ; l'app satellite arrive en P4).
-- Permet dès P1 de lister le catalogue et de tester l'activation + les scopes accordés.
insert into public.plugin_registry
  (slug, name, subdomain, description, status, min_core_version, scopes_requested, scopes_optional, contributes, subscribes, config_schema)
values (
  'fitness',
  'Dowze Fitness',
  'fitness.dowze.ch',
  'La forme physique régulière — des séances inscrites au planning, orchestrées avec l''étude.',
  'active',
  '3.0.0',
  '{profile:read,calendar:read,calendar:write}',
  '{ai:infer,health:write,xp:write}',
  jsonb_build_object(
    'calendarEntryTypes', jsonb_build_array(
      jsonb_build_object('type','fitness.workout','label','Séance','color','emerald','icon','activity')
    ),
    'navTiles', jsonb_build_array()
  ),
  '{}',
  jsonb_build_object(
    'type','object',
    'properties', jsonb_build_object(
      'frequencyPerWeek', jsonb_build_object('type','integer','minimum',1,'maximum',6,'default',3),
      'goal', jsonb_build_object('type','string','enum', jsonb_build_array('forme','force','endurance'),'default','forme')
    )
  )
)
on conflict (slug) do nothing;
