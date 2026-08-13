# 01 — Architecture des plugins Dowze

> Modèle retenu : **first-party extensions**. Les plugins sont des **apps satellites autonomes**
> (`*.dowze.ch`), isolées par **frontière réseau + schéma de données**, décrites par un **manifest
> déclaratif** (façon VS Code / Atlassian Forge), consommant une **API REST versionnée à scopes en moindre
> privilège** (façon Shopify / Slack), et contribuant aux features du cœur (dont le calendrier) **par API +
> événements, jamais en touchant sa base** (database-per-service). Sourcé (voir §9).

## 0. Pourquoi ce modèle (et pas un sandbox de plugin)

Les plugins sont développés **en interne** par Dowze. Le modèle de menace n'est donc pas « du code tiers
hostile » (qui justifierait un sandbox JS façon Figma, surdimensionné ici) mais « des équipes internes qui
doivent rester **découplées, versionnées et sûres** vis-à-vis des données sensibles ». D'où : isolation par
**app séparée + schéma de données**, pas par sandbox in-process ; contrats + scopes + versions pour éviter
que l'évolution du cœur ne casse un plugin.

## 1. Vue d'ensemble

```
                        ┌───────────────────────── *.dowze.ch (Traefik) ─────────────────────────┐
   academie.dowze.ch   fitness.dowze.ch   sports.dowze.ch   alimentations.dowze.ch   (apps front Next.js)
        │  cookie de session  Domain=.dowze.ch  (un seul Supabase)  │
        └──────────────┬───────────────────┬───────────────────────┘
                       ▼                    ▼
              api.dowze.ch  ── Gateway (JWT, scopes, rate-limit, /v1/) ──►  Cœur NestJS (modulaire)
                       │                                                     ├─ IA / RAG (Copilote)
                       │                                                     ├─ Planning / calendrier
                       │                                                     ├─ Profil / dossier
                       │                                                     ├─ Registre de plugins
                       ▼                                                     └─ Event bus (Realtime)
              supabase.dowze.ch (Kong)  ──►  Postgres : schéma public (cœur) + fitness / sports / alimentations
```

## 2. SSO — session partagée sur `.dowze.ch`

- **Un seul projet Supabase.** Toutes les apps s'y authentifient. La session est partagée par un **cookie
  posé sur le domaine parent `.dowze.ch`** (attribut `Domain=.dowze.ch` → envoyé à tous les sous-domaines),
  sérialisé via `@supabase/ssr` (`setAll` avec `Domain`, `HttpOnly`, `Secure`, `SameSite=Lax`).
- **JWT court (1 h)** + refresh token à usage unique. **Endpoint de logout global** qui révoque le refresh
  token GoTrue et purge le cookie parent (sinon l'access token reste valide ailleurs jusqu'à expiration).
- **Pièges cadrés** : (a) `Domain=.dowze.ch` expose la session à toutes les apps → **discipline XSS stricte**
  sur chaque app (une seule faille = compromission globale), cookie `HttpOnly` obligatoire, on renonce au
  préfixe `__Host-` (incompatible avec `Domain`) ; (b) les sous-domaines sont « same-site » → `SameSite` ne
  cloisonne pas entre apps : la **protection CSRF passe par un token applicatif**, pas par `SameSite`.
- **Pas d'OIDC interne** tant que toutes les apps sont Next.js + même Supabase (surdimensionné). Ne se
  justifierait que pour des apps tierces/non-Next.

## 3. Gateway & services partagés — `api.dowze.ch`

- **Une passerelle unique** devant le NestJS modulaire. Elle : valide le **JWT Supabase une fois** puis le
  **propage** aux services, applique le **rate-limiting** (global + par utilisateur + par plugin), et
  **versionne par préfixe d'URL `/v1/`** (contrat stable, dépréciation datée N/N-1).
- **Services communs derrière la gateway** : IA/RAG, planning, profil, registre de plugins. On reste sur un
  **monolithe NestJS modulaire** au départ ; extraction en micro-services seulement si un service scale
  différemment (inutile prématurément).
- **Auth service-to-service** (un plugin appelle l'IA/planning **sans** contexte utilisateur) = **OAuth 2.0
  Client Credentials**. Pour les appels **au nom de l'utilisateur**, on propage le JWT Supabase déjà validé.

## 4. Manifest de plugin (`dowze-plugin.yml`)

Chaque satellite publie au cœur un manifest déclaratif (inspiré VS Code `contributes`/`activationEvents` +
Forge `app`/`modules`/`permissions`) :

```yaml
app:
  id: fitness
  name: Dowze Fitness
  subdomain: fitness.dowze.ch
  minCoreVersion: "2.5"       # refus d'activation si cœur plus ancien
  apiVersion: "v1"            # version d'API du cœur consommée

scopes:                        # moindre privilège (Shopify), gouvernent DONNÉES ET ÉVÉNEMENTS (Slack)
  required: [profile:read, calendar:read, calendar:write]
  optional: [ai:infer, health:write]   # health = consentement explicite RGPD Art. 9

contributes:                   # points d'extension déclaratifs (catalogue fermé, versionné par le cœur)
  calendarEntryTypes:
    - { id: fitness.workout, label: "Séance", color: emerald }
  dashboardTiles:
    - { id: fitness.weeklyStats }
  navItems:
    - { id: fitness.home, label: "Fitness" }

subscribes:                    # bus d'événements (Slack : « c'est le cœur qui t'appelle »)
  - calendar.day.opened
  - user.goal.updated

configSchema:                  # config par plugin, validée par le cœur
  weeklyGoal: { type: number, default: 3, min: 1, max: 6 }
```

## 5. API & scopes

- **Contrat = API REST `/v1/` versionnée** (source de vérité, survit aux évolutions). Un **SDK TypeScript
  `packages/api-client` (`@dowze/sdk`)** généré depuis l'OpenAPI donne le confort DX **mais n'est pas le
  contrat**.
- **Scopes granulaires `ressource:action`** : `profile:read`, `calendar:read`, `calendar:write`,
  `ai:infer`, `health:write`, `xp:write`… Séparer **requis / optionnels**, **révocables** par l'utilisateur,
  **même modèle pour données ET événements** (avoir `calendar:read` autorise à s'abonner à
  `calendar.entry.created`).
- **Anti-casse** : (a) accès uniquement via l'API publique versionnée, **jamais** de lecture/écriture directe
  des tables du cœur ; (b) **tests de contrat** (OpenAPI/Pact) en CI du cœur ET des plugins ; (c) politique
  de dépréciation N/N-1 avec fenêtre datée.

## 6. Contribuer au planning — « source + projection »

C'est le point le plus structurant (l'ask central : le sport/les repas dans le calendrier). Trois patterns
combinés (contribution déclarative + API de contribution + bus d'événements), avec **ownership des données** :

- **Le plugin POSSÈDE sa séance** (dans **son** schéma `fitness`) — détails, exercices, données santé.
- **Le planning central ne détient qu'une PROJECTION/référence** : une entrée typée `calendar_entries`
  (`profile_id`, `source_app='fitness'`, `source_entry_id`, `entry_type='fitness.workout'`, `title`,
  `start`, `duration`, `scope`), **pas** les détails santé.
- **Écriture** : le plugin appelle `POST /v1/calendar/entries` (scope `calendar:write`) → le cœur applique
  ses **invariants** (conflits horaires, récupération, jours de repos — cf. contrat §02) puis émet
  `calendar.entry.created` sur le **bus d'événements** (Supabase Realtime + NestJS EventEmitter) pour
  rafraîchir les autres surfaces. **Aucune écriture directe** en base du cœur.
- **Désactivation / cohérence** : désactiver un plugin **masque puis nettoie** ses entrées via **saga** (pas
  de suppression en cascade brute — les transactions distribuées sont le point dur de database-per-service).

Le moteur de planning existant (`@dowze/core weeklySchedule`, déterministe) est étendu pour **fusionner** les
blocs d'étude et les **entrées récurrentes des plugins** selon les contraintes (voir
[02-contrat-planning-recurrent.md](02-contrat-planning-recurrent.md)).

## 7. Registre & activation

- **`plugin_registry`** (schéma public, cœur) : `id`, `name`, `subdomain`, `manifest_version`, `api_version`,
  `scopes_requested` (jsonb), `status` (published/deprecated), `min_core_version`.
- **`user_plugin_activation`** : `user_id × plugin_id × enabled × granted_scopes × config_json` →
  **activation ET config par utilisateur** (un élève active `fitness`, un autre non).
- **Publication** = gate CI (tests de contrat + scan) avant enregistrement (pas de marketplace public).
  À l'activation, le cœur **vérifie la compatibilité** (`min_core_version ≤ cœur`, `api_version` non
  dépréciée). Abonnement aux événements de cycle de vie (désactivation, révocation de scope).

## 8. Isolation des données & RGPD

- **1 schéma Postgres par satellite** (`fitness`, `sports`, `alimentations`), **RLS activée partout**
  (`auth.uid() = user_id`). Données **sensibles (santé)** dans un **schéma non exposé publiquement**,
  accessible uniquement via des fonctions `security definer` / l'API du plugin.
- **Accès inter-app uniquement via API** (jamais de jointure directe). Le planning central ne stocke que des
  **références** (titre générique + pointeur), minimisant la surface de données sensibles côté cœur.
- **RGPD — données de santé (Art. 9)** : traitement interdit par principe sauf **consentement explicite**.
  Concrètement : **consentement séparé** rattaché à l'activation du plugin fitness + scope `health:write`
  (distinct du consentement général Dowze, révocable → révocation = coupure du scope + purge/masquage) ;
  **chiffrement au repos** du schéma santé ; **journal d'accès** (auditabilité) ; **effacement/portabilité**
  délégués à l'app propriétaire (le cœur relaie via saga). Le cœur ne demande **jamais** `health:*` ; seul le
  satellite fitness le porte.

## 9. Monorepo & packages partagés

Rester en **monorepo Turborepo** (déjà en place). Structure cible :

- `apps/*` : `academie` (l'actuel `apps/web`), `fitness`, `sports`, `alimentations`, `api` (le cœur NestJS).
- `packages/schemas` — Zod partagés (déjà).
- `packages/core` — logique pure : BKT, SM-2, planning, **weeklySchedule** (déjà).
- `packages/ui` **(nouveau)** — design system + charte, **icônes Lucide only** ([[ui-icones-lucide]]),
  `AppLauncher` (barre commune + grille des apps + profil).
- `packages/auth` **(nouveau)** — client Supabase préconfiguré (cookie `.dowze.ch`, hooks session, logout global).
- `packages/api-client` **(nouveau)** — SDK typé vers `api.dowze.ch`, généré depuis l'OpenAPI.
- `packages/config` **(nouveau)** — ESLint/TS/Tailwind partagés.

## 10. Navigation inter-apps

Composant **`AppLauncher`** (dans `packages/ui`) présent identiquement dans chaque app : barre + menu grille
listant les apps activées, avatar/profil partagé, notifications. La transition entre sous-domaines est une
**simple navigation top-level** (préservée par `SameSite=Lax`), **sans ré-authentification** grâce au cookie
partagé. Chaque app garde son URL / branding / navigation propres.

## Sources (§9 des rapports de recherche)

VS Code (Extension Manifest), Figma (How plugins run), Atlassian Forge (Manifest reference), Shopify (Manage
access scopes), Slack (Events API), WordPress (Hooks), microservices.io (API Gateway, Database per Service),
Supabase (Sessions, SSR client, RLS), MDN (HTTP cookies), Auth0 (SSO), a16z (What is a Super App), WeChat
(Mini Program Framework), oauth.net (Client Credentials), monorepo.tools, turborepo.dev, RGPD Art. 9.
