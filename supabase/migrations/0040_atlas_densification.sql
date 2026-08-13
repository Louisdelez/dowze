-- 0040 — Densification de l'Atlas : 5 nouvelles disciplines au-delà des 6 académiques.
-- Arts & création · Citoyenneté & société · Corps & mouvement · Langues du monde · Métiers & artisanats.
-- Chaque branche = une chaîne close (racine depth 0 → depth 4), rang explicite, seuil + source par domaine.
-- Amorce modeste mais RÉELLE et close (validée R1-R8) ; la génération vivante étend ensuite chaque branche.

insert into skills (id, slug, title, description, kind, depth, is_root, rank, epistemic_status, mastery_threshold, sources) values
-- Arts & création (esthétique) — seuil plus souple (création ≠ exactitude).
('70000000-0000-4000-8000-000000000001','arts-1','Explorer couleurs, formes et matières','Découvrir librement les couleurs, formes et matières ; produire des traces variées. Niveau maternelle/primaire.','esthetique',0,true,1,'etabli',0.90,array['Programmes d''enseignements artistiques']),
('70000000-0000-4000-8000-000000000002','arts-2','Dessiner d''après observation','Représenter un objet observé en respectant proportions et contours. Niveau primaire.','esthetique',1,false,1,'etabli',0.90,array['Programmes d''enseignements artistiques']),
('70000000-0000-4000-8000-000000000003','arts-3','Composer une image','Organiser une image : cadrage, équilibre, contraste, point focal. Niveau primaire/collège.','esthetique',2,false,2,'etabli',0.90,array['Programmes d''enseignements artistiques']),
('70000000-0000-4000-8000-000000000004','arts-4','Créer avec une intention expressive','Choisir moyens plastiques au service d''une intention (émotion, message). Niveau collège.','esthetique',3,false,2,'etabli',0.90,array['Programmes d''enseignements artistiques']),
('70000000-0000-4000-8000-000000000005','arts-5','Analyser et critiquer une œuvre','Décrire, interpréter et situer une œuvre dans son contexte ; argumenter un jugement esthétique. Niveau lycée.','esthetique',4,false,3,'etabli',0.92,array['Programmes d''enseignements artistiques']),
-- Citoyenneté & société (civique).
('70000000-0000-4000-8000-000000000006','civ-1','Vivre ensemble : règles et respect','Reconnaître et respecter les règles de la vie en groupe ; écouter autrui. Niveau maternelle/primaire.','civique',0,true,1,'etabli',0.92,array['Socle commun — domaine 3 : formation de la personne et du citoyen']),
('70000000-0000-4000-8000-000000000007','civ-2','Connaître ses droits et ses devoirs','Comprendre droits et devoirs fondamentaux ; notion d''égalité et de loi. Niveau primaire.','civique',1,false,1,'etabli',0.92,array['Socle commun — domaine 3 : formation de la personne et du citoyen']),
('70000000-0000-4000-8000-000000000008','civ-3','Distinguer information, opinion et rumeur','Évaluer une source, distinguer fait vérifiable, opinion et désinformation. Niveau collège.','civique',2,false,2,'etabli',0.92,array['Socle commun — éducation aux médias et à l''information']),
('70000000-0000-4000-8000-000000000009','civ-4','Participer à une décision collective','Argumenter, débattre dans le respect, décider par le vote ou le consensus. Niveau collège.','civique',3,false,2,'etabli',0.92,array['Socle commun — domaine 3 : formation de la personne et du citoyen']),
('70000000-0000-4000-8000-00000000000a','civ-5','Analyser une institution démocratique','Comprendre séparation des pouvoirs, représentation et fonctionnement des institutions. Niveau lycée.','civique',4,false,3,'etabli',0.92,array['Socle commun — enseignement moral et civique']),
-- Corps & mouvement (capacité corporelle) — seuil souple.
('70000000-0000-4000-8000-00000000000b','corps-1','Se déplacer et garder l''équilibre','Maîtriser marche, course, saut et équilibre dans des environnements variés. Niveau maternelle/primaire.','capacite-corporelle',0,true,1,'etabli',0.90,array['Programmes d''éducation physique et sportive (EPS)']),
('70000000-0000-4000-8000-00000000000c','corps-2','Coordonner des gestes complexes','Enchaîner des gestes coordonnés (lancer, rattraper, rythmer). Niveau primaire.','capacite-corporelle',1,false,1,'etabli',0.90,array['Programmes d''éducation physique et sportive (EPS)']),
('70000000-0000-4000-8000-00000000000d','corps-3','Jouer collectif : coopérer et s''opposer','Tenir un rôle dans un jeu collectif ; coopérer et s''opposer loyalement. Niveau primaire/collège.','capacite-corporelle',2,false,2,'etabli',0.90,array['Programmes d''éducation physique et sportive (EPS)']),
('70000000-0000-4000-8000-00000000000e','corps-4','S''entraîner en sécurité','Gérer effort, échauffement, récupération et sécurité. Niveau collège.','capacite-corporelle',3,false,2,'etabli',0.90,array['Programmes d''éducation physique et sportive (EPS)']),
('70000000-0000-4000-8000-00000000000f','corps-5','Construire un projet d''entraînement','Planifier et réguler un projet d''entraînement personnel selon un objectif. Niveau lycée.','capacite-corporelle',4,false,3,'etabli',0.92,array['Programmes d''éducation physique et sportive (EPS)']),
-- Langues du monde (savoir-faire) — calé CECRL.
('70000000-0000-4000-8000-000000000010','lang-1','Saluer et se présenter (A1)','Saluer, se présenter et donner des informations personnelles simples dans une langue étrangère. CECRL A1.','savoir-faire',0,true,1,'etabli',0.95,array['CECRL — Cadre européen commun de référence pour les langues']),
('70000000-0000-4000-8000-000000000011','lang-2','Comprendre un message simple (A1-A2)','Comprendre l''essentiel d''un message oral ou écrit lent et simple. CECRL A1-A2.','savoir-faire',1,false,1,'etabli',0.95,array['CECRL — Cadre européen commun de référence pour les langues']),
('70000000-0000-4000-8000-000000000012','lang-3','Échanger sur des sujets familiers (A2)','Tenir une conversation simple sur des sujets familiers. CECRL A2.','savoir-faire',2,false,2,'etabli',0.95,array['CECRL — Cadre européen commun de référence pour les langues']),
('70000000-0000-4000-8000-000000000013','lang-4','Lire et écrire un texte court (A2-B1)','Comprendre et produire un texte court cohérent sur un sujet connu. CECRL A2-B1.','savoir-faire',3,false,2,'etabli',0.95,array['CECRL — Cadre européen commun de référence pour les langues']),
('70000000-0000-4000-8000-000000000014','lang-5','S''exprimer sur des sujets variés (B1)','Décrire, raconter et justifier une opinion sur des sujets variés. CECRL B1.','savoir-faire',4,false,3,'etabli',0.95,array['CECRL — Cadre européen commun de référence pour les langues']),
-- Métiers & artisanats (savoir-faire) — seuil souple (sécurité => on garde 0.95 pour l''outil).
('70000000-0000-4000-8000-000000000015','metier-1','Utiliser des outils de base en sécurité','Identifier et manipuler des outils courants en respectant les règles de sécurité. Niveau primaire/collège.','savoir-faire',0,true,1,'etabli',0.95,array['Référentiels CAP — blocs de compétences professionnelles']),
('70000000-0000-4000-8000-000000000016','metier-2','Lire un plan ou une consigne technique','Interpréter un plan, un schéma ou une fiche de consigne. Niveau collège.','savoir-faire',1,false,1,'etabli',0.92,array['Référentiels CAP — blocs de compétences professionnelles']),
('70000000-0000-4000-8000-000000000017','metier-3','Réaliser un ouvrage simple','Mesurer, découper, assembler pour réaliser un ouvrage simple conforme. Niveau collège.','savoir-faire',2,false,2,'etabli',0.92,array['Référentiels CAP — blocs de compétences professionnelles']),
('70000000-0000-4000-8000-000000000018','metier-4','Contrôler la qualité et corriger','Vérifier la conformité, identifier un défaut et corriger. Niveau CAP.','savoir-faire',3,false,2,'etabli',0.92,array['Référentiels CAP — blocs de compétences professionnelles']),
('70000000-0000-4000-8000-000000000019','metier-5','Conduire un projet d''atelier','Organiser, réaliser et livrer un projet d''atelier de bout en bout. Niveau CAP/bac pro.','savoir-faire',4,false,3,'etabli',0.92,array['Référentiels CAP — blocs de compétences professionnelles'])
on conflict (id) do nothing;

insert into prerequisites (skill_id, prerequisite_id) values
('70000000-0000-4000-8000-000000000002','70000000-0000-4000-8000-000000000001'),
('70000000-0000-4000-8000-000000000003','70000000-0000-4000-8000-000000000002'),
('70000000-0000-4000-8000-000000000004','70000000-0000-4000-8000-000000000003'),
('70000000-0000-4000-8000-000000000005','70000000-0000-4000-8000-000000000004'),
('70000000-0000-4000-8000-000000000007','70000000-0000-4000-8000-000000000006'),
('70000000-0000-4000-8000-000000000008','70000000-0000-4000-8000-000000000007'),
('70000000-0000-4000-8000-000000000009','70000000-0000-4000-8000-000000000008'),
('70000000-0000-4000-8000-00000000000a','70000000-0000-4000-8000-000000000009'),
('70000000-0000-4000-8000-00000000000c','70000000-0000-4000-8000-00000000000b'),
('70000000-0000-4000-8000-00000000000d','70000000-0000-4000-8000-00000000000c'),
('70000000-0000-4000-8000-00000000000e','70000000-0000-4000-8000-00000000000d'),
('70000000-0000-4000-8000-00000000000f','70000000-0000-4000-8000-00000000000e'),
('70000000-0000-4000-8000-000000000011','70000000-0000-4000-8000-000000000010'),
('70000000-0000-4000-8000-000000000012','70000000-0000-4000-8000-000000000011'),
('70000000-0000-4000-8000-000000000013','70000000-0000-4000-8000-000000000012'),
('70000000-0000-4000-8000-000000000014','70000000-0000-4000-8000-000000000013'),
('70000000-0000-4000-8000-000000000016','70000000-0000-4000-8000-000000000015'),
('70000000-0000-4000-8000-000000000017','70000000-0000-4000-8000-000000000016'),
('70000000-0000-4000-8000-000000000018','70000000-0000-4000-8000-000000000017'),
('70000000-0000-4000-8000-000000000019','70000000-0000-4000-8000-000000000018')
on conflict do nothing;
