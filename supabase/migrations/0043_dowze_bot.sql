-- 0043 — Profil « Dowze » (bot) pour poster dans les salons de classe de langue (invoqué par `/`).
-- Le bot est un vrai profil (expéditeur des messages), visible par tous dans le canal de la classe.
insert into public.accounts (id, email, role, is_minor, is_teacher, activation_status)
values ('d0000000-0000-4000-8000-000000000001', 'dowze-bot@dowze.ch', 'eleve', false, false, 'active')
on conflict (id) do nothing;

insert into public.profiles (id, account_id, display_name, locale, timezone)
values ('d0000000-0000-4000-8000-000000000002', 'd0000000-0000-4000-8000-000000000001', 'Dowze', 'en', 'UTC')
on conflict (id) do nothing;
