-- Tamagotchi PAR compagnon (agents/abeilles) : jauges persistées + décroissance temps réel.
-- Le principal (is_primary) reste sur pet_care (avec gold/stock) ; cette table couvre tous les AUTRES compagnons.
create table if not exists companion_care (
  agent_id uuid primary key references companion_agents(id) on delete cascade,
  satiety integer not null default 80,
  happiness integer not null default 80,
  energy integer not null default 80,
  hygiene integer not null default 80,
  health integer not null default 90,
  born_at timestamptz not null default now(),
  last_tick timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
