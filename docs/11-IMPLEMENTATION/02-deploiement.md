# Déploiement

> *Comment mettre Dowze en production. Deux cibles : le **backend** (API + workers + base + Redis) et le
> **frontend** (Next.js). cf. [stack de production](../10-APP-WEB/12-stack-production.md).*

## Vue d'ensemble

| Composant | Cible recommandée |
|-----------|-------------------|
| **Base de données** | **Supabase managé, région UE** (backups, PITR, read replicas) ; self-hosted EU en option souveraineté. |
| **API (`@dowze/api`)** | Conteneur Docker (image `apps/api/Dockerfile`) sur n'importe quel hôte (Fly, Render, VPS…). |
| **Workers** | Même image, commande `node apps/api/dist/worker.js`. |
| **Redis** | Service managé (cache + files BullMQ). |
| **Frontend (`@dowze/web`)** | **Vercel** (ou même cluster). |

## Backend — Docker / docker-compose

Pour le dev ou l'auto-hébergement, [`docker-compose.yml`](../../docker-compose.yml) lance Postgres + Redis +
API + worker :

```bash
docker compose up --build
# API : http://localhost:3001/health
```

L'image (`apps/api/Dockerfile`) est **multi-stage** : build du monorepo filtré sur `@dowze/api`
(+ `schemas`/`core`), puis `npm prune --omit=dev`, puis runtime `node:22-alpine`.

Variables (cf. [`.env.example`](../../.env.example)) : `DATABASE_URL`, `REDIS_URL`, `API_PORT`,
`SUPABASE_JWT_SECRET` (active la garde JWT en prod).

## Base — Supabase

```bash
supabase link --project-ref <ref>
supabase db push      # applique les migrations de supabase/migrations
```
Région **UE**, DPA signé, RLS activée (défense en profondeur).

## Frontend — Vercel

[`apps/web/vercel.json`](../../apps/web/vercel.json) configure l'install et le build filtré
(`turbo run build --filter=@dowze/web`). Définir les variables `NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_API_URL`. La PWA (service worker) est générée au build de prod.

## Durcissement (déjà en place)

- **helmet** (en-têtes de sécurité) + **rate limiting** (`@nestjs/throttler`, 100 req/min) sur l'API.
- **RLS** Supabase + garde **JWT**. Secret `service_role` **backend-only**.
- BullMQ : `maxmemory-policy=noeviction`, idempotence, backoff, graceful shutdown.
- Une seule source de vérité des migrations (CLI Supabase).

## Checklist de mise en production

1. Supabase EU créé, migrations poussées, RLS vérifiée.
2. Redis managé provisionné.
3. Image API construite et déployée ; **worker** lancé séparément.
4. `SUPABASE_JWT_SECRET` défini (la garde JWT devient effective).
5. Frontend déployé (Vercel) avec les `NEXT_PUBLIC_*`.
6. CI verte ; `npm audit` propre.
