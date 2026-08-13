-- Profs agréés : un enseignant peut demander le statut (parcours, où il enseigne). Vérification HUMAINE
-- et manuelle (is_teacher passé à true par un humain). Un prof agréé valide un sujet en UNE fois.
alter table public.accounts add column if not exists is_teacher boolean not null default false;

create table if not exists public.teacher_applications (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  background text not null,          -- parcours / diplômes
  where_teaching text not null default '', -- où il enseigne (établissement…)
  status text not null default 'pending', -- 'pending' | 'approved' | 'rejected'
  created_at timestamptz not null default now(),
  unique (account_id)
);
