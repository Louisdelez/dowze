# Migrations et releases reproductibles

## Règles

- Une migration SQL publiée ne doit jamais être modifiée : son SHA-256 est enregistré en base.
- `scripts/migrations.sh status` compare le dépôt à `dowze_ops.schema_migrations`.
- `scripts/migrations.sh apply` n'applique que les versions absentes et s'arrête au premier échec.
- `baseline` sert uniquement à enregistrer un schéma historique vérifié ; il exige la confirmation
  `CONFIRM_BASELINE=I_VERIFIED_THE_SCHEMA`.
- Chaque image de production porte le SHA Git immuable, par exemple `dowze/web:c1d6cce`.
- Le tag lisible (`stable`) peut pointer vers le même contenu, mais les fichiers Compose utilisent le SHA.

## Procédure

1. Exécuter sauvegarde et test de lecture Restic.
2. Vérifier Git, puis les tests, le typecheck, le lint et le build.
3. Construire les images depuis un commit propre et les taguer avec le SHA Git sur 12 caractères.
4. Exécuter `scripts/migrations.sh status`, examiner les migrations manquantes puis `apply`.
5. Déployer les images par SHA et conserver les anciens tags jusqu'au smoke-test.
6. Vérifier `/health`, le web, le worker et les principaux parcours.
7. En cas d'échec, restaurer les tags précédents ; une migration destructive exige son propre plan de retour.

## Historique 2026-08-09

La production avait reçu les migrations 0001 à 0068 manuellement, sans table de suivi. Les objets des
migrations récentes ont été contrôlés dans PostgreSQL avant création du registre. Cet état doit être
enregistré comme `baseline`, pas comme une nouvelle application des scripts historiques.
