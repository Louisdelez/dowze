# Backend — architecture de production

> *Le backend complet : maintenable, scalable, optimisé, **fichiers courts**. Base de données **Supabase**
> (local d'abord), logique métier en **NestJS modulaire**. Aucun appel LLM côté serveur (l'IA est externe,
> échange par [`.json`](10-pont-json.md)). Vue d'ensemble : [stack de production](12-stack-production.md).*

---

## 1. Architecture : monolithe modulaire (NestJS)

Pour une équipe réduite, **un monolithe modulaire** bat les microservices (les bénéfices microservices
n'apparaissent qu'au-delà de ~10 devs ; cf. Shopify qui a refactoré *vers* le modulith). On utilise
**NestJS** parce que son **architecture modulaire est imposée** (modules / controllers / services /
injection de dépendances) — exactement ce qui garde des **fichiers courts** et un code maintenable. (NestJS
peut tourner sur l'adaptateur **Fastify** pour la perf.)

> NestJS est un **backend séparé** de Next.js (Next = front). Et il ne tourne **pas** dans les Edge
> Functions de Supabase (Deno) → c'est bien un service à part, connecté au Postgres Supabase.

### Les modules (découpage par feature / vertical slice)
```
src/modules/
  accounts/            # comptes, profils
  skill-graph/         # le graphe de compétences (généré, validé, caché)
  generation/          # orchestration des .json aller (règles + socle + graine)
  import-validation/   # pipeline de validation des .json retour (Zod, clôture)
  progression/         # maîtrise, knowledge tracing (BKT)
  planning/            # planning, présence, minuteur (calcul déterministe)
  spaced-repetition/   # SM-2 (calcul des révisions dues)
  community/           # validation par les pairs, forum, votes, notifications
  rules-baseline/      # règles génératives + socle, versionnés
```
Chaque module : `*.controller.ts` (HTTP fin) · `*.service.ts` (logique) · `*.repository.ts` (accès données)
· `*.dto.ts` + schéma Zod. **Un module n'importe jamais les internes d'un autre** (interface publique
seulement). Structure complète pour les modules complexes (graphe, validation, community), légère pour les
simples (présence/minuteur).

---

## 2. Supabase : données, auth, realtime, storage

Supabase est le **socle Postgres + Auth + RLS + Realtime + Storage** (vrai Postgres, open source).

### Dev local → prod
- **Local** : `supabase init` + `supabase start` (toute la stack en Docker). Schéma **versionné en SQL** :
  `supabase migration new`, `supabase db reset` (rejoue migrations + `seed.sql`, état déterministe).
- **Local → prod** : `supabase link` → `db pull` (récupérer l'état distant) → `db push` (déployer). Toujours
  `db pull` avant `db push`.
- **Prod** : cloud managé **région UE** (backups + PITR + read replicas + SLA) au départ ; **self-hosted EU**
  en option souveraineté.
- ⚠️ **Une seule source de vérité des migrations** : soit le CLI Supabase, soit l'ORM — ne pas mélanger
  (dérive de schéma classique).

### ORM : Drizzle sur le Postgres Supabase
- **Drizzle** (SQL-first, type-safe, petit) convient au **graphe de compétences** (requêtes `WITH RECURSIVE`
  custom). Prisma reste un choix sûr si l'équipe est junior SQL.
- **Connexion** : backend persistant (NestJS en conteneur) → **direct connection port 5432**. (Serverless
  uniquement → transaction pooler **6543** + `prepare:false`/`pgbouncer=true`.) Migrations ORM en 5432.
- Créer un **utilisateur Postgres dédié** à l'ORM (pas `postgres`).

---

## 3. La pipeline de validation des `.json` importés (sécurité critique)

Le `.json` retour (généré par l'IA, voir [pont `.json`](10-pont-json.md)) est une **entrée contrôlée par
l'utilisateur** → validation stricte, schéma **Zod partagé front + back** :

```
1. parse JSON (taille limitée — anti-DoS)
2. schéma Zod STRICT (.strict() : rejette les champs inconnus + types + bornes)
3. cohérence métier : prérequis existants, DAG sans cycle (tri topologique)
4. normalisation/réparation tolérante (défauts pour optionnels)
5. erreurs structurées (chemin + message) → l'utilisateur peut corriger / redemander
```

Garde-fous **non négociables** : **ne jamais exécuter** le contenu (pas de `eval`/`Function`) ; bloquer la
**prototype pollution** (clés `__proto__`/`constructor`/`prototype`) ; borner longueurs/tailles. La
**détection de cycle** est ici (les clés étrangères garantissent « zéro prérequis manquant » mais **pas**
l'absence de cycle — cf. [loi de clôture](../03-ARCHITECTURE/10-noyau-de-regles.md)).

---

## 4. Le graphe de compétences (généré → validé → caché)

- **Modélisation relationnelle** : table `skills` + table `prerequisites(skill_id, prerequisite_id)` avec
  **clés étrangères** (intégrité référentielle = pas de prérequis pendant). Index sur `(skill_id)` et
  `(prerequisite_id)`. Traversée via **recursive CTE** (`WITH RECURSIVE` + `UNION` pour dédupliquer, colonne
  `CYCLE` Postgres ≥14 contre les boucles). **Pas de Neo4j** à cette échelle (un CTE profondeur 2-3 =
  microsecondes).
- **Cache** : une fois une portion **générée → validée**, on la **met en cache** (Redis, **cache-aside**)
  avec des **clés versionnées** (`skill-graph:v{n}`) → invalidation = bump de version (zéro purge fragile).

---

## 5. Calculs déterministes (pas d'IA)

L'intra **calcule** elle-même, de façon fiable et gratuite :
- **Knowledge tracing (BKT)** : probabilité de maîtrise par compétence (voir [cerveau pédagogique](02-cerveau-pedagogique.md)).
- **Répétition espacée (SM-2)** : dates de révision dues (pure arithmétique).
- **Planning** : agencement à partir des créneaux + révisions dues + prochaine compétence (voir
  [planning & régularité](11-planning-regularite.md)).

---

## 6. Cache, jobs, temps réel

- **Redis** : cache-aside (graphe, sessions), **rate limiting** (sliding-window sur auth/upload), TTL
  systématique.
- **BullMQ** (sur Redis) : file de **validation par les pairs**, notifications, tâches différées. Règles de
  prod : `maxmemory-policy=noeviction`, **idempotence** (un job rejoué ne double pas un vote/email),
  **backoff exponentiel**, **DLQ** + alerte, `removeOnComplete`, **graceful shutdown** (branché au cycle de
  vie NestJS).
- **Temps réel = Supabase Realtime** (inclus) : **Broadcast** (chat communauté), **Presence** (« qui est en
  ligne »), Postgres Changes (mises à jour). S'abonner **avec filtres**, se désabonner au démontage.
  *(Pas besoin d'un serveur temps réel séparé — Supabase le fournit.)* ⚠️ Limites Realtime **par tier**
  (connexions concurrentes) — souvent le **premier mur** atteint (pics en « cours »/examens) → dimensionner.

---

## 7. Auth & sécurité

- **Auth = Supabase Auth** (GoTrue) : rôles `anon` / `authenticated`, JWT. Sessions web en **cookie
  `HttpOnly`/`Secure`/`SameSite`**.
- **RLS (Row-Level Security) = défense en profondeur**, activée sur **toutes** les tables exposées, **sous**
  l'autorisation applicative NestJS (RBAC : élève / pair / mentor / modérateur).
  - Optimisation officielle : `(select auth.uid()) = user_id` (initPlan caché) + **indexer** les colonnes
    des policies (gain >100×).
  - ⚠️ Quand NestJS se connecte avec les credentials DB, il **bypasse RLS** → si on veut que RLS protège
    aussi le backend, **propager l'identité** par transaction : `SET LOCAL request.jwt.claims …`.
- **Clés** : la **secret/`service_role` key** (BYPASSRLS) est **backend-only** — **jamais** côté navigateur.
- **RGPD / mineurs** : région **UE** + **DPA signé** ; consentement parental paramétrable par pays (seuil
  **13-16 ans** selon l'État, art. 8 RGPD) ; minimisation ; droit à l'effacement. Détail :
  [juridique & conformité](06-stack-et-conformite.md) et [sécurité mineurs](../07-RISQUES-ETHIQUE/03-securite-mineurs.md).

---

## 8. Observabilité, tests, CI/CD, déploiement

- **Observabilité** : logs structurés **pino** → **OpenTelemetry** (traces/metrics corrélées via
  `trace_id`) → **Sentry** (erreurs). Corrélation log ↔ trace pour débugger vite.
- **Tests** : **Vitest** (unitaire/intégration) + **Testcontainers** (Postgres/Redis **réels**, pas des
  mocks → attrape les vrais bugs SQL) + **Playwright** (e2e). CI : lint + typecheck + tests + build image.
- **Déploiement** : **API NestJS + workers BullMQ en conteneurs Docker** (scale horizontal, stateless car
  sessions en Redis) ; **Supabase** (cloud EU ou self-hosted) ; **Next.js** sur Vercel ou même cluster ;
  Redis managé. ⚠️ Éviter le serverless pour les **workers BullMQ longue durée**.
- **Scalabilité** : **Supavisor** (connection pooling — Postgres plafonne ~100 connexions sinon) dès la
  prod ; **read replicas** quand la lecture domine (catalogues, dashboards) ; index RLS.

---

## 9. Maintenabilité (fichiers courts) — la règle

- Couches : `controller` → `service` → `repository` → `dto`/schéma Zod, **colocalisés par module**, tests à
  côté (`*.spec.ts`).
- Cible **~200-300 lignes/fichier**, fonctions < ~50 lignes. **ESLint** (`max-lines`,
  `max-lines-per-function`, complexité cyclomatique) **en CI** pour faire respecter automatiquement.
- ⚠️ Ne pas imposer rigidement toutes les couches à *toutes* les features (sinon explosion de fichiers) :
  structure complète pour les modules complexes, légère pour les simples. Un fichier cohérent de 350 lignes
  vaut mieux que 3 fichiers coupés artificiellement.

---

## Synthèse backend

Monolithe modulaire **NestJS** sur le **Postgres Supabase** (local → prod EU), **Drizzle** (graphe en
recursive CTE), pipeline de **validation Zod stricte** des `.json`, **Redis** (cache-aside + rate limit),
**BullMQ** (file des pairs, idempotent + DLQ), **Supabase Realtime** (Broadcast/Presence), **Auth Supabase
+ RLS** en défense en profondeur, **pino/OTel/Sentry**, **Vitest/Testcontainers/Playwright**, déploiement
**Docker + scale horizontal**, code **modulaire à fichiers courts**.

> **Points de vigilance** : cycles dans le graphe (CTE + détection), idempotence des jobs, sécurité du
> `.json` (strict + prototype pollution + jamais d'exécution), propagation d'identité pour RLS, secret key
> backend-only, dimensionner les connexions Realtime, une seule source de vérité des migrations.

**Sources** : Shopify modulith ; NestJS docs ; Supabase docs (local, self-hosting, RLS, Realtime, ORM,
clés) ; Drizzle/Prisma ; Zod ; Redis (cache-aside) ; BullMQ (going to production) ; pino/OpenTelemetry/
Sentry ; Testcontainers. Détail : [bibliographie](../09-ANNEXES/01-bibliographie.md).
