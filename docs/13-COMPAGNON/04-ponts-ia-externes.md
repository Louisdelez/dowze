# 04 — Ponts IA externes : brancher son abonnement ChatGPT / Claude à Dowze (MCP)

> **Conception & recherche.** Objectif utilisateur : à l'Académie (École Dowze, via les compagnons),
> pouvoir avoir un **compagnon ChatGPT (OpenAI)** et un **compagnon Claude (Anthropic)** branchés sur son
> **abonnement chat NORMAL** (ChatGPT Plus/Pro, Claude Pro/Max) — pas une API payante. À l'aide d'un
> **plugin / connecteur MCP**, faire le lien Dowze ↔ ChatGPT/Claude : quand l'élève demande un cours et
> veut que ce soit ChatGPT/Claude qui l'enseigne, l'IA externe **donne le cours en communiquant avec Dowze**
> (elle lit le contexte pédagogique de Dowze, enseigne, et renvoie le bilan dans Dowze).

---

## 1. Le point CGU qui décide de TOUTE l'architecture

**Utiliser un abonnement grand public comme une API est INTERDIT** par les CGU d'OpenAI et d'Anthropic.
Les abonnements (ChatGPT Plus, Claude Pro) et les **API** (facturées au token) sont **deux produits distincts**,
et les éditeurs font respecter la distinction. Rétro-ingénierer la session web pour la ré-exposer en API
(ce que faisait **OpenClaw**) → **bannissement** (Anthropic a coupé ces accès en 2025 ; OpenAI et Google font
de même). Cf. [[dowze-compagnons-agents]] P6a : c'est exactement la raison pour laquelle le relais Dowze
est conçu **à l'envers**.

**Conséquence** : Dowze ne doit **jamais** « piloter » l'abonnement de l'utilisateur côté serveur. La seule
voie conforme est l'**inverse** — c'est le **client de l'utilisateur** (Claude.ai / Claude Desktop, ChatGPT)
qui **se connecte À Dowze**. Dowze est le **serveur MCP** ; l'abonnement chat est le **client MCP**. L'utilisateur
paie son abonnement normal, ajoute Dowze comme **connecteur**, et c'est ChatGPT/Claude qui, pendant SA
conversation, appelle les outils Dowze. **Zéro coût token pour Dowze, 100 % conforme.**

---

## 2. Mécanismes officiels réels (2025-2026)

Tous reposent sur **MCP** (Model Context Protocol) ou son cousin OpenAPI. Dowze expose **un** serveur MCP
distant (HTTPS public, OAuth 2.1) et chaque plateforme s'y connecte à sa façon :

| Plateforme | Mécanisme | Plans | Sens |
|---|---|---|---|
| **Claude** (claude.ai / Desktop) | **Connecteurs personnalisés (MCP distant)** — Réglages → Connectors → + → URL du serveur MCP | Free (1), **Pro, Max**, Team, Enterprise | Anthropic appelle le MCP Dowze **depuis son cloud** → le serveur doit être joignable sur l'internet public |
| **ChatGPT** | **Developer Mode → connecteurs MCP distants** (lecture **et écriture**), bêta depuis sept. 2025 — Réglages → Connectors → Advanced → Developer mode → Create | **Plus, Pro**, Team, Enterprise, Edu | ChatGPT appelle le MCP Dowze pendant le tour de l'utilisateur |
| **ChatGPT** (le plus simple) | **GPT personnalisé + Actions (OpenAPI 3.1)** — un « GPT » qui appelle une API Dowze | Plus/Pro (créer un GPT) | orienté texte, moins visuel |
| **ChatGPT** (le plus riche) | **Apps SDK** (sur MCP) — app Dowze **avec UI** dans ChatGPT, contexte persistant | Plus/Pro | widgets + conversation |

**Auth** : partout **OAuth 2.1 / OIDC** — ChatGPT/Claude agit comme *public client* au nom de l'utilisateur ;
le backend Dowze est la *ressource protégée*. (Le relais actuel utilise un simple jeton Bearer `dwz_…` ;
pour de vrais utilisateurs finaux, OAuth est requis par les connecteurs grand public — voir §6.)

**Contrainte UX clé** : dans ce sens, **c'est l'utilisateur qui initie** la conversation dans SON app
ChatGPT/Claude (connecteur Dowze activé). Dowze **ne peut pas forcer** l'app externe à parler ; il **expose**
le contexte et **reçoit** ce que l'IA externe produit. Le « cours par ChatGPT/Claude » se déroule donc
**dans** ChatGPT/Claude, synchronisé avec Dowze par les outils du connecteur.

---

## 3. Bonne nouvelle : Dowze fonctionne DÉJÀ sur ce principe

Le modèle de cours actuel de l'Académie **EST** « ton IA externe donne le cours » — mais en **copier-coller
manuel**, pas encore automatisé :

1. **`copilote.service.compose(profileId)`** (déterministe, gratuit, **aucun LLM interne**) assemble tout le
   **contexte pédagogique** : compétence prescrite (`progression.nextPrescribed`), description/domaine, %
   de maîtrise (BKT), dernière note de carnet, **misconceptions actives**, **révisions dues (FSRS)**, dossier
   élève (objectif + centres d'intérêt), RAG sémantique (notes & compétences liées), sources.
2. Il en fait un **prompt de cours** (`buildSessionPrompt`) que la page **`/seance`** affiche à copier
   « dans ton IA (ChatGPT, Claude…) ».
3. L'élève apprend dans son ChatGPT/Claude, puis **recolle son bilan** → **`ingest()`** appelle le LLM pour
   EXTRAIRE un `SessionSnapshot`, et **Dowze RECALCULE la maîtrise** (BKT `progression.observe`, carnet,
   FSRS, réconciliation des misconceptions). *Le LLM externe enseigne ; Dowze mesure et mémorise.*

Il existe même déjà le **squelette « IA externe fournit le contenu structuré »** :
- Module **`bridge`** (`apps/api/src/bridge/`, `packages/schemas/src/bridge.ts`) avec l'opération
  **`generer-cours`** + **`coursPayloadSchema`** (= `{ lesson: lessonSchema }`) et **`rapportPayloadSchema`**
  (`outcome: reussi|a-revoir`), validés strictement. Aujourd'hui en `.json` copier-coller, côté **auteur**.
- **`lessonSchema`** (`packages/schemas/src/content.ts`) : `{ skillId, title, objectives[], sections[]
  {heading, body}, workedExamples[] }` — le **schéma de cours structuré existe déjà**.

**Donc automatiser via MCP = remplacer le copier-coller par les outils du connecteur.** Rien à réinventer :
on branche `compose()` (aller) et `ingest()`/`lessonSchema` (retour) sur des outils MCP.

Et le **transport MCP existe déjà** : `POST /companion/mcp` (JSON-RPC : initialize/tools/list/tools/call/ping,
auth Bearer → `relayProfileFromToken`), file bidirectionnelle `relayPush`/`relayPull` avec curseur
`personality.lastInboxAt`, compagnon `mode='relay'` (`ensureRelayAgent`), table `companion_relay_tokens`
(`sha256(token)`). Cf. [[dowze-compagnons-agents]] P6a.

---

## 4. Architecture cible : le « pont Académie » (connecteur Dowze pour ChatGPT/Claude)

### 4.1 Vue d'ensemble
- **Un compagnon `mode='bridge'`** par IA externe branchée (« Mon prof ChatGPT », « Mon prof Claude ») —
  distinct du relais dev Claude Code. Réservé système (comme `relay`, jamais via `createAgentBody`).
- **Un connecteur MCP Dowze** (le même endpoint `/companion/mcp`, ou un `/academie/mcp` dédié) que
  l'utilisateur ajoute dans Claude/ChatGPT. Auth **OAuth 2.1** (utilisateurs finaux) — le jeton Bearter
  `dwz_…` reste pour l'usage dev/perso.
- **Outils MCP du flux de cours** (ajoutés à `mcpTools()` + `mcpCall()`) :

| Outil MCP | Sens | Source Dowze | Fait quoi |
|---|---|---|---|
| **`dowze_get_course_context`** | Dowze → IA externe | réutilise **`compose(profileId)`** | Donne le contexte pédagogique structuré (compétence visée, niveau/rang, %, misconceptions, révisions, dossier élève, sources) pour que l'IA prépare LE bon cours au bon niveau |
| **`dowze_deliver_lesson`** | IA externe → Dowze | validé par **`lessonSchema` / `coursPayloadSchema`** | L'IA externe renvoie le cours (`objectives`, `sections`, `workedExamples`) → stocké et affiché à l'élève dans `/seance` |
| **`dowze_report_session`** | IA externe → Dowze | mappe sur **`ingest`/`progression.observe`** + `rapportPayloadSchema` | À la fin du cours, l'IA renvoie le bilan (maîtrise/erreurs) → Dowze RECALCULE la maîtrise (BKT), carnet, FSRS |
| *(option)* **`dowze_list_todo`** | Dowze → IA externe | `progression.nextPrescribed` + FSRS due | « Quelles compétences travailler maintenant » (pour que l'IA propose le programme) |

### 4.2 Deux modes d'usage (au choix de l'élève)
- **A. Cours DANS ChatGPT/Claude** (l'IA externe est le prof, Dowze est le cerveau) : l'élève ouvre son
  ChatGPT/Claude (connecteur Dowze activé) et dit « fais-moi le cours du jour ». L'IA appelle
  `dowze_get_course_context`, enseigne à son niveau, puis appelle `dowze_report_session`. Dowze met à jour
  la progression. → *« quand on veut que ce soit ChatGPT/Claude qui donne le cours »* de la demande.
- **B. Cours livré DANS Dowze** (le compagnon `bridge` affiche le cours) : depuis Dowze, l'élève choisit
  « cours via mon Claude/ChatGPT » → Dowze met une **demande en file** ; la prochaine fois que l'IA externe
  interroge le connecteur (ou via `dowze_deliver_lesson`), le cours structuré (`lessonSchema`) remonte et
  s'affiche dans `/seance` (rendu `sections[].heading/body` + `objectives` + `workedExamples`) au lieu du
  prompt à copier. *(Rappel §2 : Dowze ne peut pas déclencher l'app externe ; ce mode dépend d'un tour
  côté ChatGPT/Claude — utile surtout avec l'Apps SDK/Custom GPT où le va-et-vient est fluide.)*

### 4.3 Stockage
Aucune table `lessons` n'existe (les cours sont **régénérables**, jamais figés). Ajouter une petite table
**`session_deliveries`** `(id, profileId, skillId, lesson jsonb, source 'chatgpt'|'claude', status, createdAt)`
+ curseur (réutiliser le patron `lastInboxAt`). Le bilan retour réutilise `companion_messages` ou passe
directement par `progression.observe`.

---

## 5. Choix de branchement par plateforme (recommandations)

- **Claude Pro/Max** → **connecteur MCP distant** = le chemin le plus direct et natif. L'utilisateur colle
  l'URL du connecteur Dowze, s'authentifie (OAuth), et Claude peut appeler les 3 outils de cours.
- **ChatGPT Plus/Pro** → **1) Developer Mode + MCP** (même serveur, lecture/écriture) pour les utilisateurs
  avancés ; **2) GPT personnalisé « Dowze Tuteur » + Actions (OpenAPI)** pour le grand public (le plus simple
  à distribuer : un lien vers le GPT) ; **3) Apps SDK** plus tard pour une vraie UI de cours dans ChatGPT.
- **Un seul serveur MCP Dowze** sert Claude ET ChatGPT (MCP est le standard commun) ; les Actions OpenAPI
  sont une façade REST optionnelle sur les mêmes endpoints.

---

## 6. Sécurité & garde-fous

- **OAuth 2.1 obligatoire pour les utilisateurs finaux** (les connecteurs grand public l'exigent) — le jeton
  `dwz_…` Bearer actuel reste pour l'usage perso/dev. Émettre des **scopes** (`course:read`, `course:write`,
  `progress:write`) ; le pont cours ne doit pas ouvrir toute l'API compagnon.
- **⚠️ Piège multi-profils** : `profileIdForAuth` prend le **1er profil** du compte. Pour un compte
  parent + plusieurs enfants, un jeton/connecteur unique viserait toujours le premier profil. → **jeton/OAuth
  par PROFIL-ÉLÈVE**, ou passer le `profileId` cible dans le contexte du jeton (cf. `compose()`/`ingest()`
  qui prennent déjà `profileId` en paramètre). Cf. [[dowze-storage-jwt-bug]] pour le contexte multi-profils.
- **Sécurité enfant** : l'IA externe (ChatGPT/Claude) échappe à la modération Dowze → cadrer par le
  systemPrompt injecté dans `dowze_get_course_context`, journaliser les livraisons, et réserver le pont aux
  profils majeurs / sous supervision parentale (cf. paliers de consentement `onboarding-rules`).
- **Intégrité pédagogique** : le bilan de retour (`dowze_report_session`) doit rester **déclaratif** et
  repasser par le recalcul BKT de Dowze (jamais l'IA externe qui « note » directement) — comme `ingest()`
  aujourd'hui. `rapportPayloadSchema` est déjà `.strict()` (anti-triche).
- **Anti-abus API** : ce pont n'est PAS un moyen de revendre l'abonnement (l'IA externe travaille pour SON
  propriétaire, sur SON parcours). Un compagnon `bridge` = 1 utilisateur = 1 abonnement.

---

## 7. BYOK vs abonnement : les deux coexistent

Dowze a déjà **deux façons** d'utiliser une IA ; ce pont ajoute la troisième :

| Voie | Qui paie quoi | Mécanisme Dowze |
|---|---|---|
| **Crédits plateforme** | Dowze paie l'API (clé plateforme), l'élève dépense des crédits | `resolveModelAndKey` → `platformKeyFor` |
| **BYOK (API)** | L'élève paie **l'API** OpenAI/Anthropic au token (clé chiffrée) | `copilote_settings.billing='byok'` + `decryptSecret` |
| **Abonnement chat (ce doc)** | L'élève utilise son **abonnement** ChatGPT/Claude ; son client appelle Dowze en MCP | `mode='bridge'` + connecteur MCP, **0 coût token Dowze** |

Le « cours par abonnement » est l'**analogue conforme** du « cours par BYOK » : même finalité (une IA puissante
enseigne au bon niveau), coût nul côté Dowze, aucune violation CGU.

---

## 8. Plan d'implémentation (phasé, NON implémenté)

- **P1 — Outils cours sur le relais existant** : ajouter `dowze_get_course_context` (= `compose`),
  `dowze_deliver_lesson` (= `lessonSchema`/`coursPayloadSchema`), `dowze_report_session` (= `progression.observe`)
  à `mcpTools()`/`mcpCall()`. Jeton Bearer (usage perso) d'abord. Table `session_deliveries`.
- **P2 — Compagnon `bridge`** : `ensureBridgeAgent` (« Mon prof ChatGPT »/« Claude »), UI dans « Ma famille »
  pour générer le connecteur, fil visible au téléphone.
- **P3 — OAuth 2.1** : serveur d'autorisation (client public ChatGPT/Claude, scopes cours), pour les
  utilisateurs finaux (connecteurs grand public).
- **P4 — Rendu élève « cours livré »** dans `/seance` (poll `session_deliveries` → rend `lesson`).
- **P5 — Façade ChatGPT** : GPT personnalisé + Actions (OpenAPI sur les 3 endpoints) pour distribution
  grand public ; plus tard **Apps SDK** (UI de cours dans ChatGPT).
- **P6 — École/Académie** : brancher le pont sur le **compagnon-prof** de l'open-space École (le prof de la
  matière « passe la main » à ChatGPT/Claude pour le cours, puis récupère le bilan) — intègre ce pont dans
  l'orchestration par rôle (cf. [[dowze-compagnons-agents]]).

---

## 9. Fichiers concernés (pour l'implémentation future)

- Transport MCP : `apps/api/src/companion/companion.controller.ts` (`mcp*` L.491-600), `companion.service.ts`
  (`relay*` L.1424-1502), `db/schema.ts` (`companion_relay_tokens` L.181-188, `mode` L.121).
- Cours : `apps/api/src/copilote/copilote.service.ts` (`compose` L.734, `ingest` L.819), `prompts.ts`,
  `apps/web/src/app/seance/page.tsx`.
- Schémas prêts : `packages/schemas/src/content.ts` (`lessonSchema`), `packages/schemas/src/bridge.ts`
  (`coursPayloadSchema`, `rapportPayloadSchema`, `generer-cours`), module `apps/api/src/bridge/`.
- BYOK/contraste : `apps/api/src/copilote/provider.ts`, `resolveModelAndKey`.

---

## Sources (recherche web, 2025-2026)

- Claude — connecteurs personnalisés (MCP distant), Free/Pro/Max :
  https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp
- ChatGPT — Developer Mode & connecteurs MCP (lecture/écriture), Plus/Pro :
  https://help.openai.com/en/articles/12584461-developer-mode-apps-and-full-mcp-connectors-in-chatgpt-beta
- ChatGPT — GPT Actions (OpenAPI) : https://developers.openai.com/api/docs/actions/introduction
- ChatGPT — Apps SDK vs Custom GPTs :
  https://skywork.ai/blog/apps-in-chatgpt-vs-custom-gpts-gpt-apps-2025-comparison/
- Abonnement ≠ API / ban des harnais tiers (OpenClaw) :
  https://venturebeat.com/technology/anthropic-cracks-down-on-unauthorized-claude-usage-by-third-party-harnesses
- Model Context Protocol (standard commun) : https://modelcontextprotocol.io/docs/develop/connect-remote-servers
