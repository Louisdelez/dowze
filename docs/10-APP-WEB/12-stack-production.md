# Stack de production — vue d'ensemble

> *La pile technique pour construire Dowze en **production** (pas un MVP) : maintenable, scalable, optimisée,
> pro. Code **modulaire à fichiers courts**. Base de données **Supabase** (local d'abord, prod ensuite). UI
> **moderne et épurée** (design system Notion-like). Détails : [frontend](13-frontend.md) ·
> [backend](14-backend.md).*

Ce document **remplace le cadrage « MVP »** de [06-stack-et-conformite](06-stack-et-conformite.md) (qui
reste la référence RGPD/conformité).

---

## La pile, d'un coup d'œil

| Couche | Choix | Pourquoi |
|--------|-------|----------|
| **Frontend** | Next.js 15 (App Router) + React 19 + TypeScript | Standard de prod, Server Components matures |
| **Styling** | Tailwind CSS v4 + **shadcn/ui** | Composants qu'on possède (zéro lock-in), accessibles (Radix) |
| **Design system** | `getdesign add notion` → `DESIGN.md` mappé sur les tokens shadcn | Direction visuelle épurée Notion-like |
| **Données / Auth / Realtime / Storage** | **Supabase** (local → prod) | Postgres + Auth + RLS + Realtime + Storage en un, open source, pas de lock-in |
| **Backend (logique métier)** | **NestJS** (monolithe modulaire) sur le Postgres Supabase | Modularité imposée → fichiers courts, maintenable |
| **ORM** | **Drizzle** (SQL-first) sur Postgres Supabase | Graphe de compétences = SQL custom (recursive CTE) |
| **Validation** | **Zod** (schéma unique partagé front + back) | Cohérent avec le [pont `.json`](10-pont-json.md) |
| **Cache** | **Redis** (cache-aside, clés versionnées) | Cacher le graphe généré-validé ; rate limiting |
| **Jobs async** | **BullMQ** (sur Redis) | File de [validation par les pairs](09-validation.md), notifications |
| **Temps réel** | **Supabase Realtime** (Broadcast / Presence) | Inclus ; communauté, présence, notifications live |
| **Observabilité** | pino + OpenTelemetry + Sentry | Logs structurés + traces corrélées |
| **Tests** | Vitest + Testcontainers + Playwright | Unitaire / intégration (Postgres réel) / e2e |
| **Déploiement** | Docker (API + workers) · Supabase EU · Next.js sur Vercel/cluster | Stateless, scale horizontal |

> ⚠️ **Important sur `getdesign`** : `npx getdesign@latest add notion` ne génère **pas** de code — il écrit
> un fichier **`DESIGN.md`** (une charte de design épurée façon Notion) que l'agent de code applique sur tes
> composants **shadcn/Tailwind**. C'est un *brief de design*, pas une librairie. Détail : [frontend](13-frontend.md).

---

## Supabase, local d'abord (le choix de base de données)

C'est le socle **données + auth + realtime + storage**, et c'est un vrai **Postgres** (pas une abstraction).

- **Développement = 100 % local** : `supabase init` puis `supabase start` lancent toute la stack en Docker
  (Postgres, Auth/GoTrue, PostgREST, Realtime, Storage, Studio). **Parité de cœur** avec la prod (mêmes
  composants open source). Gratuit, reproductible en équipe, schéma **versionné en SQL** dans le repo.
- **Production** : démarrer en **cloud managé région UE** (backups + PITR + read replicas + SLA inclus),
  garder le **self-hosted EU** comme option de souveraineté quand l'équipe ops existe. **Pas de lock-in
  fort** (c'est du Postgres + open source) → migration cloud ↔ self-hosted réaliste.
- **Souveraineté / RGPD / mineurs** : région UE dès la création + DPA signé ; self-hosted possible pour une
  souveraineté maximale (la stack Docker ne fait remonter aucune télémétrie).

Détail (migrations, ORM sur Supabase, scalabilité, RLS) : [backend](14-backend.md).

---

## Principes d'architecture (les règles non négociables)

1. **Monolithe modulaire, pas microservices.** Pour une équipe réduite, un *modulith* bien découpé donne la
   maintenabilité des microservices sans le coût opérationnel distribué (cf. Shopify ; seuil microservices
   ~10 devs). Découpage **par feature / vertical slice**.
2. **Séparation des couches** : `controller` (HTTP fin) → `service` (logique) → `repository` (accès données)
   → `dto` + schéma Zod. Tests colocalisés.
3. **Fichiers courts** : cible **~200-300 lignes/fichier**, fonctions < ~50 lignes. Imposé en CI par ESLint
   (`max-lines`, `max-lines-per-function`, complexité). *Un fichier = une responsabilité.*
4. **Un seul schéma source de vérité** (Zod) partagé front + back : formulaires, validation API, typage TS,
   et validation du pont `.json`.
5. **Stateless + Redis** pour les sessions → **scale horizontal** derrière un load balancer.
6. **Supabase = données/auth/realtime/storage ; NestJS = logique métier.** RLS comme **défense en
   profondeur** *sous* l'autorisation applicative.

---

## L'architecture en une image

```
┌───────────────────────────────────────────────────────────────────┐
│  FRONTEND — Next.js 15 (App Router) + Tailwind v4 + shadcn/ui        │
│  UI épurée (DESIGN.md notion) · PWA offline · a11y WCAG 2.2 AA       │
│  TanStack Query (server state) + Zustand (UI) · RHF + Zod            │
└───────────────┬───────────────────────────────────┬────────────────┘
                │ (REST/RPC, SSE)                     │ supabase-js
                ▼                                     ▼
┌───────────────────────────────┐        ┌────────────────────────────┐
│  BACKEND — NestJS (modulaire)  │        │  SUPABASE                   │
│  modules : skill-graph,        │        │  Postgres (RLS) · Auth      │
│  generation, import-validation,│◄──────►│  Realtime · Storage         │
│  progression, planning,        │  SQL   │  (local en dev, EU en prod) │
│  spaced-repetition, community  │ (5432) │                            │
│  + Redis (cache) + BullMQ      │        └────────────────────────────┘
└───────────────────────────────┘
        (aucun appel LLM : l'IA est externe, échange par .json)
```

---

## Ce que la stack garantit

| Exigence | Comment |
|----------|---------|
| **Production, pas MVP** | Postgres managé/HA, Redis, jobs, observabilité, tests, CI/CD |
| **Maintenable** | Monolithe modulaire, couches séparées, fichiers courts, schéma Zod unique |
| **Supporte la charge** | Stateless + scale horizontal, Supavisor (pooling), Redis, read replicas |
| **Optimisée** | RSC/streaming côté front, cache-aside du graphe, index RLS |
| **Pro / souverain** | Supabase EU (ou self-hosted), RGPD, RLS, pas de lock-in |
| **UI moderne & épurée** | Next + shadcn + DESIGN.md notion, calm tech, a11y |

**Suite** : [frontend (UI/UX, design system, perf)](13-frontend.md) · [backend (architecture, Supabase,
jobs, sécurité)](14-backend.md). Sources : [bibliographie](../09-ANNEXES/01-bibliographie.md).
