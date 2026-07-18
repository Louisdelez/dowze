# Tests d'intégration (Postgres réel)

Ces tests exercent la **vraie base** (migrations + seed + Drizzle + services) sur un
Postgres éphémère lancé par [Testcontainers](https://testcontainers.com/). Ils vérifient
la boucle bout-en-bout : diagnostic → frontière → BKT → validation → maîtrise.

Ils sont **volontairement hors du run unitaire** (`src/**/*.test.ts`) pour que la CI reste
verte sans Docker, et pour ne pas ajouter Testcontainers aux dépendances par défaut.

## Lancer

```bash
# 1. Docker doit tourner.
# 2. Installer le runner (une fois) :
npm i -D @testcontainers/postgresql -w @dowze/api
# 3. Exécuter :
npm run test:int -w @dowze/api
```

Le conteneur `postgres:16-alpine` est démarré, migré et seedé automatiquement, puis détruit.
