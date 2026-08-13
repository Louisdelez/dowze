-- Ordre de cursus : à profondeur égale, quelle compétence prescrire d'abord.
-- Donne une VRAIE progression pédagogique (fin des sauts entre domaines).
alter table public.skills add column if not exists curriculum_order integer;

-- Fondations (maternelle) : corps → social → émotions → oral → observation → repérage → nombres → tracé/lecture.
update public.skills set curriculum_order =  1 where title = 'Coordonner son corps';
update public.skills set curriculum_order =  2 where title = 'Interagir avec autrui';
update public.skills set curriculum_order =  3 where title = 'Reconnaître les émotions';
update public.skills set curriculum_order =  4 where title = 'Comprendre l''oral (langue maternelle)';
update public.skills set curriculum_order =  5 where title = 'S''exprimer à l''oral (langue maternelle)';
update public.skills set curriculum_order =  6 where title = 'Observer et décrire';
update public.skills set curriculum_order =  7 where title = 'Se repérer dans l''espace et le temps';
update public.skills set curriculum_order =  8 where title = 'Classer et ordonner';
update public.skills set curriculum_order =  9 where title = 'Comparer des quantités';
update public.skills set curriculum_order = 10 where title = 'Dénombrer';
update public.skills set curriculum_order = 11 where title = 'Écrire et tracer';
update public.skills set curriculum_order = 12 where title = 'Déchiffrer et lire';

-- CP/CE1 : calcul de base + lecture/écriture de phrase.
update public.skills set curriculum_order = 20 where title = 'Additionner';
update public.skills set curriculum_order = 21 where title = 'Soustraire';
update public.skills set curriculum_order = 22 where title = 'Lire et comprendre un texte simple';
update public.skills set curriculum_order = 23 where title = 'Écrire une phrase';

-- CE1/CE2 : multiplication, problèmes, rédaction, résumé.
update public.skills set curriculum_order = 30 where title = 'Multiplier';
update public.skills set curriculum_order = 31 where title = 'Résoudre un problème arithmétique';
update public.skills set curriculum_order = 32 where title = 'Rédiger un court texte';
update public.skills set curriculum_order = 33 where title = 'Résumer un texte';

-- CM : division, fractions, argumentation.
update public.skills set curriculum_order = 40 where title = 'Diviser';
update public.skills set curriculum_order = 41 where title = 'Comprendre les fractions simples';
update public.skills set curriculum_order = 42 where title = 'Argumenter à l''écrit';
