-- Économie interne : budget crédits et échéance, en plus de profondeur/fan-out/tâches/durée.
alter table public.hive_runs
  add column if not exists max_credits integer not null default 100 check (max_credits between 0 and 10000000),
  add column if not exists used_credits integer not null default 0 check (used_credits >= 0),
  add column if not exists deadline_at timestamptz;
