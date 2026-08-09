-- Saut de Rang : cadence calendaire (1 tâche/jour réel) + consentement parental bloquant.
-- last_day_at = horodatage de la dernière tâche validée (pour empêcher d'enchaîner les 28 jours d'un coup).
-- Le statut 'pending-consent' (compte mineur) bloque le démarrage tant que le responsable n'a pas confirmé.
alter table public.rank_jumps add column if not exists last_day_at timestamptz;
