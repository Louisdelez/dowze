-- Phase B du système ÉCHANGER : « Ma Classe » — classes assignées (doc 26 §3).
-- Algorithme niveau (dur) > langue (quasi-dur) > âge (souple). Le canal de classe réutilise la
-- messagerie Phase A (conversations type='class_channel' + chat_messages).

-- Extension de la table `classes` existante (design community) avec les champs d'assignation.
alter table public.classes add column if not exists level int not null default 1;         -- rang/niveau (learner_rank.rank)
alter table public.classes add column if not exists primary_lang text not null default 'fr';
alter table public.classes add column if not exists is_multilingual boolean not null default false;
alter table public.classes add column if not exists school_year int not null default 0;

-- Extension de `memberships` : année scolaire + raison d'affectation.
alter table public.memberships add column if not exists school_year int not null default 0;
alter table public.memberships add column if not exists assignment_reason text not null default '';

create index if not exists memberships_profile_idx on public.memberships (profile_id);
create index if not exists classes_year_idx on public.classes (school_year);
