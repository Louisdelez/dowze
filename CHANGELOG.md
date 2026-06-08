# Journal des versions — Dowze

Ce fichier trace l'évolution du document de conception **et de l'implémentation**.

## [2.35.0] — 2026-06-08

### Ajouté — Temps réel (Supabase Realtime)
- **`@dowze/web`** : composant **LiveClasse** — **chat de classe en direct** (broadcast) + **présence**
  (« qui est en ligne ») via Supabase Realtime, intégré à l'écran **/communaute** (s'active dès qu'une
  classe est sélectionnée). Désabonnement propre au démontage.
- **Vérifié** : `next build` + typecheck + lint verts ; **94 tests** ; `npm audit` 0 vulnérabilité.
  *(Le fonctionnement en direct nécessite une instance Supabase active.)*

## [2.34.0] — 2026-06-08

### Ajouté — Minuteur & sonnerie (début Phase 4)
- **`@dowze/core`** : `planning/timer` (PUR) — `segmentAt` (focus/pause + temps restant) et `isBoundary`
  (instant de bascule → sonnerie). Tests (core : 57).
- **`@dowze/web`** : composant **Minuteur** (disque visuel SVG, compte à rebours, **sonnerie douce** via
  Web Audio à résonance décroissante, pause/réinit/mute) sur l'écran **/planning**. Sain, anti-dark-pattern.
- **Vérifié** : build/typecheck/lint verts ; **94 tests** ; `npm audit` 0 vulnérabilité.

## [2.33.0] — 2026-06-08

### Ajouté — Carnet de bord & continuité (fin de la Phase 3)
- **`@dowze/api`** : module **carnet** — `buildResumePrompt` (PUR, testé) reconstruit le **contexte** à
  donner à l'IA (sans mémoire) ; `POST /carnet` (note), `GET /carnet/:profileId` (journal),
  `GET /carnet/:profileId/prompt` (**prompt de reprise** : acquis + prochaine compétence + dernière note,
  méthode socratique). Table Drizzle `carnet_entries`. Routes gardées (api : 30 tests).
- **`@dowze/web`** : écran **/carnet** (journal + génération du prompt de reprise à coller dans l'IA).
- **Vérifié** : build/typecheck/lint verts ; **90 tests** ; `npm audit` 0 vulnérabilité.

## [2.32.0] — 2026-06-08

### Ajouté — Expéditions (cycle Étincelle→…→Trace)
- **`@dowze/core`** : `cursus/expedition` (PUR) — phases du gabarit, `advancePhase`, `phaseProgress`,
  `isComplete`. Tests (core : 53).
- **`@dowze/api`** : module **expeditions** (`GET`/`POST /expeditions`, `GET /expeditions/:id`,
  `POST /expeditions/:id/advance` via `advancePhase`). Tables Drizzle (expeditions, expedition_skills).
- **`@dowze/web`** : écran **/expeditions** (lancer une expédition, suivre les 5 phases, avancer). La
  génération de leçons/grilles à la demande passe par le [pont `.json`](docs/10-APP-WEB/10-pont-json.md)
  existant (`generer-cours` / `generer-grille`).
- **Vérifié** : build/typecheck/lint verts ; **87 tests** ; `npm audit` 0 vulnérabilité.

## [2.31.0] — 2026-06-08

### Ajouté — Onboarding & diagnostic
- **`@dowze/core`** : `computePlacement` (PUR) — à partir des compétences **démontrées**, déduit les acquis
  (clôture des prérequis) et la **première compétence prescrite**. Tests (core : 49).
- **`@dowze/api`** : module **diagnostic** (`POST /diagnostic`, gardé) — calcule le placement et enregistre
  les compétences maîtrisées (BKT à 1).
- **`@dowze/web`** : écran **/demarrer** (« je m'inscris, je fais quoi ? ») — diagnostic à partir des
  compétences fondamentales, placement + première étape. `profileId` pré-rempli depuis la session.
- **Vérifié** : build/typecheck/lint verts ; **83 tests** ; `npm audit` 0 vulnérabilité.

## [2.30.0] — 2026-06-08

### Ajouté — Auth & comptes (Supabase Auth bout-en-bout)
Début de la **Phase 3 (parcours)** — voir [reste-à-faire](docs/11-IMPLEMENTATION/01-reste-a-faire.md).
- **`@dowze/api`** : module **accounts** (`POST /accounts` → crée compte + profil, et le **responsable légal**
  si mineur ; `GET /accounts/:id/profile`). Règles d'inscription **pures** (`onboardingErrors` : email du
  responsable requis pour un mineur) testées (api : 27 tests). **AuthModule** global ; garde JWT
  (`SupabaseAuthGuard`) appliquée à progression/planning/parental (permissive en dev sans secret).
- **`@dowze/web`** : client **Supabase** (lazy), **session persistée** (Zustand), pages **/inscription** et
  **/connexion**, statut d'auth dans l'en-tête.
- **Vérifié** : build/typecheck/lint verts ; **80 tests** ; `npm audit` 0 vulnérabilité.

## [2.29.0] — 2026-06-08

### Ajouté — Système parental & modération
- **`@dowze/api`** : module **moderation** — politique **pure** de gradation (`decideEscalation` : revue
  humaine si moyen+, alerte parent si grave/critique avec mineur auteur OU victime), signalement
  (`POST /moderation/incidents` → prépare une alerte parentale **non envoyée**, validée par un humain),
  file de revue (`GET /moderation/incidents`), décision humaine (`POST /moderation/incidents/:id/action`).
  Module **parental** — responsable légal (`POST /parental/guardians`), consentement (`POST /parental/consent`),
  **synthèse** de haut niveau (`GET /parental/summary/:id` — compteurs uniquement, **jamais** le contenu
  privé). Tables Drizzle (guardians, moderation_incidents, moderation_actions, parental_alerts). **4 tests**
  de politique (api : 25 tests).
- **`@dowze/web`** : écran **/parent** (synthèse bienveillante, façon Pronote).
- **Vérifié** : build/typecheck/lint verts ; **78 tests** ; `npm audit` 0 vulnérabilité.

## [2.28.0] — 2026-06-08

### Ajouté — Communauté & Classes
- **`@dowze/api`** : module **community** — affectation en Classes (`POST /community/form-classes`,
  logique **pure** : contraintes dures langue/fuseau/type + niveaux hétérogènes intra-classe par
  round-robin), classes (`GET`/`POST /community/classes`), adhésion (`POST /community/classes/:id/join`),
  messages de classe (`GET`/`POST /community/classes/:id/messages`). Tables Drizzle (classes, memberships,
  channels, messages). **4 tests** d'affectation (api : 21 tests).
- **`@dowze/web`** : écran **/communaute** (liste des classes + discussion de classe).
- **Vérifié** : build/typecheck/lint verts ; **74 tests** ; `npm audit` 0 vulnérabilité.

## [2.27.0] — 2026-06-08

### Ajouté — Validation par les pairs (modèle École 42)
- **`@dowze/api`** : module **validation** — `GET /validation/rubric/:skillId` (la grille),
  `POST /validation/self` (auto-validation via la grille → **débloque** + mise en file de revue par les
  pairs), `POST /validation/peer` (revue par un pair), `GET /validation/badge/:skillId/:learnerId` (niveau
  de badge auto/pair/expert). Tables Drizzle ajoutées (rubrics, rubric_criteria, validations,
  validation_verdicts, peer_review_queue). Helper **pur** `summarizeValidations` testé (api : 17 tests).
- **`@dowze/web`** : écran **/validation** (charger la grille, cocher les critères démontrés, s'auto-valider).
- **Corrigé** : `parseOr400` renvoie désormais le type de **sortie** Zod (`z.infer`) — les `.default()`
  sont bien appliqués.
- **Vérifié** : build/typecheck/lint verts ; **70 tests** ; `npm audit` 0 vulnérabilité.

## [2.26.0] — 2026-06-08

### Ajouté — Progression (BKT) & planning (SM-2) de bout en bout
Première tranche de **profondeur fonctionnelle** sur les couches déjà posées :
- **`@dowze/core`** : `frontier` — `learnableSkills` / `nextPrescribedSkill` (la **prescription** : ce que
  l'élève peut apprendre maintenant, déterministe). Tests ajoutés (core : 46 tests).
- **`@dowze/api`** : modules **progression** (`GET /progression/:id`, `POST /progression/observe` → mise à
  jour BKT), **spaced-repetition** (`POST /reviews` → SM-2), **planning** (`POST /planning/generate` →
  révisions dues + prochaine compétence, agencées dans les créneaux). Schéma Drizzle complété (sm2_cards,
  availability_slots, planning_entries). Helper de planning **pur** testé (api : 14 tests).
- **`@dowze/web`** : écrans **/progression** (barres de maîtrise) et **/planning** (génération de la semaine),
  reliés à l'API avec états vides/erreurs gracieux.
- **Vérifié** : build/typecheck/lint verts ; **67 tests** ; `npm audit` 0 vulnérabilité.

## [2.25.0] — 2026-06-08

### Ajouté — Intégration continue (CI) & documentation développeur
- **GitHub Actions** (`.github/workflows/ci.yml`) : sur push `main`/`develop` et chaque PR — `npm ci` puis
  **lint + typecheck + test + build** (via Turbo) + `npm audit --audit-level=high`. Annulation des
  exécutions concurrentes.
- **README** : badge CI, section **« L'application (monorepo) »** (structure + commandes de démarrage),
  statut mis à jour.
- Le dépôt passe désormais une **vérification automatique complète** à chaque contribution.

## [2.24.0] — 2026-06-08

### Ajouté — Pont `.json` bout-en-bout (exemple réel + test d'intégration)
- **Fixture réelle** : un `.json` retour complet pour `generer-competence` — la compétence
  *lire-comprendre-texte* **avec toute sa clôture** (les racines *déchiffrer-lire* et *comprendre-oral-l1*),
  alignée sur le seed Supabase.
- **Test bout-en-bout** : l'intra fabrique l'aller → on simule le retour → validation stricte (taille, parse,
  anti prototype-pollution, schéma, **loi de clôture**). Vérifie aussi le **rejet d'une clôture incomplète**
  (trou → `dangling-prerequisite`).
- La page web `/bridge` réalise le même cycle de façon interactive.
- **60 tests** au total ; build/typecheck/lint verts ; 0 vulnérabilité.

## [2.23.0] — 2026-06-08

### Ajouté — `@dowze/web` : le frontend Next.js 15
Le portail, en **Next.js 15 (App Router) + React 19 + TypeScript + Tailwind v4**, design épuré façon Notion :
- **Design system** : tokens Tailwind v4 (`@theme`), 1 couleur d'accent, composants `ui/` (Button, Card),
  calm technology, RSC par défaut.
- **Pages** : accueil (la promesse + piliers), **tableau de bord** (progression BKT, plan du jour),
  **pont `.json`** (générer l'aller, coller le retour, validation — page interactive).
- **Client API** typé (`lib/api.ts`) vers le backend ; réutilise les types `@dowze/schemas`.
- **Vérifié** : `next build` (6 pages statiques générées) + `typecheck` + `lint` verts.

### Corrigé — robustesse de l'installation & sécurité
- `npm` omettait `uid@2.0.2` (dépendance runtime de NestJS) du lockfile dans ce graphe workspaces :
  déclaré explicitement dans `@dowze/api` (workaround).
- **`overrides.postcss ^8.5.10`** pour corriger un avis XSS dans la copie de PostCSS bundlée par Next.
- **`npm audit` : 0 vulnérabilité** sur tout le monorepo.

## [2.22.0] — 2026-06-08

### Ajouté — `@dowze/api` : le backend NestJS (l'intra-core)
Monolithe modulaire NestJS sur Postgres Supabase (Drizzle), **sans appel LLM serveur** :
- **Modules** : `config` (env Zod), `db` (Drizzle/postgres-js, connexion paresseuse), `skill-graph`
  (lecture du graphe + **validation de la loi de clôture** + clôture transitive via `@dowze/core`),
  `bridge` (génération du `.json` aller : prompt + JSON Schema dérivé + exemple ; validation stricte du
  retour), `auth` (garde JWT Supabase), `health`.
- **Endpoints** : `/health`, `/skills`, `/skills/validate`, `/skills/:id/closure`, `POST /bridge/requests`,
  `POST /bridge/responses`.
- **Vérifié** : `build` (tsc) + `typecheck` + `lint` verts ; **8 tests** API (57 au total).
- **Sécurité** : montée à **NestJS 11** + **drizzle-orm ≥ 0.45.2** → **`npm audit` : 0 vulnérabilité**
  (correction d'une injection SQL HIGH dans Drizzle et d'un avis NestJS).
- ⚠️ Exécuter le serveur nécessite Postgres (Supabase local) ; le build/les tests des parties pures non.

## [2.21.0] — 2026-06-08

### Ajouté — `supabase/` : schéma Postgres complet (migrations + seed + RLS)
La base de données versionnée en SQL, prête pour `supabase start` (local d'abord) :
- **7 migrations** : extensions & comptes/profils/parental · graphe de compétences (FK = zéro prérequis
  pendant) + `skill_closure()` (CTE récursive, colonne CYCLE anti-boucle) · apprentissage (BKT, SM-2,
  créneaux, planning, présence) · cursus & validation (expéditions, grilles, validations, file de revue
  par les pairs) · communauté (classes, canaux, messages, binômes) · modération & alertes parentales ·
  **RLS** (défense en profondeur, policies par propriété de profil).
- **`seed.sql`** : le **socle de racines** (12 compétences fondamentales) + compétences dérivées + une
  grille d'exemple.
- **`config.toml`** + **README** (procédure locale).
- ⚠️ Validé par **relecture** (Docker indisponible dans l'environnement de build) — prêt à exécuter via
  `supabase start && supabase db reset` côté machine de dev.

## [2.20.0] — 2026-06-08

### Ajouté — `@dowze/core` : la logique de domaine pure (le cœur), entièrement testée
Toute la logique métier sans I/O, en petits modules testés en isolation (**49 tests** au total) :
- **Loi de clôture R1-R8** (`closure/`) : clôture transitive, détection de cycle, tri topologique, et
  `validateGraph` qui interdit par construction les trous (prérequis pendant), cycles, profondeurs
  non décroissantes, racines incohérentes → **« zéro trou » garanti**. `isPublishable` / `missingPrerequisites`
  pour la boucle validate→repair.
- **BKT** (`bkt/`) : mise à jour bayésienne de la probabilité de maîtrise (posterior + apprentissage),
  seuil de maîtrise.
- **SM-2** (`sm2/`) : répétition espacée (intervalles 1 → 6 → ×EF, facteur de facilité borné, échéances).
- **Planning déterministe** (`planning/`) : agencement des tâches priorisées dans les créneaux (le « quand »).
- **Pont `.json`** (`bridge/`) : pipeline de validation du retour (taille bornée, parse, **anti
  prototype-pollution**, enveloppe stricte, cohérence requestId/opération, payload par opération,
  **clôture du graphe**) + construction du `.json` aller.
- **Validation par paliers** (`validation/`) : grille binaire, agrégation des pairs (≥ 2, majorité stricte),
  niveaux Open Badges, déblocage non bloquant.
- **Vérifié** : `build`/`typecheck`/`lint` verts ; **49 tests** ; `npm audit` 0 vulnérabilité.

## [2.19.0] — 2026-06-08

### Ajouté — `@dowze/schemas` : les schémas Zod partagés (source de vérité des types)
Le socle typé de tout le projet (front + back + validation du pont `.json`), en petits fichiers focalisés :
- **Compétences & graphe** (`skill`) : nœud d'Atlas (nature, profondeur DAG, prérequis, seuil de maîtrise,
  statut épistémique, demi-vie) + liste d'adjacence — base de la **loi de clôture**.
- **Cursus** (`cursus`) : fils (Fondations / Aptitudes durables / Concepts-clés), Expéditions
  (Étincelle→Question→Défi→Acte→Trace), Modules-éclair, phases tronc commun / spécialisation.
- **Profil & graine** (`profile`), **progression BKT** (`progression`), **répétition espacée SM-2**
  (`spaced-repetition`), **planning/présence/minuteur** (`planning`), **contenu/leçon** (`content`).
- **Validation par paliers** (`validation`) : grille (rubrique binaire), paliers auto/IA/pair/expert,
  3 niveaux Open Badges — **pas de QCM**.
- **Pont `.json`** (`bridge`) : enveloppes aller/retour **`.strict()`** + payloads par opération + registre
  opération→schéma (utilisé par `@dowze/core` pour valider le retour).
- **Comptes & parental** (`account`), **communauté/classes** (`community`), **modération + alertes
  parentales** (`moderation`).
- **Vérifié** : `build`/`typecheck`/`lint` verts ; **9 tests** (dont la rigueur stricte du pont).

## [2.18.0] — 2026-06-08

### Ajouté — DÉBUT DE L'IMPLÉMENTATION : fondation du monorepo
Première brique de code : le dépôt devient un **monorepo** prêt à accueillir l'application. Nouveau dossier
[`docs/11-IMPLEMENTATION`](docs/11-IMPLEMENTATION/00-plan.md) avec le **plan complet de A à Z** (jalons,
contrainte d'environnement, Definition of Done).
- **Outillage** : **npm workspaces + Turborepo**, **TypeScript strict** (`tsconfig.base.json`), **ESLint**
  (flat config) + **Prettier**, `.editorconfig`, `.nvmrc`, `.env.example`.
- **Packages** : `@dowze/schemas` (schémas Zod partagés — squelette) et `@dowze/core` (logique de domaine
  pure — squelette + **Vitest**).
- **Structure** : `apps/` (web, api — à venir), `packages/` (schemas, core), `supabase/` (à venir).
- **Vérifié** : `build`, `typecheck`, `lint`, `test` tous **verts** via Turbo ; **`npm audit` : 0 vulnérabilité**.

## [2.17] — 2026-06-08

### Changé — RENOMMAGE du projet : **NOÖS → Dowze**
Le projet s'appelle désormais **Dowze** (le répertoire racine était déjà `DowzeEDUCATION`).
- **Remplacement global** de `NOÖS` (et variantes `Noös`) par `Dowze` sur **l'ensemble de la documentation**
  (303 occurrences, 78 fichiers `.md`).
- **Étymologie supprimée** : les passages qui faisaient dériver l'ancien nom de *noûs* (esprit) +
  *noosphère* ne s'appliquent plus. Réécrits dans [`README.md`](README.md) (Dowze est présenté comme un
  **commun** ouvert, sans étymologie grecque) et dans le [glossaire](docs/00-FONDATIONS/05-glossaire.md)
  (entrée « Dowze » = nom du système et du commun qui le gouverne).
- **Fichiers HTML** (kit + plannings) : contenu mis à jour et fichiers renommés `*-noos.html` →
  `*-dowze.html` ; liens du `README.md` ajustés. (Les entrées de versions antérieures de ce journal citent
  encore les anciens noms `*-noos.html` — historique non réécrit.)
- Aucune autre modification de fond : seul le nom change.

## [2.16] — 2026-06-08

### Corrigé — SÉCURITÉ SANS BRIDER : système parental + modération (l'expérience est la même pour tous)
Correction de fond demandée : **on ne bride pas les mineurs**. L'école est la même pour tous ; la sécurité
vient de la **modération + du suivi parental**, pas de la restriction. Nouveau
[`docs/10-APP-WEB/05-systeme-communautaire/06-systeme-parental-et-moderation.md`](docs/10-APP-WEB/05-systeme-communautaire/06-systeme-parental-et-moderation.md) (1 recherche).
- **Système parental (type Pronote)** : à l'inscription d'un mineur, **email du responsable légal**
  (consentement vérifiable « email plus », COPPA/RGPD ; seuils 13/15/16 selon pays) ; **compte parent
  optionnel** (tableau de bord : progression, planning, présence, auto-éval, **synthèse** communautaire —
  jamais le contenu privé brut) ; sinon **bilan email** périodique (Kraft & Rogers 2015 : **−41 %** d'échec) ;
  **alertes urgentes graduées** (validées par un humain). Suivi = accompagnement, pas surveillance (AAP).
- **Modération forte (type Discord)** : **bots AutoMod** (mots-clés + regex + spam) → **ML toxicité
  bidirectionnel** (détecte qui harcèle ET qui est harcelé ; OpenAI Moderation, pas Perspective seul =
  sunset 2026 ; biais audités) → **modérateurs humains** qui tranchent. Si un **mineur** est auteur OU
  victime d'un incident grave → **alerte parent**. Détresse → escalade humaine + orientation aide.
- **Réalignement** : 04-securite-cold-start et 05-classes §5 réécrits — suppression du « jardin clos qui
  restreint les mineurs / pas de DM 1:1 ». Cadre naturel : communauté = membres inscrits (pas d'inconnus
  aléatoires) → risque réduit sans retirer de fonctionnalité. README sous-dossier + bibliographie alignés.

## [2.15] — 2026-06-08

### Ajouté — Les Classes & la communication (sociabilité d'une vraie école) — 1 recherche
Nouveau [`docs/10-APP-WEB/05-systeme-communautaire/05-classes-et-communication.md`](docs/10-APP-WEB/05-systeme-communautaire/05-classes-et-communication.md).
- **La Classe** = unité sociale (~24, formée auto). Matching : contraintes dures (langue + fuseau/dispo +
  type de classe), objectif souple = **niveaux hétérogènes *dans* la classe** (entraide) / homogènes *entre*
  classes. ⚠️ pas de « styles d'apprentissage ». Deux échelles : Classe (appartenance) + dyades/trios (travail).
- **Cycle de vie + brassage** (la demande clé) : classe **stable un trimestre/semestre** (confiance,
  appartenance) → **rebrassage à chaque cycle** (on change de classe = nouveauté, liens faibles ; Granovetter,
  *Science* 2022 n=20M) → **micro-rotation hebdo des binômes** intra-classe → conserver 1-2 « ponts ».
- **Communication** : messagerie privée, chat de groupe, **visioconférence**, appels, groupes, binômes —
  visio via SDK à jetons (100ms/LiveKit/Daily), study rooms body-doubling (caméra optionnelle, micro coupé),
  pas d'enregistrement par défaut.
- **Sécurité mineurs NON NÉGOCIABLE** : jardin clos (classe/binôme uniquement), pas de DM/visio 1:1
  mineur↔adulte non supervisé, réglages sûrs par défaut, vérif d'âge + consentement parental (COPPA/RGPD-K),
  modération IA (grooming type Thorn) + humaine, journalisation, signalement/blocage 1 clic, notification
  parentale. Modèle Khan (jardin clos), contre-ex. École 42. Possible : adultes d'abord, mineurs ensuite.
- README du sous-dossier + bibliographie alignés.

## [2.14] — 2026-06-08

### Ajouté — LA STACK DE PRODUCTION (3 recherches : frontend, backend, Supabase)
Trois nouveaux docs dans `docs/10-APP-WEB/` (production, pas MVP ; maintenable, scalable, fichiers courts) :
- [`12-stack-production.md`](docs/10-APP-WEB/12-stack-production.md) — vue d'ensemble : pile complète,
  principes (monolithe modulaire, fichiers ~200-300 l, schéma Zod unique), **Supabase local-first**,
  architecture en image. Remplace le cadrage « MVP » de 06.
- [`13-frontend.md`](docs/10-APP-WEB/13-frontend.md) — Next.js 15 App Router + Tailwind v4 + shadcn/ui ;
  **design system `getdesign add notion`** (= un `DESIGN.md`/brief, PAS du code, mappé sur les tokens
  shadcn) ; UI/UX épurée (calm technology, lois d'UX, zéro dark pattern) ; **a11y WCAG 2.2 AA** ;
  architecture feature-based à fichiers courts (RSC par défaut) ; perf (CWV) ; PWA offline (Serwist +
  IndexedDB) ; TanStack Query + Zustand ; RHF + Zod (schéma partagé back).
- [`14-backend.md`](docs/10-APP-WEB/14-backend.md) — **NestJS modulaire** sur **Postgres Supabase** ;
  **Drizzle** (graphe en recursive CTE) ; pipeline de **validation Zod stricte** des `.json` (prototype
  pollution, détection de cycle, jamais d'exécution) ; graphe **généré→validé→caché** (Redis cache-aside,
  clés versionnées) ; calculs déterministes (BKT, SM-2) ; **BullMQ** (file des pairs, idempotent, DLQ) ;
  **Supabase Realtime** (Broadcast/Presence) ; **Auth Supabase + RLS** en défense en profondeur (identité
  propagée) ; pino/OTel/Sentry ; Vitest/Testcontainers/Playwright ; Docker + scale horizontal.
- **Supabase** validé : dev 100 % local (CLI + Docker, parité de cœur, schéma SQL versionné), prod cloud EU
  managé (PITR/replicas/SLA) puis self-hosted EU en option souveraineté (pas de lock-in). RGPD/mineurs :
  région UE + DPA + consentement parental par pays. Bibliographie enrichie.

## [2.13] — 2026-06-08

### Ajouté — Planning, régularité, présence/absence & minuteur (2 recherches)
Nouveau [`docs/10-APP-WEB/11-planning-regularite.md`](docs/10-APP-WEB/11-planning-regularite.md).
- **Planning** : généré (le « quand » calculé déterministement par l'intra — révisions dues SM-2, créneaux,
  prochaine compétence ; le « quoi » généré par l'IA), personnel, adaptatif, calé sur des plans **SI–ALORS**
  (Gollwitzer, d≈0,65) et des cycles ~90 min. Pas une grille figée à la Pronote.
- **Présence/absence** : détection **automatique objective** (seuil d'activité, pas auto-déclaration) →
  statut neutre « non réalisée » ; règle **« never miss twice »** (Lally 2010) ; ton **auto-compassionnel**
  ; l'absence = **donnée** (patterns → ajustement du planning) ; rattrapage **sans empiler** ; dashboard
  **auto-référencé** (jamais de comparaison sociale). Outil d'auto-régulation (Zimmerman), pas registre
  disciplinaire.
- **Minuteur & sonnerie** : compte à rebours avant le prochain cours ; disque qui se vide (timer visuel
  réduit l'anxiété, Hallez & Vallier 2025 d≈0,42), masquable ; **pauses** (5-10 min, repos éveillé = +
  consolidation, méta-analyse 2025 g≈0,45, mode calme sans écran) ; **sonnerie douce à résonance
  décroissante** début/fin (modèle cloche de pleine conscience), checkpoints optionnels (TDAH/cécité
  temporelle), opt-out total ; sessions **synchronisées optionnelles** (cloche commune, body-doubling).
- **Ligne rouge anti-dark-pattern** maintenue : jamais de série anxiogène/FOMO, comparaison sociale,
  culpabilisation — la métrique reste maîtrise + bien-être, pas le temps passé.

## [2.12] — 2026-06-08

### Livré — LA GRAMMAIRE PÉDAGOGIQUE : l'artefact concret (socle + 21 règles)
Nouveau [`docs/03-ARCHITECTURE/11-grammaire-pedagogique.md`](docs/03-ARCHITECTURE/11-grammaire-pedagogique.md).
C'est **tout ce que l'humain écrit une fois** ; à partir de là, l'IA génère tout :
- **Le socle de racines** : ~20 compétences-racines fondamentales (langage, quantité, raisonnement,
  représentation, soi, corps, social), seules autorisées à n'avoir aucun prérequis — le cas de base de la
  clôture (R6).
- **Les 21 règles génératives**, ancrées sur des invariants intemporels : structure (backward design,
  clôture, décomposition, DAG), conception du cours (Expédition, 5 phases de Merrill, exemples résolus +
  fading, petits pas + ~80 %, récupération, espacement), rôle de l'IA-prof (socratique/faire penser,
  calibrage, difficulté désirable, langue maternelle), évaluation (grille de faits sans QCM, transfert,
  qualité de Biggs, validation non-bloquante), transverses (épanouissement, véracité, sûreté).
- Inclut l'analyse **« pourquoi personne ne l'avait écrit avant »** (barrière technique tombée en 2023-24 ;
  barrières institutionnelles/économiques/psychologiques qui protègent les incumbents ; Alpha/Khanmigo/
  Synthesis s'arrêtent avant la génération). README architecture + glossaire alignés.

## [2.11] — 2026-06-08

### Livré — LE NOYAU DE RÈGLES STRICTES : zéro trou par construction
Nouveau [`docs/03-ARCHITECTURE/10-noyau-de-regles.md`](docs/03-ARCHITECTURE/10-noyau-de-regles.md), fondé sur
une recherche dédiée à la garantie de complétude. C'est l'artefact concret demandé : les **8 règles strictes
(R1-R8)** que l'intra-CORE tient dès le départ, qui rendent le **trou mathématiquement impossible** (et non
« rare »), + le `.json` de génération à donner à l'IA + le flux complet.
- **Loi de clôture (R1)** : générer une compétence = générer toute sa chaîne de prérequis jusqu'aux racines.
- R2 tout-ou-rien (atomique) · R3 aucune référence dans le vide (intégrité référentielle) · R4 générateur
  total · R5 deux lois de complétude vérifiées · R6 socle fini + DAG à niveaux décroissants (terminaison) ·
  R7 contrôle + réparation ciblée en boucle jusqu'à zéro violation · R8 échec visible, jamais trou
  silencieux.
- **Théorème** : socle fini + clôture + interdiction d'arête pendante/orphelin + fail-closed + boucle
  convergente ⇒ tout parcours publié est complet. Zéro trou, CQFD par construction.
- Fondé sur : clôture transitive, intégrité référentielle (FK), résolution de dépendances (npm/apt/Bazel
  A⊆D), fonctions totales, contraintes d'intégrité ASP, récursion bien fondée, gate validation+réparation.
- **Correction de ton** : suppression des passages « il y aura des trous résiduels » dans 09-ecole-generative
  — FAUX avec la loi de clôture. La complétude est **garantie** ; seule la *finesse pédagogique* s'affine
  avec l'usage (≠ trou dans le parcours). Glossaire (loi de clôture) + README architecture alignés.

## [2.10] — 2026-06-08

### Précisé — l'OSSATURE aussi est générée par l'IA (rien n'est créé à la main)
Sur demande de l'utilisateur (« je ne veux rien créer à la main pour chaque compétence »), précision de
[`docs/03-ARCHITECTURE/09-ecole-generative.md`](docs/03-ARCHITECTURE/09-ecole-generative.md), fondée sur une
recherche dédiée. Le squelette de compétences/prérequis n'est **pas importé ni curé par un expert** : il est
**généré par l'IA** via prompt + `.json`, en **génération paresseuse** (le voisinage local à la demande, le
graphe émerge chemin par chemin — modèle iText2KG). « Sans main humaine » = remplacer l'humain par : (1)
**génération séparée de la validation** (LLM génère, validateur déterministe filtre : DAG sans cycle, schéma,
contraintes — cohérence garantie *par construction*, comme l'ASP/PCG) ; (2) **ancrage RAG** sur référentiels
lus (ESCO, manuels), pas import manuel ; (3) **consensus multi-passes** (PAS l'auto-correction nue — réfutée
par Huang et al. ICLR 2024) ; (4) **generate → validate → cache** (régénérer seulement sur invalidation) ;
(5) **boucle d'usage** qui comble les trous sémantiques (seul capteur à l'échelle). **Risque résiduel assumé**
: structure propre garantie, mais justesse des prérequis et finesse pédagogique plafonnent → les premières
générations ont des trous, comblés par l'usage, pas par une perfection initiale. Glossaire (Ossature) aligné.

## [2.9] — 2026-06-08

### Ajouté — L'ÉCOLE GÉNÉRATIVE : stocker des règles, pas du contenu (principe anti-obsolescence majeur)
Nouveau [`docs/03-ARCHITECTURE/09-ecole-generative.md`](docs/03-ARCHITECTURE/09-ecole-generative.md),
fondé sur 2 recherches. L'intra **ne stocke pas de contenu périssable** (cours, grilles, compétences
détaillées) mais un **petit noyau intemporel** : **règles génératives** + **ossature minimale** (graphe de
compétences durables) + **schémas** + **principes**. L'IA **génère** le contenu à la demande (via le pont
`.json`), toujours à jour. Principe « l'usage infini de moyens finis » (Chomsky/Humboldt ; L-systèmes ;
PCG ; Constitutional AI ; Infrastructure-as-Code).
- **Règles intemporelles** = sciences de l'apprentissage (Rosenshine, Deans for Impact), conception
  (backward design, Merrill, Bloom), évaluation (validité/fiabilité/équité/alignement de Biggs).
- **Nuance honnête intégrée** : règles seules ≠ complétude → **ossature stable** (graphe de prérequis,
  cohérence *mesurable*) + **garde-fous** (RAG, validation par schéma, auto-critique, revue humaine).
  Risque n°1 = qualité de la génération (biais, trous, homogénéisation — chiffré).
- **Gouvernance** : on versionne et améliore **les règles**, jamais le contenu (jetable) ; tests de
  non-régression ; détection de dérive.
- **Conséquence sur les grilles** : on ne stocke même plus une grille par compétence — **une règle** génère
  la grille de n'importe quelle compétence (09-validation aligné). Glossaire enrichi (école générative,
  règles génératives, ossature, graine).

## [2.8] — 2026-06-08

### Corrigé — DEUX décisions d'architecture (validation sans QCM + pont `.json` sans API)
Deux corrections de fond demandées par l'utilisateur, fondées sur 2 recherches dédiées.

**1. Validation SANS QCM (modèle École 42)** — nouveau [`docs/10-APP-WEB/09-validation.md`](docs/10-APP-WEB/09-validation.md).
Créer des QCM pour toutes les branches est ingérable → abandonné. À la place, validation **par paliers**,
un seul bloquant (le plus léger) : **auto-validation** (checklist factuelle, débloque la suite) →
**pré-correction auto** (IA/tests) → **validation par les pairs** (grille binaire, médiane ≥2, appariement
aléatoire, monnaie d'éval, **en file, asynchrone, non-bloquante** — peut prendre des semaines) →
**endossement expert** (optionnel). Le seul artefact par compétence = **une grille**, réutilisée à l'infini.
3 niveaux de preuve coexistent (Open Badges). Sources : École 42, Falchikov & Goldfinch (r≈0,69),
Calibrated Peer Review, Dunning-Kruger, NGLC.

**2. Le pont intra ↔ IA est un fichier `.json`, PAS une API** — nouveau [`docs/10-APP-WEB/10-pont-json.md`](docs/10-APP-WEB/10-pont-json.md).
L'intra génère un **`.json` ALLER** (prompt « quoi faire » + `response_schema` « comment l'écrire » +
exemple), l'élève le donne à son IA, l'IA rend un **`.json` RETOUR** que l'intra **valide** (Ajv strict +
`additionalProperties:false` + `jsonrepair`). Zéro API, zéro clé, compatible abonnement grand public, vie
privée. Sécurité : le `.json` ne porte qu'une auto-validation (la preuve forte = les pairs) ; HMAC côté
serveur. Sources : Anthropic (structured outputs « API-only »), Ajv, jsonrepair, HMAC.

**Docs alignées** : 01-vision-produit (pont `.json`, plus d'API ; validation par pairs), 02-cerveau-pedagogique
(§5 sans QCM), 08-parcours-eleve (étapes 3-4), 05-preuve-passeport (3 niveaux de preuve), 03-prompts,
06-stack, 07-roadmap, README. **L'API n'est plus une « V2 » — elle est écartée par conception.**

## [2.7] — 2026-06-08

### Ajouté — langues, apprentissage à vie, et le savoir comme carte infinie (3 recherches)
- **Les langues** : nouveau [`docs/03-ARCHITECTURE/08-langues.md`](docs/03-ARCHITECTURE/08-langues.md).
  Langue maternelle = fondation absolue (le Mentor pense avec l'élève dans sa L1) ; langues étrangères
  réinventées à l'ère de l'IA traductrice (apprendre **pour** penser/la culture/le lien, pas **contre** la
  barrière) ; méthode par usage/Expéditions, pas par cœur ; l'IA-tuteur supprime les 2 freins (temps de
  parole, peur du jugement). Honnêteté : on **n'invoque pas** l'« avantage cognitif bilingue » (réfuté).
- **Apprendre à vie** : nouveau [`docs/04-PARCOURS-DE-VIE/07-apprendre-toute-la-vie.md`](docs/04-PARCOURS-DE-VIE/07-apprendre-toute-la-vie.md).
  Commencer à tout âge, ne jamais arrêter, **apprendre en travaillant** via **2 tempos combinés** : sprints
  intensifs (acquérir/relancer) + apprentissage espacé régulier (ancrer) + microlearning quotidien.
  « Élève à vie » = compte d'apprenant permanent (inspiré du CPF). Demi-vie des compétences ; effet
  d'espacement.
- **Carte infinie et vivante** : enrichissement de [`docs/03-ARCHITECTURE/01-atlas.md`](docs/03-ARCHITECTURE/01-atlas.md).
  L'Atlas n'affiche jamais « 100 % exploré » (savoir en explosion : double tous les ~9-17 ans — **pas** le
  mythe des « 12 h ») ; nœuds à **statut épistémique** + demi-vie (le savoir se révise, ex. Pluton) ;
  **frontière personnelle d'exploration** (ZPD) ; **apprendre à désapprendre** ; maintenu vivant par les
  Guildes (modèle Wikidata versionné).
- Bibliographie, READMEs (03, 04) alignés.

## [2.6] — 2026-06-08

### Réinventé — le Cursus comme PROGRAMME INVENTÉ pour l'école 2.0 (pas une copie d'un système national)
Réécriture complète de [`docs/03-ARCHITECTURE/07-cursus-et-specialisation.md`](docs/03-ARCHITECTURE/07-cursus-et-specialisation.md).
La V2.5 s'appuyait trop sur le PER suisse. **Correction** : le cursus est désormais une **invention
originale** — il s'inspire des écoles les plus en avance du monde mais les **dépasse**. Fondé sur 2
recherches (critique des programmes obsolètes + cadres d'avenir ; écoles innovantes).

**L'architecture inventée** : organiser l'apprentissage **non par matières** mais par **1 finalité + 3 fils
+ 1 moteur** :
- **Finalité** : l'**Épanouissement** (flourishing, Harvard/OCDE) — 3 piliers qui remplacent la note.
- **Fil 1 — Fondations** : littératies prérequises (dont littératie IA), validées par maîtrise.
- **Fil 2 — Aptitudes durables** : taxonomie nommée d'aptitudes transférables (6 familles), cœur du diplôme,
  rubrique cumulée (modèle Minerva/Summit/durable skills).
- **Fil 3 — Concepts-clés** : idées-seuils transdisciplinaires (système, preuve, causalité…) au lieu de
  faits (Wiggins & McTighe ; Meyer & Land).
- **Moteur — Expéditions** : unités-défis de 2-6 sem. autour des grandes questions (gabarit Étincelle →
  Question → Défi → Acte → Trace ; Challenge-Based Learning, NuVu, HTH, Sora).
- **Modules-éclair** : compétences périssables jetables, juste-à-temps, hors du diplôme.
- Progression par **maîtrise documentée** (Mastery Transcript), pédagogie active + mentor long.
Remplace *(matière × âge × cours × note)* par *(aptitude durable × maîtrise × expédition-défi × preuve)*.
Glossaire, parcours élève et bibliographie alignés.

## [2.5] — 2026-06-07

### Corrigé — CORRECTION DE FOND : l'élève ne choisit pas, le cursus est prescrit
Erreur antérieure : la doc laissait croire que l'élève **choisit** ce qu'il apprend (modèle auto-dirigé).
**Correction** : comme dans une vraie école (primaire → collège → lycée), il existe un **cursus complet,
standard et prescrit** que **tout le monde suit** ; l'élève ne choisit pas et n'a pas à savoir quoi
apprendre (sinon il serait prof). La **spécialisation** vient **plus tard** (choisie, comme une filière de
lycée / une majeure d'université). Fondé sur 2 recherches (structure des cursus : PER, socle, Common Core,
NGSS, Core Knowledge, IB, OCDE ; modèle tronc commun → spécialisation : lycée français 2019, major/minor,
T-shaped, Epstein *Range*, Hanushek-Woessmann sur le tri précoce, RIASEC).

- **Nouveau concept central** : [`docs/03-ARCHITECTURE/07-cursus-et-specialisation.md`](docs/03-ARCHITECTURE/07-cursus-et-specialisation.md)
  — l'Atlas = la *carte*, le **Cursus** = la *route prescrite* ; tronc commun (prescrit, complet, ~9
  domaines type PER + couches transversales) puis spécialisation (tardive, par maîtrise, accompagnée,
  réversible, modèle en T).
- **Parcours élève corrigé** : [`docs/10-APP-WEB/08-parcours-eleve.md`](docs/10-APP-WEB/08-parcours-eleve.md)
  — « je m'inscris, je fais quoi ? » : on est **placé** sur le tronc commun (diagnostic), pas de question
  « qu'est-ce que tu veux apprendre ? ».
- **Docs alignées** : Atlas (carte ≠ parcours), principe 2 (savoir prescrit / rythme personnel), glossaire
  (Cursus, Tronc commun, Spécialisation), page « démarrer avec une IA ».

## [2.4] — 2026-06-07

### Ajouté / refondu — un VRAI système communautaire (sous-dossier `10-APP-WEB/05-systeme-communautaire/`)
Le fichier `05` (trop centré sur « optionnel ») est remplacé par un **sous-dossier complet** qui conçoit un
système communautaire riche, fondé sur 2 recherches dédiées (plateformes réelles + implémentation
technique). 5 fichiers :
- `README` — vision : l'**Espace-Classe** (cohorte 20-30 : feed + cours + calendrier + annuaire + salles
  d'étude + Q&A) + **Guildes par matière** ; les 7 couches.
- `01-fonctionnalites` — toutes les fonctionnalités, couche par couche (espaces, feed, Q&A, étude ensemble,
  gamification, social, rythme live), inspirées de Skool, Discord/StudyLion, Duolingo, Stack Overflow,
  Circle/Mighty, Focusmate.
- `02-mecaniques-engagement` — **deux monnaies** (XP d'apprentissage *réel* vs points communauté/likes),
  niveaux Skool (9 paliers), ligues Duolingo (+25 % complétion), réputation Stack Overflow, study-together,
  + garde-fous anti-toxicité.
- `03-implementation-technique` — modèles SQL (forum/ltree, votes/réputation, RLS `SECURITY DEFINER`),
  ranking (HN gravité 1.8, Wilson z=1.96), feed (fan-out on read), Supabase Realtime (Broadcast/Presence),
  matching (filtrage+scoring, bitmask dispo), notifications, modération (pipeline 3 voies + OpenAI Moderation).
- `04-securite-cold-start` — sûreté mineurs (modèle Khan vs contre-ex. École 42, jardin clos, notification
  parentale) + démarrage à froid (1 → 2 → guilde, seeding sans faux comptes).

## [2.3] — 2026-06-07

### Ajouté — dossier `10-APP-WEB` (l'école comme application web)
Conception complète du **portail web** qui orchestre l'apprentissage autour d'une IA externe choisie par
l'élève, fondée sur **4 recherches** dédiées (architecture BYO-AI, cerveau pédagogique, produit/UX/stack,
système communautaire). 8 fichiers :
- `README` — l'idée clé : l'app est une **machine à états + générateur de prompts**, sa BDD EST la mémoire,
  l'IA est un exécuteur jetable et interchangeable. Moat = la donnée d'état, pas le prompt (leçon Jasper).
- `01-vision-produit` — modèle **BYO-AI** ; copier-coller (MVP, zéro coût) vs API (V2) ; boucle d'état fermée.
- `02-cerveau-pedagogique` — graphe de compétences (SQL), **BKT** (formules), séquencement (outer fringe),
  maîtrise, **évaluation** (QCM pour gater, IA/autoéval en formatif), **SM-2**, placement (CAT structurel).
- `03-prompts-et-continuite` — bibliothèque de 6 prompts contextualisés + **carnet de bord** (mémoire entre
  sessions sans état).
- `04-produit-ux` — parcours guidé (Duolingo/Khan), dashboard sans dark patterns, onboarding, **gamification
  saine vs toxique**.
- `05-systeme-communautaire` — communauté **émergente et optionnelle** (marche à n=1) : redevabilité
  (Matthews 43→76 %), mentorat (effet protégé), peer review (r≈0,62), **cold-start**, **sûreté mineurs**
  (contre-ex. École 42, modèle Khanmigo). Mythes écartés (ASTD 65/95, Focusmate +37 %).
- `06-stack-et-conformite` — Next.js + Supabase + Vercel ; PWA ; RGPD/mineurs (adultes d'abord).
- `07-roadmap-mvp` — MVP minimal, ce qu'on diffère, phases A→D, risques produit.

## [2.2] — 2026-06-07

### Précisé (modèle de fonctionnement)
- **L'unité de base est : 1 personne + 1 IA.** L'IA est le professeur particulier qui **diagnostique,
  prescrit le programme et donne les cours** — l'élève n'a pas à savoir d'avance quoi apprendre (comme à
  l'entrée au collège). La **communauté d'élèves est émergente et optionnelle** : le système doit
  fonctionner **sans elle**, et elle vient *amplifier* plus tard.
- Page [`docs/08-MISE-EN-OEUVRE/05-demarrer-aujourdhui.md`](docs/08-MISE-EN-OEUVRE/05-demarrer-aujourdhui.md)
  réécrite en ce sens, avec recherche intégrée : viabilité du solo (SDT — compétence 43 % + autonomie 34 %
  fournies par l'IA, appartenance 22 % = la communauté, le levier le plus faible) ; preuve réelle (Alpha
  School) et ses limites ; **2 conditions non négociables** — (1) l'IA *pilote* un programme structuré, ne
  l'*invente* pas (sinon hallucinations/trous), (2) l'IA enseigne en faisant penser (Bastani −17 % vs
  Kestin +1,3σ). Prompt-Maître intégré directement en markdown.

## [2.1] — 2026-06-07

### Ajouté
- **« Comment apprendre avec Dowze »** : page [`docs/08-MISE-EN-OEUVRE/05-demarrer-aujourdhui.md`](docs/08-MISE-EN-OEUVRE/05-demarrer-aujourdhui.md)
  et kit HTML [`kit-ecole-noos.html`](kit-ecole-noos.html). C'est **ainsi que Dowze fonctionne** pour
  l'apprenant : l'IA est l'école entière (programme, cours, prof, suivi), accessible à tous avec un
  abonnement IA, via une **Charte de l'Élève** + un **Prompt-Maître**. Résout la « page blanche » en
  proposant quoi apprendre.
- **Ancrage explicite** : chaque règle du prompt reliée à un des 12 principes et à un résultat de recherche
  (Bastani −17 %, Kestin +1,3σ, Kulik, Cepeda).
- Visualisations HTML : plannings de la semaine (`planning-semaine-noos.html`,
  `planning-matieres-noos.html`) et carte de domaine (`maths-domaine-noos.html`).

### Corrigé
- Suppression de la fausse notion de « mode solo / version amputée » : l'apprentissage piloté par l'IA
  **est** le fonctionnement de Dowze, pas une sous-version. Le binôme/communauté et le portfolio sont des
  **boosters optionnels**, pas des prérequis.

## [2.0] — 2026-06-06

Refonte complète en documentation hiérarchisée, multi-fichiers, **fondée sur la recherche**.

### Ajouté
- Arborescence `docs/` en 10 dossiers thématiques (00 à 09).
- Dossier **02-SCIENCE** : fondements scientifiques sourcés (sciences cognitives, théories
  pédagogiques, état de l'art de l'IA éducative, tableau des preuves).
- Dossier **05-TECHNIQUE** : spécifications (modèle de données de l'Atlas, conception du Mentor IA,
  Passeport vérifiable W3C, architecture offline-first, interopérabilité).
- Dossier **07-RISQUES-ETHIQUE** : registre des risques, délestage cognitif, sécurité des mineurs,
  équité/biais, objections & réponses.
- Dossier **09-ANNEXES** : bibliographie complète et sourcée, benchmark détaillé, personas, FAQ.

### Corrigé (par rapport à la V1)
- **Le « problème des 2 sigma » de Bloom est présenté comme un mythe largement infirmé**, pas comme
  un fait. L'effet réel du tutorat est d ≈ 0,37 (Nickow et al. 2020), non d = 2,0. Voir
  [`docs/01-DIAGNOSTIC/03-mythe-2-sigma-et-verite-tutorat.md`](docs/01-DIAGNOSTIC/03-mythe-2-sigma-et-verite-tutorat.md).
- L'efficacité de Khanmigo n'est **pas** prouvée par essai contrôlé : les chiffres connus sont des
  métriques d'adoption, pas d'apprentissage.
- Le risque central de l'IA (délestage cognitif) est désormais étayé par des preuves chiffrées
  (MIT 2025, Microsoft/CMU 2025, Bastani et al. PNAS 2025 : −17 % d'apprentissage durable sans
  garde-fous).
- Chiffres de la fracture numérique mis à jour sur ITU *Facts and Figures 2024* (2,6 milliards hors
  ligne, et non 2,2).

## [1.0] — 2026-06-06

Blueprint initial monolithique « Dowze — Le système d'éducation 2.0 ».
