-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║ seed — Le socle de racines (cas de base de la loi de clôture)          ║
-- ║ Ancré dans docs/03-ARCHITECTURE/11-grammaire-pedagogique.md            ║
-- ╚══════════════════════════════════════════════════════════════════════╝

-- ── Racines (profondeur 0, sans prérequis) ──────────────────────────────
insert into skills (id, slug, title, kind, depth, is_root) values
  ('00000000-0000-4000-8000-000000000001', 'comprendre-oral-l1', 'Comprendre l''oral (langue maternelle)', 'savoir-faire', 0, true),
  ('00000000-0000-4000-8000-000000000002', 's-exprimer-oral-l1', 'S''exprimer à l''oral (langue maternelle)', 'savoir-faire', 0, true),
  ('00000000-0000-4000-8000-000000000003', 'dechiffrer-lire', 'Déchiffrer et lire', 'savoir-faire', 0, true),
  ('00000000-0000-4000-8000-000000000004', 'ecrire-tracer', 'Écrire et tracer', 'savoir-faire', 0, true),
  ('00000000-0000-4000-8000-000000000005', 'denombrer', 'Dénombrer', 'savoir-faire', 0, true),
  ('00000000-0000-4000-8000-000000000006', 'comparer-quantites', 'Comparer des quantités', 'savoir-faire', 0, true),
  ('00000000-0000-4000-8000-000000000007', 'classer-ordonner', 'Classer et ordonner', 'savoir-faire', 0, true),
  ('00000000-0000-4000-8000-000000000008', 'reperer-espace-temps', 'Se repérer dans l''espace et le temps', 'savoir-faire', 0, true),
  ('00000000-0000-4000-8000-000000000009', 'observer-decrire', 'Observer et décrire', 'savoir-faire', 0, true),
  ('00000000-0000-4000-8000-000000000010', 'reconnaitre-emotions', 'Reconnaître les émotions', 'savoir-etre', 0, true),
  ('00000000-0000-4000-8000-000000000011', 'coordonner-corps', 'Coordonner son corps', 'capacite-corporelle', 0, true),
  ('00000000-0000-4000-8000-000000000012', 'interagir-autrui', 'Interagir avec autrui', 'savoir-etre', 0, true);

-- ── Compétences dérivées (profondeur > 0, avec prérequis) ───────────────
insert into skills (id, slug, title, kind, depth, is_root) values
  ('00000000-0000-4000-8000-000000000101', 'lire-comprendre-texte', 'Lire et comprendre un texte simple', 'savoir-faire', 1, false),
  ('00000000-0000-4000-8000-000000000102', 'additionner', 'Additionner', 'savoir-faire', 1, false),
  ('00000000-0000-4000-8000-000000000201', 'resumer-texte', 'Résumer un texte', 'savoir-faire', 2, false);

insert into prerequisites (skill_id, prerequisite_id) values
  -- lire-comprendre-texte ← déchiffrer + comprendre l'oral
  ('00000000-0000-4000-8000-000000000101', '00000000-0000-4000-8000-000000000003'),
  ('00000000-0000-4000-8000-000000000101', '00000000-0000-4000-8000-000000000001'),
  -- additionner ← dénombrer + comparer
  ('00000000-0000-4000-8000-000000000102', '00000000-0000-4000-8000-000000000005'),
  ('00000000-0000-4000-8000-000000000102', '00000000-0000-4000-8000-000000000006'),
  -- résumer ← lire-comprendre + écrire
  ('00000000-0000-4000-8000-000000000201', '00000000-0000-4000-8000-000000000101'),
  ('00000000-0000-4000-8000-000000000201', '00000000-0000-4000-8000-000000000004');

-- ── Une grille d'exemple (validation sans QCM) ──────────────────────────
insert into rubrics (skill_id) values ('00000000-0000-4000-8000-000000000101');
insert into rubric_criteria (id, skill_id, label, required) values
  ('lit-a-voix-haute', '00000000-0000-4000-8000-000000000101', 'Lit un texte simple à voix haute sans buter', true),
  ('repond-questions', '00000000-0000-4000-8000-000000000101', 'Répond à des questions de compréhension littérale', true),
  ('infere-sens',      '00000000-0000-4000-8000-000000000101', 'Infère le sens d''un mot inconnu par le contexte', false);
