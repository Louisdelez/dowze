# Plan d'implémentation — Dowze de A à Z

> *De la conception au logiciel. Ce document est la **feuille de route exécutable** qui transforme la
> documentation (dossiers 00-10) en une application réelle, construite proprement, par jalons versionnés.*

---

## 0. Principes

1. **On suit l'architecture déjà documentée** (dossiers [03-ARCHITECTURE](../03-ARCHITECTURE/), [05-TECHNIQUE](../05-TECHNIQUE/),
   [10-APP-WEB](../10-APP-WEB/)) — ce plan ne réinvente rien, il *exécute*.
2. **Code réel, pas de maquette** : chaque brique est du code qui compile, passe le `lint`, le `typecheck`
   et des **tests**. On ne « stubbe » que ce qui dépend d'une infra externe indisponible, et on le signale.
3. **Petits fichiers, slices verticales** (~200-300 lignes max), une responsabilité par fichier (cf.
   [backend](../10-APP-WEB/14-backend.md), [frontend](../10-APP-WEB/13-frontend.md)).
4. **Versionnement** : chaque jalon stable = une **MINOR** SemVer, fusionnée `develop → main` + tag + release
   (cf. [`CONTRIBUTING.md`](../../CONTRIBUTING.md)).
5. **Une seule source de vérité des types** : les **schémas Zod** de `packages/schemas`, partagés front + back
   + validation du pont `.json`.

---

## 1. Contrainte d'environnement (transparence)

| Outil | Dispo | Conséquence |
|-------|-------|-------------|
| Node 24 / npm 11 | ✅ | Build, lint, typecheck, tests, `next build` réels |
| Réseau npm | ✅ | Installation des dépendances |
| **Docker** | ❌ | **Supabase local (`supabase start`) ne tourne pas dans l'environnement de build.** Le code (migrations SQL, schémas Drizzle, modules) est **complet et prêt** ; il suffit de lancer Docker + `supabase start` côté machine de dev pour avoir la base. |
| pnpm (global) | ❌ (droits) | On utilise **npm workspaces + Turborepo** (zéro install global). |

**Ce qui est vérifié automatiquement ici** : `typecheck`, `lint`, **tests unitaires** (logique pure : clôture
du graphe, SM-2, BKT, planning, validation `.json`), `next build`. **Ce qui exige Docker côté dev** :
exécuter la base, les tests d'intégration Testcontainers, le realtime.

---

## 2. Structure du dépôt (monorepo)

```
dowze/
├─ apps/
│  ├─ web/         # Next.js 15 (App Router, RSC) — le portail élève/parent
│  └─ api/         # NestJS (monolithe modulaire) — la logique métier (l'« intra-core »)
├─ packages/
│  ├─ schemas/     # Schémas Zod partagés (source de vérité des types)
│  ├─ core/        # Logique de domaine PURE, sans I/O (clôture, SM-2, BKT, planning, pont .json) + tests
│  └─ config/      # Presets partagés (tsconfig)
├─ supabase/       # config.toml + migrations SQL versionnées + seed (socle de racines)
├─ docs/           # La conception (dossiers 00-11)
└─ (racine)        # turbo.json, tsconfig.base.json, eslint.config.mjs, package.json…
```

**Pourquoi cette forme** : `core` et `schemas` ne dépendent de rien → testables en isolation, réutilisables
par `web` **et** `api`. `api` parle à Supabase (Drizzle) ; `web` parle à `api` (et à Supabase pour l'auth/
realtime). Le **pont `.json`** traverse `web` (UI) → `core` (validation) → `api` (application).

---

## 3. Jalons (chaque jalon = une version)

| Version | Jalon | Contenu | Vérif |
|---------|-------|---------|-------|
| **2.18.0** | **Fondation** | Monorepo (workspaces + turbo), TS strict, ESLint flat, Prettier, squelettes `schemas`/`core`/`config`. | install + typecheck |
| **2.19.0** | **Schémas** | `packages/schemas` complet (compétences, graphe, profil, progression, planning, validation, pont, communauté, parental, modération). | typecheck |
| **2.20.0** | **Cœur** | `packages/core` : loi de clôture R1-R8, SM-2, BKT, planning déterministe, pipeline de validation `.json`, validation par paliers. **Tests Vitest** à forte couverture. | tests verts |
| **2.21.0** | **Données** | `supabase/` : migrations SQL (toutes les tables + FK + index + RLS + recursive CTE), `seed.sql` (socle). | SQL relu, prêt pour `supabase start` |
| **2.22.0** | **Backend** | `apps/api` : modules NestJS (accounts, skill-graph, generation, import-validation, progression, planning, spaced-repetition, community, parental, moderation, rules-baseline) + Drizzle + Auth/RLS + Redis + BullMQ. | build + tests |
| **2.23.0** | **Frontend** | `apps/web` : design system, layout, écrans clés (onboarding/diagnostic, tableau de bord, Cursus, expédition, pont `.json`, planning + minuteur, validation, communauté, parental), PWA, a11y. | `next build` |
| **2.24.0** | **Pont bout-en-bout** | Génération `.json` aller → import `.json` retour validé → application, avec un exemple réel complet pour une compétence du socle. | tests + démo |
| **2.25.0** | **Qualité & CI** | GitHub Actions (lint+typecheck+test+build), READMEs par app, `.env.example`, scripts. | CI verte |

> Les numéros peuvent glisser (un jalon volumineux peut se scinder en plusieurs MINOR). Le **CHANGELOG**
> fait foi.

---

## 4. Définition de « terminé » (Definition of Done)

Un jalon est *fait* quand : le code compile (`typecheck`), passe `lint` et `format:check`, ses **tests
passent**, les fichiers respectent la limite de taille, la doc du module est à jour, et la version est
**fusionnée dans `main` + taguée + release GitHub**.

---

## 5. Stack (rappel, depuis la doc)

- **Front** : Next.js 15 (App Router) · React 19 · TypeScript · Tailwind v4 · shadcn/ui · TanStack Query ·
  Zustand · react-hook-form + Zod · Serwist (PWA). Détail : [13-frontend](../10-APP-WEB/13-frontend.md).
- **Back** : NestJS (modulaire) · Drizzle ORM · Zod · Redis (cache-aside) · BullMQ · Supabase Realtime.
  Détail : [14-backend](../10-APP-WEB/14-backend.md).
- **Données** : Supabase (Postgres + Auth + RLS + Realtime + Storage), local d'abord. Détail :
  [12-stack-production](../10-APP-WEB/12-stack-production.md).
- **Pas d'appel LLM serveur** : l'IA est externe, échange par fichier [`.json`](../10-APP-WEB/10-pont-json.md).

---

*Ce plan vit avec le projet : il est mis à jour à chaque jalon. État courant : voir le
[CHANGELOG](../../CHANGELOG.md) et les [issues/releases GitHub](https://github.com/Louisdelez/dowze).*
