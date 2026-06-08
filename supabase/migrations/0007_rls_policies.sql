-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║ 0007 — Row-Level Security (défense en profondeur)                      ║
-- ║ Le backend NestJS utilise la service_role (bypass RLS) ; ces policies  ║
-- ║ protègent l'accès direct depuis le navigateur (supabase-js).           ║
-- ╚══════════════════════════════════════════════════════════════════════╝

-- Compte courant à partir du JWT Supabase.
create or replace function current_account_id()
returns uuid language sql stable as $$
  select id from accounts where auth_user_id = (select auth.uid());
$$;

-- Le profil <profile_id> appartient-il au compte courant ?
create or replace function owns_profile(pid uuid)
returns boolean language sql stable as $$
  select exists (
    select 1 from profiles p
    where p.id = pid and p.account_id = current_account_id()
  );
$$;

-- ── Catalogue public (lecture pour tout utilisateur authentifié) ────────
alter table skills            enable row level security;
alter table prerequisites     enable row level security;
alter table expeditions       enable row level security;
alter table expedition_skills enable row level security;
alter table rubrics           enable row level security;
alter table rubric_criteria   enable row level security;

create policy "catalogue lisible" on skills            for select to authenticated using (true);
create policy "catalogue lisible" on prerequisites     for select to authenticated using (true);
create policy "catalogue lisible" on expeditions       for select to authenticated using (true);
create policy "catalogue lisible" on expedition_skills for select to authenticated using (true);
create policy "catalogue lisible" on rubrics           for select to authenticated using (true);
create policy "catalogue lisible" on rubric_criteria   for select to authenticated using (true);

-- ── Comptes & profils (chacun les siens) ────────────────────────────────
alter table accounts enable row level security;
alter table profiles enable row level security;

create policy "compte: le sien" on accounts
  for select to authenticated using (auth_user_id = (select auth.uid()));
create policy "profil: les siens" on profiles
  for all to authenticated
  using (account_id = current_account_id())
  with check (account_id = current_account_id());

-- ── Données personnelles d'apprentissage (par profil possédé) ───────────
do $$
declare t text;
begin
  foreach t in array array[
    'mastery_states', 'sm2_cards', 'availability_slots',
    'planning_entries', 'attendance_records'
  ] loop
    execute format('alter table %I enable row level security;', t);
    execute format(
      'create policy "données: les siennes" on %I for all to authenticated '
      || 'using (owns_profile(profile_id)) with check (owns_profile(profile_id));', t);
  end loop;
end $$;

-- ── Validations (l'apprenant voit les siennes) ──────────────────────────
alter table validations enable row level security;
create policy "validations: les siennes" on validations
  for select to authenticated using (owns_profile(learner_id));

-- ── Messages (réservés aux membres du canal) ────────────────────────────
alter table messages        enable row level security;
alter table channel_members enable row level security;

create policy "messages: membres du canal" on messages
  for select to authenticated using (
    exists (
      select 1 from channel_members cm
      where cm.channel_id = messages.channel_id and owns_profile(cm.profile_id)
    )
  );
create policy "messages: écrire si auteur membre" on messages
  for insert to authenticated with check (
    owns_profile(author_id) and exists (
      select 1 from channel_members cm
      where cm.channel_id = messages.channel_id and cm.profile_id = author_id
    )
  );
create policy "canal: ses adhésions" on channel_members
  for select to authenticated using (owns_profile(profile_id));

-- NB : les tables de modération/parental ne sont accessibles qu'à la
-- service_role (backend) — aucune policy = aucun accès direct client.
alter table moderation_incidents enable row level security;
alter table moderation_actions   enable row level security;
alter table parental_alerts       enable row level security;
alter table guardians             enable row level security;
