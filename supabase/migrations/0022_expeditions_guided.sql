-- Expéditions GUIDÉES par élève : l'IA propose, l'élève choisit, puis parcours
-- phase par phase (Étincelle→Trace) avec guidage + prompt + bilan.
create table if not exists public.learner_expeditions (
  id              uuid primary key default gen_random_uuid(),
  profile_id      uuid not null references public.profiles(id) on delete cascade,
  title           text not null,
  grande_question text not null,
  produit         text not null default '',
  phase           text not null default 'etincelle',
  status          text not null default 'en-cours',
  created_at      timestamptz not null default now()
);

create index if not exists idx_learner_expeditions_profile on public.learner_expeditions(profile_id);

create table if not exists public.expedition_phase_notes (
  id                     uuid primary key default gen_random_uuid(),
  learner_expedition_id  uuid not null references public.learner_expeditions(id) on delete cascade,
  phase                  text not null,
  guidance               jsonb,
  bilan                  text,
  created_at             timestamptz not null default now()
);

create index if not exists idx_expedition_phase_notes_exp on public.expedition_phase_notes(learner_expedition_id);

alter table public.learner_expeditions enable row level security;
alter table public.expedition_phase_notes enable row level security;

create policy learner_expeditions_owner on public.learner_expeditions
  for all using (owns_profile(profile_id)) with check (owns_profile(profile_id));
-- Les notes de phase suivent la propriété de l'expédition parente.
create policy expedition_phase_notes_owner on public.expedition_phase_notes
  for all using (
    exists (
      select 1 from public.learner_expeditions le
      where le.id = learner_expedition_id and owns_profile(le.profile_id)
    )
  ) with check (
    exists (
      select 1 from public.learner_expeditions le
      where le.id = learner_expedition_id and owns_profile(le.profile_id)
    )
  );
