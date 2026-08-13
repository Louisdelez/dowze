# 04 — Plan d'implémentation

> Plan phasé, du plus fondamental au plus visible. Les phases **P0–P2 (cœur)** débloquent tout : sans elles,
> aucun plugin ne peut s'intégrer proprement. Les plugins (**P4–P5**) ne sont que des consommateurs du cœur.
> Chaque phase est livrable + testable indépendamment (typecheck/tests/déploiement, comme le reste de Dowze).

## Vue d'ensemble

| Phase | Titre | Débloque | Effort |
|------|-------|----------|--------|
| **P0** | Fondations monorepo & session partagée | tout le front multi-apps | moyen |
| **P1** | Registre de plugins & scopes | activation/permissions | moyen |
| **P2** | Contribution au planning (orchestrateur multi-source) | **sport/repas dans le calendrier** | élevé |
| **P3** | IA/RAG scopée pour plugins | compose/ingest côté plugin | moyen |
| **P4** | AppLauncher + 1er plugin : **Fitness** | 1re verticale en ligne | élevé |
| **P5** | Plugins **Sports** & **Alimentation** | l'écosystème | moyen (réplication) |

---

## P0 — Fondations : monorepo, packages partagés, SSO `.dowze.ch` — ✅ **FAIT (2026-07-22)**

> **Livré & vérifié en prod.** Les 4 packages partagés existent (`@dowze/auth`, `@dowze/config`, `@dowze/ui`,
> `@dowze/api-client`). Academie tourne sur `@dowze/auth` : la session est un **cookie `.dowze.ch`**
> (fragmenté, `Secure`/`SameSite=Lax`), vérifiée en ligne (cookie `dowze-auth.0` sur `domain=dowze.ch`,
> persistée au rechargement). `globalLogout` révoque le refresh token + purge le cookie. `@dowze/ui` et
> `@dowze/api-client` sont des **skeletons** (remplis en P4 / P1-P3). Durcissement `HttpOnly` (SSR
> `@supabase/ssr`) reporté. **Prochaine étape : P1** (registre & scopes).

**But** : rendre le monorepo prêt à accueillir plusieurs apps qui partagent identité et UI.

- **Packages partagés** (nouveaux, dans `packages/`) :
  - `packages/config` — ESLint/TS/Tailwind partagés (extraire l'existant).
  - `packages/ui` — design system : sortir les composants réutilisables d'`apps/web` (Button, Card, icons
    Lucide, etc.) + le futur `AppLauncher`. **Icônes Lucide only.**
  - `packages/auth` — client Supabase préconfiguré : cookie de session `Domain=.dowze.ch`
    (`@supabase/ssr`, `HttpOnly`/`Secure`/`SameSite=Lax`), hooks de session, **endpoint de logout global**.
  - `packages/api-client` — squelette du SDK typé (rempli en P1/P3 depuis l'OpenAPI).
- **SSO** : basculer `apps/web` (academie) sur `packages/auth` (cookie parent). Vérifier que la session
  survit d'un sous-domaine à l'autre. Logout global qui révoque le refresh token.
- **Convention** : `apps/web` reste `academie` (renommage optionnel plus tard pour éviter de casser le
  déploiement prod immédiatement).
- **Livrable** : monorepo restructuré, academie tourne sur les packages partagés, session partageable.
- **Risque** : le cookie de domaine parent + XSS discipline ; tester la révocation.

## P1 — Cœur : registre de plugins & modèle de scopes — ✅ **FAIT (2026-07-22)**

> **Livré & vérifié en prod.** Migration `0045` (`plugin_registry` + `user_plugin_activation`, plugin fictif
> **Fitness** seedé). Schémas `2.44.0` (`@dowze/schemas/plugins` : scopes, manifest, `satisfiesMinCore`).
> Module API **`plugins`** sous **`/v1/`** : `GET /v1/plugins` (catalogue), `GET /v1/plugins/mine/:profileId`
> (catalogue + activation), `POST …/:pluginId/activate` (octroi de scopes + config validée contre
> `configSchema`, compat `min_core_version`, moindre privilège), `POST …/:pluginId/deactivate` (révocation).
> **Middleware de scopes** (`PluginScopeGuard` + `@RequirePluginScope`) prouvé par `GET
> …/:pluginId/scope-check/:profileId`. **Bus d'événements** = Redis pub/sub existant (`RealtimeService`) →
> `plugin.activated`/`plugin.deactivated`. **Doc OpenAPI** : `docs/12-PLUGINS/openapi-v1.yaml`.
> **Tests live** : catalogue OK ; scope-check avant activation **403** ; activation **201** ; scope-check
> après **200** ; scope requis manquant **400** ; config hors-enum **400** ; après révocation **403**. Client
> Credentials (identité d'app serveur-à-serveur) scaffoldé (`client_secret_hash`) — enforcement complet en P4.
> **Prochaine étape : P2** (contribution au planning).

**But** : le cœur sait déclarer, activer (par utilisateur) et autoriser des plugins.

- **Migrations** : `plugin_registry` (id, name, subdomain, manifest_version, api_version, scopes_requested,
  status, min_core_version) + `user_plugin_activation` (user_id, plugin_id, enabled, granted_scopes, config_json).
- **Module API `plugins`** : `GET /v1/plugins` (catalogue), `POST /v1/plugins/:id/activate` / `deactivate`
  (par utilisateur, avec octroi de scopes + config validée par `configSchema`), vérif de compatibilité
  (`min_core_version`, `api_version`).
- **Middleware de scopes** : chaque appel plugin porte une **identité d'app** (Client Credentials) + le JWT
  utilisateur ; le middleware vérifie que le scope requis a bien été **accordé** par l'utilisateur pour ce
  plugin. Moindre privilège, révocable.
- **Versionnement API** : introduire le préfixe **`/v1/`** + un doc OpenAPI. Politique de dépréciation N/N-1.
- **Event bus** : `NestJS EventEmitter` interne + canal **Supabase Realtime** pour diffuser les événements
  (`calendar.entry.created`, `plugin.deactivated`…).
- **Livrable** : on peut enregistrer un plugin fictif, l'activer pour un utilisateur, et un appel scopé
  passe/échoue selon les scopes accordés.

## P2 — Cœur : contribution au planning (le morceau central) — ✅ **FAIT (2026-07-22)**

> **Livré & vérifié en prod.** Migration `0046` (`recurring_commitments` + `calendar_entries`). Schémas
> `2.45.0` (`@dowze/schemas/calendar` : `RecurringActivity`, `CalendarEntry` ; type de bloc `plugin` +
> métadonnées d'affichage). **Orchestrateur multi-source** (`@dowze/core weeklySchedule`) : résolution en
> couches priorité/position — étude protégée jamais évincée, activités récurrentes espacées (jours
> alternés), séance modérée AVANT l'étude (boost cognitif), intense en fin de journée, cap OMS/jours de
> repos respectés, **non-régression étude-seule** ; **15 tests** verts. **API `/v1/calendar`** (scope
> `calendar:write`) : `POST /recurring`, `DELETE /recurring/:profileId/:sourceApp/:sourceRef`,
> `POST /entries` (conflit → 409, émet `calendar.entry.created`), `GET …`. `schedule.view` fusionne les
> récurrents des plugins **activés**. **UI** : le calendrier affiche les blocs plugin (couleur/icône du
> manifeste, palette safelistée) ; la fiche popup a un bouton **« Ouvrir dans Fitness »** (deep-link
> sous-domaine). **Test live** : « sport 3×/sem » modéré → placé lun/mer/ven, **1er bloc avant l'étude**,
> langue+révisions préservées ; scope 403 avant activation / 201 après ; entrée ponctuelle 201 +
> chevauchement 409. **Prochaine étape : P3** (IA/RAG scopée) ou **P4** (Fitness, 1re verticale).

**But** : un plugin peut inscrire des **activités récurrentes** dans le calendrier, orchestrées avec l'étude.

- **Migration** : `calendar_entries` (projection) — `profile_id`, `source_app`, `source_ref`, `entry_type`,
  `title`, `start`, `duration_min`, `scope`, `status`. + `recurring_commitments` (déclarations des plugins :
  fréquence, durée, intensité, contraintes dures/souples, priorité, missPolicy).
- **API de contribution** (scope `calendar:write`) : `POST /v1/calendar/recurring` (déclarer une activité
  récurrente), `POST /v1/calendar/entries` (entrée ponctuelle : match, événement), `DELETE …`. Le cœur
  applique ses **invariants** (conflits, récupération, repos, cap OMS) puis émet `calendar.entry.created`.
- **Orchestrateur multi-source** (`@dowze/core`, extension de `weeklySchedule`) : fusionne les blocs d'étude
  **et** les activités récurrentes des plugins par **résolution en couches** (contraintes dures → priorités
  → préférences souples), avec heures stables (ancrage), habit-stacking, règles cognitives (séance modérée
  avant l'étude ; interdit intense avant bloc exigeant), récupération réservée, marge tampon,
  **replanification non-punitive** des séances manquées. Cf. [02-contrat-planning-recurrent.md].
- **UI** : le calendrier (déjà construit) affiche les entrées plugin (type/couleur via `contributes`) ; la
  fiche popup d'événement a un bouton « Ouvrir dans Fitness » (deep-link vers le sous-domaine).
- **Livrable** : une activité récurrente de test (« sport 3×/sem ») apparaît dans le planning academie,
  placée correctement (espacée, avant l'étude si modérée, jamais avant un examen), replanifiée si manquée.
- **Note** : c'est la phase la plus lourde et la plus à valeur — elle réalise l'ask central de Loïc.

## P3 — IA/RAG scopée pour plugins — ✅ **FAIT (2026-07-22)**

> **Livré & vérifié en prod.** Schémas `2.46.0` (`@dowze/schemas/plugin-ai` : `ComposePluginBody`,
> `IngestPluginBody` avec spec de champs sérialisable). Module API **`plugin-ai` `/v1/ai`** (scope
> `ai:infer`) : `POST /v1/ai/compose` (déterministe, sans coût — assemble un prompt lisible depuis le
> contexte du plugin + un `closingPrompt` pour le résumé de fin) et `POST /v1/ai/ingest` (résumé + champs →
> schéma Zod construit à la volée → **proxy vers `CopiloteService.generateStructured`**, crédits/BYOK
> réutilisés). Fidèle au modèle compose/ingest : Dowze orchestre, le coach reste l'IA de l'élève. **Doc
> OpenAPI** mis à jour. **Test live** (BYOK DeepSeek) : compose **403** sans `ai:infer` / **201** avec ;
> ingest d'un résumé de séance → snapshot `{exercices:[…], dureeMin:55, ressenti, douleur:true}`,
> `creditsSpent:0` (BYOK). **Prochaine étape : P4** (AppLauncher + Fitness, 1re verticale en ligne).

**But** : un plugin utilise l'IA de Dowze (compose/ingest) via un contrat scopé, sans réimplémenter l'IA.

- **API** (scope `ai:infer`) : `POST /v1/ai/compose` (le plugin fournit un contexte → prompt lisible) et
  `POST /v1/ai/ingest` (résumé texte → snapshot structuré), qui **proxifient** vers
  `CopiloteService.generateStructured` / `compose` / `ingest` existants (crédits/BYOK réutilisés, RAG
  structuré accessible selon le scope). Fidèle au modèle **compose/ingest** : l'IA de Dowze orchestre, le
  prof/coach reste l'IA de l'élève.
- **Livrable** : un plugin peut composer un prompt de séance et ingérer un résumé, facturé/scopé proprement.

## P4 — AppLauncher + 1er plugin : Fitness — ✅ **FAIT (2026-07-22)**

> **Livré : `fitness.dowze.ch` EN LIGNE.** `packages/ui` : `AppLauncher` (grille des apps, Lucide inline).
> **`apps/fitness`** (Next.js) : session partagée `@dowze/auth` (SSO, zéro re-login), SDK `@dowze/api-client`,
> écrans « Ma forme » (régularité non-punitive, prochaine séance→planning, compose/ingest), Réglages
> (objectif hebdo, **consentement santé Art. 9 séparé & révocable**), porte d'activation. **Schéma `fitness`**
> (migration `0047` : `fitness_sessions` + **RLS** — le plugin possède sa donnée). **Manifeste**
> `apps/fitness/dowze-plugin.yml` (registre déjà seedé en 0045). **Intégration planning** : l'app déclare
> `fitness.workout` via `/v1/calendar/recurring` → apparaît dans le planning académie (P2). **IA** compose/
> ingest via `/v1/ai` (P3). **Infra** : `apps/fitness/Dockerfile` + service compose `fitness` (réseau `edge`),
> **cert** ajouté au SAN dowze (acme.sh), **DNS** A record (Infomaniak API), routeur Traefik file provider,
> et — clé — ajout du **SNI `fitness.dowze.ch` → 10.0.0.4 dans le reverse-proxy nginx du VPS** (l'IP publique
> 51.178.51.40 est portée par le VPS qui route par SNI vers prod ; academie/api/supabase y étaient, pas
> fitness). **Prochaine étape : P5** (Sports & Alimentation — réplication du patron).

**But** : mettre la première verticale en ligne, prouver la plateforme de bout en bout.

- `packages/ui` : **AppLauncher** (barre + grille des apps activées + profil + notifications), intégré à
  academie et fitness.
- **`apps/fitness`** (Next.js) : écrans « Ma forme », programme, progression, réglages (objectif hebdo,
  **consentement santé** séparé). Utilise `packages/{ui,auth,api-client}`.
- **Schéma `fitness`** (migrations) : `programs`, `exercises`, `workout_sessions`, `progression`,
  `health_profile` (chiffré, non exposé). RLS partout. Manifest `dowze-plugin.yml` + enregistrement au
  registre.
- **Intégration planning** : déclare `fitness.workout` (3×/sem…) via l'API de contribution → apparaît dans le
  calendrier academie.
- **Infra** : `fitness.dowze.ch` — routeur Traefik + service + conteneur web (compose), **DNS Infomaniak**
  (`ik_dns.py`), **cert** (resolver infomaniak). Même motif que academie/api.
- **RGPD** : flux de consentement explicite santé (Art. 9) à l'activation, chiffrement au repos, journal
  d'accès, effacement délégué.
- **Livrable** : `fitness.dowze.ch` en ligne, session partagée avec academie, séances dans le planning
  commun, IA compose/ingest, non-punitif.

## P5 — Sports & Alimentation — ✅ **FAIT (2026-07-22)**

> **Livré : `sports.dowze.ch` et `alimentations.dowze.ch` EN LIGNE.** Migration `0048` (registre sports +
> alimentations + schémas `sports_sessions` / `alimentation_entries` + RLS via `owns_profile()`). Hook
> partagé `useDowzeProfile` (@dowze/auth). **`apps/sports`** (accent sky) : entraînement récurrent
> (`sports.training`) + **matchs à date fixe** (`sports.event` via `/v1/calendar/entries` = contrainte
> dure). **`apps/alimentations`** (accent amber) : meal-prep récurrent (`alimentation.prep`) + idées de
> menus (compose) + journal (ingest) — **garde-fous stricts : régularité only, jamais de comptage calorique
> ni de conseil médical** (pas de scope `health:write`, bannière produit, instructions IA explicites).
> Manifestes `dowze-plugin.yml`. Infra répliquée (Dockerfile + service compose `edge`, cert 6-SAN, 2 A
> records, 2 routeurs Traefik, **2 SNI ajoutés au reverse-proxy VPS**). **Vérifié** : les 2 servent 200 ;
> les **3 verticales orchestrées dans UN seul planning** (fitness emerald ×3, sports sky ×2, alimentation
> amber ×1, placées par l'orchestrateur autour de l'étude). **Écosystème complet — P0→P5 terminés.**

**But** : compléter l'écosystème en **répliquant le patron** (le gros du cœur est déjà fait).

- `apps/sports` + schéma `sports` (disciplines, entraînements, **matchs = contrainte dure**), manifest,
  `sports.training`/`sports.event`, sous-domaine `sports.dowze.ch`. Réutilise la branche « Corps & mouvement »
  de l'Atlas.
- `apps/alimentations` + schéma `alimentations` (repas, recettes, meal-prep), manifest,
  `alimentation.meal`/`alimentation.prep`, sous-domaine `alimentations.dowze.ch`. **Garde-fous** : régularité
  seulement, **jamais** de comptage calorique ni de conseil médical.
- **Livrable** : les 3 verticales en ligne, orchestrées dans un seul planning.

---

## Cross-cutting (toutes phases)

- **Tests de contrat** (OpenAPI) en CI du cœur ET des plugins ; typecheck + tests verts avant chaque déploiement.
- **RGPD** : consentement séparé pour toute donnée sensible ; effacement/portabilité par app propriétaire ;
  journal d'accès sur les schémas santé.
- **Philosophie** : non-punitif, régularité > intensité, IA-orchestratrice (compose/ingest), UI épurée Lucide.
- **Déploiement** : chaque app = conteneur derrière Traefik + sous-domaine + DNS + cert, sur le serveur prod
  32 Go (motif academie/api déjà rodé). Migrations appliquées dans `supabase-db` (schémas dédiés).

## Ordre recommandé & jalons

1. **P0 + P1** (fondations + registre) — socle invisible mais indispensable.
2. **P2** (contribution planning) — **la valeur centrale** : le sport/les repas dans le calendrier orchestré.
3. **P3** (IA scopée) — souvent en parallèle de P2.
4. **P4** (Fitness) — première verticale visible, preuve de bout en bout.
5. **P5** (Sports, Alimentation) — réplication.

**Honnêteté sur l'ampleur** : c'est un chantier **multi-itérations** (plateforme + 3 apps). Le cœur
(P0–P3) est le vrai investissement ; ensuite chaque plugin est une réplication. Recommandation : démarrer par
**P0 → P2** (qui réalisent déjà « les activités récurrentes des plugins dans le planning orchestré par l'IA »),
puis livrer **Fitness** comme premier plugin de bout en bout.
