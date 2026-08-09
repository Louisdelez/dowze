# Journal des versions — Dowze

Ce fichier trace l'évolution du document de conception **et de l'implémentation**.

## [Non versionné] — 2026-07-25 · apps/dev — instructions ComfyUI dans l'atelier (en plus des prompts)
Les instructions ComfyUI sont désormais **dans l'app** (`lib/assets.ts` + `catalog.tsx`), à côté des prompts ChatGPT :
- **Section « ComfyUI — pipeline pro »** dans la modale de chaque asset : recette de workflow **adaptée au type**
  (texture → tiling seamless ; prop/objet mural → LayerDiffuse transparent, iso ou face), **prompt négatif** dédié
  (bouton Copier) et **réglages** recommandés (sampler/steps/CFG/LoRA). `buildNegative`, `buildComfyRecipe`, `COMFY_SETTINGS`.
- Bouton **« Guide ComfyUI »** (en-tête) → modale avec le guide condensé complet (`COMFY_GUIDE` : 3 briques, installation,
  modèles, nodes, LoRA de style, workflows, batch API, réglages). Doc longue : `docs/13-COMPAGNON/02-comfyui-pipeline.md`.

## [Non versionné] — 2026-07-29 · ruche v3 : dedup sémantique en GC, versionnage prompts, maintenance nocturne
Trois finitions du cycle de vie de la ruche.
- **v3a — dedup SÉMANTIQUE dans la passe GC** : `maintainHive` combine les arêtes trigram ET des arêtes vectorielles
  (KNN pgvector par abeille, même open-space) → composantes connexes → fusion. Quasi-doublons (cosinus > 0.88 / distance
  < 0.12) fusionnés directement ; **zone grise** (0.75–0.88) tranchée par **arbitrage IA** (« ces deux rôles font-ils
  doublon ? », borné à 20/passe). Vérifié : « aide à la rédaction de mails pro » + « assistant pour écrire des courriels de
  travail » (trigram 0.12, distance 0.232) → **fusionnés** via arbitrage IA (le lexical seul les ratait totalement).
- **v3b — versionnage des prompts + rollback** : `retrainAgent` et `mergeAgents` archivent l'ancien system prompt dans
  `personality.promptHistory` (5 max) ; `POST /companion/agents/:id/revert-prompt` restaure la version précédente
  (non-régression manuelle). DTO expose `promptVersions` ; bouton **↩ annuler** dans « Ma famille » quand une version existe.
  Vérifié : retrain → promptVersions 1 → revert → 0.
- **v3c — maintenance NOCTURNE** : `JobsService` programme un job répétable BullMQ (`hive-maintain`, ~3h23) ; un
  consommateur `HiveScheduler` (dans le process API, qui a `CompanionService` en DI → pas de contexte Nest à booter dans le
  worker) lance `nightlyMaintenanceAll` = passe SÛRE par profil (embeddings + prune, **PAS de fusion IA** la nuit pour le
  coût/surprise). Vérifié : job répétable enregistré dans Redis (`bull:hive-maintain:repeat:…`), API démarrée sans erreur.
- Refactor : `maintainHiveCore(profileId, doMerge)` partagé entre le bouton manuel (doMerge=true) et la nuit (false).

## [Non versionné] — 2026-07-29 · ruche v2 : recherche & dédoublonnage SÉMANTIQUES (pgvector)
La reine retrouve les abeilles par le SENS, pas seulement par mots-clés (« fractions » → abeille « mathématiques »).
Réutilise l'infra d'embeddings existante (« Mon Copilote » : `resolveEmbeddingConfig` + `embedTexts`), modèle **Jina v3
(1024 dims)** — la clé d'embedding chiffrée est portable (COPILOTE_SECRET_KEY global), copiée sur le profil des compagnons.
- **pgvector** (migration `0061`) : `create extension vector` ; `companion_agents.embedding_vec vector(1024)` + **index HNSW**
  (`vector_cosine_ops`) → KNN rapide même avec des millions d'abeilles (contrairement au RAG existant en `real[]` + cosinus JS).
- **`CopiloteService.embed(profileId, texts)`** : méthode publique (réutilise la config du profil ; `null` si non configuré).
- **Embedding à la création** (`embedAgent`) + **backfill** dans `maintainHive` (128/passe, renvoie `embedded`).
- **Recherche sémantique** (`orchestrate`) : KNN `embedding_vec <=> query` en TÊTE de la short-list, complété par le
  lexical (trigram) + récent → dégradation gracieuse si pas d'embeddings.
- **Dedup-à-la-création sémantique** (`findSimilarAgent`) : plus proche voisin vectoriel (cosinus > 0.82) → réutilise ;
  repli trigram.
- **Vérifié en prod** : backfill embarque les abeilles (clé Jina OK) ; test rigoureux — abeille « mathématiques » **enfouie
  sous 60 abeilles bidon** (hors des 40 récentes) + requête « fractions » (0 mot-clé commun) → **mobilise l'abeille maths**
  (seul le KNN pgvector pouvait la retrouver), 0 doublon. Test nettoyé.
- Reste (v3) : dedup sémantique aussi dans la passe GC (aujourd'hui trigram) ; retrain versionné/non-régression ; GC planifiée.

## [Non versionné] — 2026-07-29 · jardinage de la ruche : cycle de vie & efficacité des abeilles (P5g)
La ruche s'auto-entretient : mesure de l'efficacité, dédoublonnage, fusion, ré-entraînement, prune. (Recherche état de
l'art : Reflexion, ExpeL, Generative Agents, MemGPT/Mem0, MAST ; principe retenu = prévenir la prolifération à la
création coûte moins cher que nettoyer après ; SQL simple pg_trgm d'abord, pgvector plus tard.)
- **Schéma** (migration `0060`) : `companion_agents` + `use_count, last_used_at, quality_ema, rating_count, protected,
  status ('active'|'retired'|'merged'), merged_into` ; table `companion_agent_merges` (journal). `listAgents` et le roster
  d'orchestration filtrent `status='active'`.
- **Efficacité** : `chatAgent` incrémente `use_count`/`last_used_at` (toute mobilisation ou chat direct). La synthèse de la
  reine note l'utilité de chaque abeille (LLM-as-judge, 0..1) → `quality_ema` (EMA α=0.3) + `rating_count`. Exposés au front.
- **Dedup-à-la-création** : avant de créer une abeille, `findSimilarAgent` (trigram ≥ 0.6 sur rôle/nom) → **réutilise**
  au lieu de créer.
- **Fusion** (`mergeAgents`) : survivant = argmax(qualité×log(usage)) ; system prompt **unifié par IA** ; union dédupliquée
  des règles ; migration de la mémoire (`companion_messages` réaffectés) ; stats combinées ; absorbée `status='merged'`
  (+ journal). **Ré-entraînement** (`retrainAgent`) : consolide règles + réécrit le system prompt depuis l'historique.
  **Prune** : `retireAgent` (soft, réversible) ; **protect** (épinglage) exempte de fusion/prune.
- **Maintenance** (`maintainHive` = `POST /companion/hive/maintain`) : dedup (self-join trigram + composantes connexes,
  MÊME open-space) → fusion des clusters → prune (obsolète > 45 j / jamais utilisée + grâce 7 j, ou qualité < 0.30 avec ≥3
  notes ; jamais Maison/épinglée). Endpoints `hive/merge`, `agents/:id/retrain|retire|protect`.
- **Front** (« Ma famille ») : par abeille → usage + efficacité %, boutons **épingler ★ / ré-entraîner / retirer** ;
  carte **« Nettoyer la ruche »** (dans un open-space) avec rapport (fusionnées / retirées / actives).
- **Vérifié en prod** : 3 quasi-doublons (Ortho/Grammy/Relec) → fusionnés dans Ortho (survivante, prompt unifié IA,
  use_count 13, mémoire migrée, journal) ; « Fantome » (60 j, jamais utilisée) → retirée ; dedup-à-la-création réutilise
  Ortho (0 doublon) ; retrain → 12 règles consolidées. Test nettoyé.
- Prochaine étape (v2) : consolidation façon ExpeL avec versionnage/non-régression, pgvector (dedup/retrieval sémantique),
  passe GC planifiée (cron) + tombstones anti delete↔recreate.

## [Non versionné] — 2026-07-29 · ruche INFINIE : aucune limite d'abeilles/spécialisations (P5f)
Plus aucune limite dure sur le nombre d'abeilles (compagnons) ni d'open-spaces (spécialisations) — la ruche peut grandir
sans plafond (millions). Deux volets :
- **Limites retirées** : `MAX_AGENTS` (300) et `MAX_SPACES` (20) supprimés de `createAgent`, `createAgentFromDescription`,
  `createSpace`, `ensureSpaceByName`. Skin par défaut des abeilles auto = aléatoire (plus de compteur).
- **Orchestration scalable** : la reine ne charge plus TOUTES les abeilles dans le prompt (ça explosait à grande échelle).
  Elle récupère une **short-list pertinente** (≤ 40) par recherche mots-clés (`ILIKE` sur nom/rôle) + complétée par les
  plus récentes, puis planifie/délègue/crée dessus. Liste des open-spaces du prompt bornée (50 plus récents).
- **Index (migration `0059`)** : `pg_trgm` + GIN trigram sur `companion_agents(name, role)` (ILIKE rapide à grande
  échelle) + btree `(profile_id, mode, space)` et `(profile_id, updated_at desc)`.
- **Vérifié en prod** : hive de **1202 abeilles** → demande « répare mon vélo » → retrouve et mobilise « Roue » (l'abeille
  vélo) sans lister les 1202, 0 doublon, ~5 s (latence des 3 appels IA, INDÉPENDANTE du nombre d'abeilles). Test nettoyé.
- Prochaine étape pour la précision à très grande échelle : retrieval **sémantique** (pgvector/embeddings) — le match
  actuel est lexical (mots-clés).

## [Non versionné] — 2026-07-29 · Maison = LEADERS : chaque compagnon peut mener la ruche (P5e)
Les compagnons de la Maison ont un **statut supérieur** : comme le principal, CHACUN peut interagir avec les abeilles
(open-spaces) — répondre lui-même dans sa spécialité OU mobiliser/créer les bonnes abeilles pour le reste.
- **API** : `orchestrate(authId, message, leaderId?)` — `leaderId` = un compagnon de la MAISON (validé `space='home'`),
  défaut = principal. Le plan + la synthèse parlent DANS LA VOIX du leader (son `systemPrompt` s'il en a un). Réponse
  directe d'un leader-agent = via `chatAgent` (persona + mémoire) ; l'échange délégué est aussi persisté dans la mémoire
  du leader (conversation individuelle cohérente). Body `orchestrateBody.leaderId` (uuid opt). Clients `orchestrateCompanion(message, leaderId?)` (web) + `CompanionApi.orchestrate(message, leaderId?)`.
- **Front** (téléphone + `<CompanionDock>`) : tout compagnon `space='home'` (non-relais) → `orchestrate(leaderId)` (le
  principal sans leaderId). Les abeilles d'open-space (`mode='agent'`, hors home) restent en chat individuel direct.
  Historique persistant élargi aux leaders de la Maison (sauf le principal, sans mémoire).
- **Vérifié en prod** (`56cae052`, leader = Mathéo) : demande code hors domaine → Mathéo **mobilise Mémo** et synthétise
  dans sa voix ; demande maths → Mathéo répond **lui-même** (0 délégation), avec sa mémoire (« Chef », bonbons).
- NB : ceci rend TOUT compagnon de la Maison capable d'IA (même un PNJ « simple » via le chemin leader). Réversible si on
  veut réserver le leadership aux compagnons-agents + principal.

## [Non versionné] — 2026-07-29 · Maison À PART : ses compagnons hors de la ruche (P5d)
Séparation stricte : la **Maison** est gérée à part. Ses compagnons = **uniquement ceux créés par l'utilisateur**, à qui
il parle **un par un** ; ils ne **passent JAMAIS par le principal / l'orchestration**. La **ruche** (le principal qui
mobilise et crée des abeilles) opère **uniquement sur les open-spaces**.
- **API** : `orchestrate` sélectionne les spécialistes avec `ne(space,'home')` — les compagnons de la Maison (même
  `mode='agent'`, ex. Mathéo) sont exclus du roster de la reine. Ils restent joignables **individuellement** (chatAgent /
  téléphone / dock / bulle de salle), inchangé. Les abeilles auto vont déjà dans les open-spaces (P5c).
- **Vérifié en prod** (`56cae052`) : question maths au principal → **ne mobilise pas Mathéo** (Maison) ; Mathéo reste
  joignable en direct (répond avec sa mémoire). Ruche = seulement les abeilles d'open-space (« Mémo » dans « Code & Dev »).

## [Non versionné] — 2026-07-29 · ruche : abeilles auto rangées en OPEN-SPACES (jamais la Maison) (P5c)
Règle : les abeilles créées **par le système** (ruche) ne vont **JAMAIS dans la Maison** (réservée aux compagnons
choisis par l'utilisateur + principal + Tamagotchi + relais). Le système **auto-gère les open-spaces** et range chaque
abeille dans le **bon open-space selon sa compétence** (code → « Code & Dev », cours → « Cours & École », etc.).
- **API** : `ORCH_PLAN_SCHEMA` gagne `spaceName` par nouvelle abeille (open-space métier). `orchestrate` liste les
  open-spaces existants dans le prompt (réutilisation), puis pour chaque abeille créée appelle `ensureSpaceByName`
  (trouve-ou-crée l'open-space, jamais la Maison, plafonné à `MAX_SPACES` → repli sur un open-space existant) et crée
  l'abeille dans CET espace (plus jamais `space='home'`). `buildAgent` (création MANUELLE par l'utilisateur) inchangé.
- **Vérifié en prod** (`56cae052`) : « revois ma fonction JS avec fuite mémoire » → crée l'abeille « Mémo » dans un
  open-space **« Code & Dev » auto-créé** ; la Maison ne contient AUCUNE abeille auto (seulement Biscotte/Pixel/Mathéo/relais).

## [Non versionné] — 2026-07-29 · ruche : trouver-OU-CRÉER la bonne abeille (P5b)
La ruche ne se limite plus aux abeilles existantes : pour chaque demande, la reine décompose en sous-tâches précises,
**trouve la bonne abeille OU la crée** (spécialiste très ciblé) si aucune ne convient. La ruche grandit et gagne en précision.
- **API** (`orchestrate`) : `ORCH_PLAN_SCHEMA` enrichi — chaque délégation = abeille `existing` (numéro) **ou** `create`
  (description étroite d'une abeille à fabriquer). Le plan réutilise une abeille existante si elle correspond vraiment,
  sinon en crée une neuve. Fabrication factorisée dans `createAgentFromDescription` (partagée avec l'auto-builder),
  skin par défaut varié en URL absolue (`DEFAULT_BEE_SKINS`) → abeilles visibles partout. Renvoie désormais `created: string[]`.
- **Front** : le téléphone (et le `<CompanionDock>` partagé) affichent « a créé : X » en plus de « a mobilisé : X ».
  Types `OrchestrateResult.created` (web `api.ts` + `@dowze/api-client`).
- **Vérifié en prod** (profil `56cae052`) : « corrige mon email anglais » → **crée** l'abeille « Liam (correction d'emails pro
  en anglais) » et la mobilise ; 2ᵉ demande grammaire → **réutilise Liam** (pas de doublon) ; question maths simple →
  réponse directe. Ruche : 1 → 2 abeilles puis stable. Garde-fous : max 3 délégations/req, plafond `MAX_AGENTS`, abeille HS non bloquante.

## [Non versionné] — 2026-07-29 · compagnon COMMUN — socle partagé (packages, sans branchement)
Le compagnon est la **partie centrale et commune de Dowze**, présent dans TOUTES les apps de l'écosystème
(academie, fitness, sports, alimentations…), pas seulement l'éducation. Socle partagé posé (aucune app branchée) :
- **`@dowze/api-client`** : `CompanionApi` (construit depuis un `DowzeClient`) + types partagés (`CompanionAgent`,
  `AgentPersonality`, `CompanionMessage`, `CompanionSpace`, `OrchestrateResult`). Méthodes : `listAgents`, `buildAgent`,
  `deleteAgent`, `chat`, `messages`, `orchestrate`, `spaces`, `createRelayToken`, `relaySay`. Endpoints réels `/companion/*`.
  Le « cerveau » (agents, mémoire, ruche, relais MCP) était déjà rattaché au **profil** → déjà commun à toutes les apps.
- **`@dowze/ui`** : `<CompanionDock client={dowzeClient} />` — le **compagnon flottant** (bouton bas-coin) qui ouvre la
  **messagerie de la ruche** : compagnon principal (orchestrateur), compagnons-agents (IA + mémoire), relais Claude Code /
  Codex (avec sondage 5 s). Autonome : `CodexPet` porté et rendu self-contained (constantes inlinées, keyframes injectés
  une fois, URLs de planche résolues en absolu sur l'académie → marche sur n'importe quel sous-domaine `.dowze.ch`).
  Exporté avec `curatedSheetUrl`. Dépend de `@dowze/api-client`.
- **Pas branché, pas déployé** (choix : socle seul). Les apps monteront `<CompanionDock>` dans leur `shell.tsx` plus tard.
  Typecheck `@dowze/api-client` + `@dowze/ui` OK. Note : `dev.dowze.ch` est un **outil de dev** (atelier de prompts),
  hors périmètre — il ne reçoit PAS le compagnon.

## [Non versionné] — 2026-07-29 · ruche UNIVERSELLE (dé-scolarisation des prompts)
La « ruche » (orchestration + agents) n'est plus liée à l'éducation : elle traite **n'importe quelle demande, dans
n'importe quel domaine** (travail, code, business, vie quotidienne, admin, créativité, sport, santé…).
- **API** (`companion.service.ts`) : tous les prompts « élève »/scolaire remplacés par « l'utilisateur » et une consigne
  explicite « n'importe quel domaine » — `orchestrate` (ASSISTANT + plan + synthèse), `chatAgent` (system + historique
  « Utilisateur : »), `BUILD_AGENT_SYSTEM` (compagnon polyvalent, plus « pour un élève / enfants et ados »), schéma `direct`.
- **Front** : l'exemple de l'auto-builder ne pousse plus vers « coach de maths » → exemples multi-domaines (organiser des
  projets, relire du code, coach sportif). Les répliques PNJ du téléphone et le mascot de la Maison restent inchangés.
- **Vérifié en prod** (jeton HS256 court forgé côté serveur, profil `56cae052`) : routage par domaine correct —
  déménagement/budget → un agent « logistique », bug Python → un agent « dev », recette de cuisine → réponse directe.
  Agents de démo créés pour le test puis supprimés.

## [Non versionné] — 2026-07-28 · compagnon : relais Claude Code / Codex via serveur MCP (P6a)
Dowze expose un **serveur MCP** : TON Claude Code / Codex (ton abonnement, ta machine — 100 % CGU) s'y connecte et
**communique avec les compagnons**. Il pousse son avancement dans le téléphone et lit tes instructions.
- **DB** : table `companion_relay_tokens` (migration `0058`, appliquée en prod) — jetons Bearer (sha256, le token en clair
  n'est montré qu'une fois). Un compagnon `mode='relay'` (« Claude Code ») porte le fil de conversation (apparaît au téléphone).
- **API** — `POST /companion/mcp` : serveur **MCP JSON-RPC 2.0** (transport HTTP), auth **Bearer**. Méthodes `initialize`,
  `tools/list`, `tools/call`, `ping`, notifications ignorées. **Outils** exposés à Claude Code : `dowze_send_update(text)`
  (→ message dans le téléphone) et `dowze_get_messages()` (← instructions de l'utilisateur, curseur `lastInboxAt`, +1 ms
  pour la précision µs de `timestamptz`). Jeton invalide → 401. `POST /companion/relay/token` (session) génère le jeton ;
  `POST /companion/relay/say` (téléphone → file d'attente). Débit limité.
- **Front** — carte **« Relais Claude Code / Codex »** dans « Ma famille » (Maison) : génère le jeton + affiche la commande
  `claude mcp add --transport http dowze https://api.dowze.ch/companion/mcp --header "Authorization: Bearer …"` (copiable).
  Le **téléphone** : le fil `mode='relay'` envoie via `relaySayCompanion` (pas d'IA) et **sonde toutes les 5 s** pour afficher
  en direct les messages de Claude Code. Le relais **n'apparaît pas** comme sprite dans la salle (téléphone uniquement).
- **Vérifié en prod** (jeton de test, profil `56cae052`) : initialize/tools/list/tools/call OK ; `dowze_send_update` persiste ;
  round-trip `dowze_get_messages` (renvoie l'instruction puis vide après avancée du curseur) ; mauvais jeton → 401. Nettoyé.

## [Non versionné] — 2026-07-28 · compagnon : chat-bulle de la salle branché à l'IA (P4c)
La **communication directe** (bulle au-dessus de la tête + barre de chat) parle enfin à la **vraie IA**, comme le téléphone.
- **Front** (`companion-room.tsx`) : `sendChat` route les compagnons `mode==='agent'` vers `chatCompanionAgent`
  (réponse du modèle + mémoire de conversation persistée) ; bulle **« … »** pendant la réflexion, puis la réponse.
  Le compagnon **principal** et les compagnons **PNJ** gardent leur réplique scriptée instantanée (`replyLine`). `/nom`
  cible toujours un compagnon précis. Helper `saySec(id, text, holdMs)` extrait de `talkSec` (bulle secondaire réutilisable).
- Choix délibéré : la bulle du principal reste **légère** (PNJ) ; l'**orchestration** (reine → abeilles) reste dans le
  téléphone, où le format long/asynchrone convient. Typecheck OK ; `dowze/web` rebuild + recreate ; academie.dowze.ch → 200.

## [Non versionné] — 2026-07-28 · compagnon : orchestration « ruche » (P5a)
Le compagnon PRINCIPAL devient l'**orchestrateur** : il décompose une demande, **délègue** aux spécialistes (agents) et
**synthétise** — le cœur « reine → abeilles ».
- **API** : `POST /companion/orchestrate` ({message}) → `orchestrate()` : (1) liste les compagnons `mode='agent'` du profil
  (les spécialistes) ; (2) un **plan** LLM (`ORCH_PLAN_SCHEMA`) choisit 0–3 spécialistes par NUMÉRO + une sous-tâche, ou
  répond en direct ; (3) chaque délégué répond via `chatAgent` (réutilise sa mémoire/persona) ; (4) **synthèse** LLM en
  1–3 phrases. Renvoie `{reply, delegates:[{name,role,said}]}`. Garde-fous : max 3 délégués, un spécialiste HS ne bloque
  pas. Client `orchestrateCompanion`.
- **Front (téléphone Messages)** : parler au compagnon **principal** (`isPrimary`) route vers l'orchestrateur ; la réponse
  synthétisée s'affiche + une **caption « a mobilisé : … »** (message `meta`) rendant l'orchestration **visible**.
- Vérifié en prod : « aide-moi à réviser les fractions » → délégué à **Mathéo** (qui répond avec ses règles apprises :
  « Chef », exemple chocolat/bonbons) → synthèse « Mathéo a donné un exemple concret… », caption « a mobilisé : Mathéo ».

## [Non versionné] — 2026-07-28 · compagnon : mémoire & apprentissage (P4b)
Les compagnons-agents **se souviennent** et **apprennent** (« élever son compagnon »).
- **DB** : table `companion_messages` (migration `0057`) = mémoire de conversation persistée (profil, agent, sender, texte).
- **Mémoire** : `chatAgent` charge les 12 derniers messages depuis la DB (historique injecté dans le prompt) et **persiste**
  chaque échange. Nouvel endpoint `GET /companion/agents/:id/messages` ; le téléphone Messages **charge l'historique
  persistant** à l'ouverture d'une conversation IA (`getCompanionAgentMessages`). Chat sans `history` client.
- **Apprentissage naturel** : si le message ENSEIGNE quelque chose (regex `TEACH_RE` : « retiens que / dorénavant /
  je préfère que / n'oublie pas que … »), la phrase est retenue comme **règle durable** dans `personality.rules`
  (max 20) et **injectée** dans le system prompt de toutes les réponses suivantes. `chatAgent` renvoie `{reply, learned}`.
  `rules` exposé au client (mais pas le systemPrompt).
- Vérifié en prod (Mathéo) : « dorénavant tutoie-moi et appelle-moi Chef » → réponse « D'accord Chef ! » **appliquant la
  règle + l'ancienne (bonbons)** ; règles stockées ; historique persistant.

## [Non versionné] — 2026-07-28 · compagnon : premier compagnon-AGENT IA (P4a — auto-builder + chat IA)
Passage du PNJ à l'IA, posé sur la pile existante (`CopiloteService` + Vercel AI SDK, multi-fournisseurs, crédits/BYOK).
- **API** : `CopiloteModule` importé dans `CompanionModule`, `CopiloteService` injecté. `POST /companion/agents/build`
  ({description}) → `generateStructured` produit une **config d'agent** (nom, accueil, ton, traits, spécialité,
  **systemPrompt**) puis crée l'agent (`mode='agent'`). `POST /companion/agents/:id/chat` ({message, history}) → réponse
  **courte et humaine** pilotée par le systemPrompt (règles anti-markdown/anti-pavé). Le `systemPrompt` n'est **pas**
  renvoyé au client. Client : `buildCompanionAgent`, `chatCompanionAgent`.
- **Front** : « Ma famille » gagne un onglet **Simple / IA** — en IA, on décrit le compagnon en une phrase → Dowze
  construit tout. Le **smartphone/tablette Messages** route les compagnons `mode='agent'` vers le **chat IA** (message
  d'accueil = leur greeting généré) ; les PNJ gardent `deviceReply`.
- **Nécessite une clé IA** (BYOK par profil, ou clé plateforme) ; sans clé → 503 géré proprement côté UI.
- **ACTIVÉ + TESTÉ EN PROD (BYOK DeepSeek)** : auto-builder « un coach de maths patient… » → agent **« Mathéo »** construit
  (nom/traits/spécialité/greeting), et chat IA « 1/2 + 1/3 ? » → réponse DeepSeek juste, courte, dans le personnage
  (analogie pizza : « 3/6 + 2/6 = 5/6 »). Fonctionne dans le smartphone Messages (route `mode='agent'` → IA).

## [Non versionné] — 2026-07-28 · compagnon : smartphone & tablette (P3a — Messages + Email)
Deux appareils répliqués pour communiquer avec **tous** les compagnons (tous espaces confondus). Nouveau composant
`companion-phone.tsx` (`CompanionDevice`).
- **2 boutons** (smartphone/tablette) en bas-gauche (près de l'inventaire), toujours visibles. `device` state.
- **Cadre « OS »** : barre de statut (heure/signal/batterie), écran d'accueil (grille d'apps Messages + Email), bouton
  fermer. **Téléphone** = vertical 1 volet (liste → fil, retour) ; **tablette** = paysage 2 volets (liste + fil).
- **Messages** (style iMessage/WhatsApp) : une conversation par compagnon (agrégés via `getCompanionSpaces` +
  `getCompanionAgents` de chaque espace), avatar `CodexPet`, message d'accueil semé, envoi → **réponse PNJ contextuelle**
  (`deviceReply` : mots-clés + traits, un peu plus longue que la bulle). Stockage en mémoire de session.
- **Email** : boîte de réception avec un email d'intro (format long, un seul bloc, humain) par compagnon + volet lecture.
- Vérifié en prod : smartphone Messages (envoi/réponse), tablette 2 volets listant Biscotte + Pixel + Atlas (open-space).

## [Non versionné] — 2026-07-28 · compagnon : espaces de travail (P2b — Home + open-spaces)
Plusieurs **espaces** : la **Maison** (`'home'`, famille + Tamagotchi) + des **open-spaces** nommables (agents « de
travail », sans Tamagotchi).
- **DB** : table `companion_spaces` (migration `0056`, appliquée en prod) ; `companion_agents.space` = `'home'` | id
  d'open-space. Endpoints `GET/POST/PATCH/DELETE /companion/spaces` (suppression = cascade des agents de l'espace,
  plafond 20). Client `getCompanionSpaces/createCompanionSpace/renameCompanionSpace/deleteCompanionSpace`.
- **Front** : **menu déroulant d'espaces** en haut-centre (à gauche de la barre des pièces) — Maison + open-spaces +
  « Nouvel open-space » + suppression. `activeSpace`/`isHome`. Bascule : chargement des compagnons de l'espace
  (`getCompanionAgents(activeSpace)`), décor `OPENSPACE_PRESET` (grand sol sans murs) ; en open-space on **masque** la
  barre des pièces, les soins, le gold, les jauges, l'inventaire, la boutique et le pet principal — **seul le chat**
  reste. Le gestionnaire « Ma famille » devient contextuel (titre = nom de l'espace ; création dans l'espace actif).
- Vérifié en prod : création « Open space 1 », agent « Atlas » qui y vit, UI Maison masquée, et retour Maison sans régression.

## [Non versionné] — 2026-07-28 · compagnon : chat direct (P2a — barre de chat)
Barre de **chat direct** au-dessus du panneau de soins : on parle à ses compagnons, ils répondent par une bulle (PNJ, 0 IA).
- **Ciblage** : sans préfixe → tous les compagnons de la pièce répondent (en cascade) ; **`/nom …`** → seul ce compagnon
  répond (match `startsWith` sur le nom, principal inclus). `sendChat` (parse `/nom`, construit la liste des speakers).
- **Réponses** `replyLine(personality, name, msg)` : mots-clés simples (bonjour/ça va/merci/bravo/dodo/jouer/manger/?) +
  repli `personaLine` teinté par les traits. Le principal répond via `say()`, les secondaires via leur bulle.
- UI : input pill + bouton `send` (Enter pour envoyer), `max-w-3xl`, au-dessus des actions de soin.
- Vérifié en prod : « coucou vous allez bien ? » → 2 réponses ; « /Pixel bravo » → seul Pixel répond.

## [Non versionné] — 2026-07-28 · compagnon : famille de compagnons visible (P1b — front)
Plusieurs compagnons vivent maintenant dans la **Maison**, en plus du principal.
- **Rendu multi-compagnons** : les compagnons secondaires (non-principaux) sont des sprites `CodexPet` additionnels qui
  **déambulent** (boucle rAF dédiée, `secPhysRef`/`secs`), avec **nametag** et **bulle PNJ** (au-dessus de la teinte
  jour/nuit). Ajoutés au tri de profondeur avec le principal. Le principal garde toute sa machinerie (soins/autonomie).
- **Répliques PNJ** (`personaLine`) teintées par la personnalité (`traits`/`tone`), zéro IA ; clic sur un compagnon =
  réplique. Timer aléatoire pour les répliques spontanées.
- **Gestion « Ma famille »** (bouton `users` près de l'engrenage) : liste (avec aperçu `CodexPet` + badge « Principal »),
  **ajout** (nom + skin parmi les curated + traits), **suppression** (principal protégé). `getCompanionAgents` au montage,
  `createCompanionAgent`/`deleteCompanionAgent` + `loadFamily`.
- Vérifié en prod : ajout de « Pixel » (taquin) → apparaît et se promène dans la Chambre à côté de « Biscotte ».

## [Non versionné] — 2026-07-28 · compagnon : socle multi-compagnons (P1a — back)
Fondation « plusieurs compagnons par profil » (famille dans la Maison + collègues en open-spaces). Voir l'étude
`docs`/artifact « Compagnons-Agents Dowze ».
- **DB** : nouvelle table `companion_agents` (migration `0055`, appliquée en prod via psql) : `name, skin_url, size,
  personality jsonb (persona PNJ), role, space ('home'|open-space), pos {c,r}, is_primary, mode ('pnj'|'agent')` +
  index + contrainte « 1 seul principal / profil ». Schéma Drizzle `companionAgents`.
- **API** (`companion.controller`/`companion.service`) : `GET /companion/agents?space=` (liste, **sème le principal**
  depuis `profiles.companion` la 1re fois), `POST` (crée, plafond 300), `PATCH /:id`, `DELETE /:id` (**principal
  protégé**). Client : `getCompanionAgents/createCompanionAgent/updateCompanionAgent/deleteCompanionAgent` (`api.ts`).
- Vérifié en prod : semis « Biscotte » (principal), création/suppression d'un membre, suppression du principal → 400.
- Tamagotchi/pièce restent par profil (le « foyer ») ; jauges par-compagnon = phase ultérieure.

## [Non versionné] — 2026-07-27 · apps/web — compagnon : bulle de dialogue au-dessus de la teinte jour/nuit
La **bulle de dialogue** (et le petit feedback `fx`) du compagnon n'est plus assombrie par la teinte du cycle
jour/nuit. Cause : la teinte (`skyTint`, `zIndex 1_000_000`, clippée à la pièce) est un frère des entités ; la bulle,
enfant du sprite (z-index bas), ne pouvait pas passer au-dessus. Correctif : bulle + fx **sortis du sprite** et rendus
dans un calque séparé positionné sur le compagnon (`center(pos)`, même `depthScale`), avec `zIndex 1_000_001` — donc
au-dessus de la teinte. Le sprite reste teinté (immersion), la bulle reste toujours claire.

## [Non versionné] — 2026-07-27 · apps/web — compagnon : popup calendrier façon Apple/Google
Clic sur le bloc heure/date → **popup calendrier** au look Apple/Google (tout dans la fenêtre, aucun lien) :
- **En-tête épuré** : titre du jour (Jeudi 30 Juillet), navigation jour ‹ Aujourd'hui ›, **horloge live** (h:min:s), croix.
- **Mini-calendrier** à gauche (mois navigable ; aujourd'hui en pastille bleue pleine, jour sélectionné en bleu clair).
- **Timeline horaire du jour** à droite (comme la vue Jour du Planning) : colonne d'heures + grille + **événements en
  blocs colorés positionnés/dimensionnés par heure** (`blockStyle` fill/bar/text/sub, plage horaire auto-ajustée aux
  cours) + **ligne rouge « maintenant »** si le jour = aujourd'hui. États Vacances / Repos / Aucun cours.
- État `clockOpen`/`calView`/`selDay`/`schedule` ; `useProfile` ; `getSchedule`. Icônes `chevronLeft`/`chevronRight`.

## [Non versionné] — 2026-07-27 · apps/web — compagnon : popup météo PAYSAGE + nom de ville
Clic sur le bloc météo (haut-droite) → **fenêtre détaillée** style app météo, en **format paysage responsive** :
- Hook `useLocalWeather` enrichi (Open-Meteo) : `apparent_temperature`, `relative_humidity_2m`, `wind_speed_10m`,
  `precipitation`, `cloud_cover`, **horaire** (12 h : temp/code/proba), **journalier** (6 j : min/max/code/proba),
  `sunrise`/`sunset`. Helpers exportés `wmoIcon`/`wmoLabel`.
- **Nom de ville** : reverse-geocoding des coordonnées via **BigDataCloud** (gratuit, sans clé, CORS), en parallèle du
  fetch météo (`reverseCity`) — comble le trou de la géoloc navigateur qui ne donne que lat/lon. Affiché avec épingle.
- **Design immersif** (refonte) : fond **ciel dégradé** selon météo+jour/nuit (`weatherSky`), texte blanc, panneaux
  **« verre »** (`bg-white/10 backdrop-blur border-white/15`). Layout paysage `lg:flex-row` (stack + responsive sous lg) :
  gauche = ville (épingle) + grande temp + icône + condition + Max/Min/Ressenti + bande **prochaines heures** (glass,
  scroll) ; droite = 6 tuiles détails (`grid-cols-2 sm:grid-cols-3`) + **prévisions 6 jours** avec **barres de
  température** (dégradé bleu→ambre positionné selon min/max de la semaine). Icônes `wind`/`sunrise`/`sunset`/`mapPin`.

## [Non versionné] — 2026-07-27 · compagnon : TOUT à l'unité (fin des matériaux « gratuits/∞ »)
Suppression totale de la notion de matériau gratuit illimité — **chaque** matériau est acheté et posé à l'unité :
- `FREE_MATS` retiré de l'économie (import supprimé) ; `availableOf = stock − posé` pour TOUS (plus d'`Infinity`).
- **Inventaire** : n'affiche que les matériaux **achetés** (stock > 0), badge = quantité (nombre, jamais ∞).
- **Boutique** : tous les matériaux payants « X/unité » (plus de « Inclus ») ; quantité par défaut ×1.
- **Gomme** : nouvel outil (icône `eraser`) en tête de l'inventaire — efface un carré (retire l'override, revient au
  fond de pièce) et **rembourse** l'unité. Remplace l'ancien « repeindre avec le fond ». Clic gomme sur sol ET murs.
  Le fond de pièce (preset `floorTex/wallTex`) reste le visuel par défaut des carrés non peints (ne consomme rien).

## [Non versionné] — 2026-07-27 · compagnon : matériaux À L'UNITÉ (économie type Minecraft)
Les sols/murs s'achètent et se posent **à l'unité** (1 unité = 1 carré), avec des **stacks** :
- **Serveur** (`pet-care.service.ts`) : la colonne `pet_care.owned` (jsonb) est **réutilisée** pour stocker un
  `stock: Record<string, number>` (unités achetées par matériau) — **0 migration** ; `sanitizeStock` convertit l'ancienne
  liste booléenne en gros stock (99) pour rétro-compat. `CareState.owned` → `CareState.stock`. `buy(item, qty)` débite
  `prix × qty` et incrémente le stock (plus de check « déjà possédé »). Contrôleur : `buyBody` accepte `qty` (1..999).
  Meubles retirés de `SHOP_PRICES` serveur.
- **Client** : disponible calculé `= acheté − posé`, où *posé* = nb de marqueurs `~ft:/~wl:/~wr:` **toutes pièces
  confondues** (le client a déjà toutes les pièces). Les gratuits (défauts de pièce) sont **illimités (∞)**.
  - **Inventaire** : badge quantité par pastille (nombre pour les payants, ∞ pour les gratuits) ; stack épuisé → grisé,
    clic = ouvre la Boutique pour racheter.
  - **Pose** : `paintFloorTile`/`paintWall` **bloquent** si le stack est vide (ouvrent la Boutique) ; retrait/repeinture
    **rembourse** automatiquement (disponible = acheté − posé).
  - **Boutique** : prix **/unité**, sélecteur de **quantité** (×1/×8/×32/×64), bouton « Acheter ×N », « En stock ×N ».
  - `buyShopItem(item, qty)`.

## [Non versionné] — 2026-07-27 · apps/web — compagnon : vrai Inventaire (style jeu vidéo)
Refonte du sac en **inventaire type jeu vidéo** :
- **Panneau FLOTTANT de taille FIXE** à gauche (`left-5 top-28 bottom-32 w-72`) — grand, surtout haut, marges partout,
  ne touche aucun bord (dont la barre d'actions Nourrir/Jouer en bas) ; contenu **scrollable dedans** (isolé du zoom/pan).
- **Croix (X)** en haut à droite pour fermer (plus de bouton « Terminé »).
- **Bouton « Inventaire » bas-gauche toujours visible** = toggle (état actif surligné quand ouvert).
- **Sans onglets** : tous les objets possédés (sols + murs) au **même endroit**, `invItems = [...FLOOR_MATS,
  ...WALL_MATS].filter(possédé).filter(recherche)`.
- **Barre de recherche** en haut (icône `search` ajoutée) pour filtrer par nom + bouton effacer.
- Uniquement les objets **possédés** (gratuits + achetés) ; jauges santé masquées pendant l'ouverture. État `invQuery`
  remplace `paintTab`/`paintRows`.

## [Non versionné] — 2026-07-27 · apps/web — compagnon : suppression des meubles
Les **meubles** sont retirés du jeu (boutique + map + aménagement), pour ne garder que la déco par matériaux (sols/murs) :
- **Boutique** : catégorie « Meubles » supprimée → uniquement **Sols** et **Murs** (ouverture par défaut sur Sols).
- **Map** : plus de rendu des meubles placés (le compagnon est seul sur le sol ; les anciens meubles en base ne s'affichent
  plus).
- **Aménager** : palette de meubles + bouton « Acheter des meubles » retirés → seule la palette de matériaux reste.
- Code nettoyé : `FURNITURE`/`FURNITURE_IDS`/`SHOP_PRICES`/`SHOP_IDS`, `removeItem`, la branche de placement de meuble et
  le pinceau `furniture` supprimés ; pinceau réduit à `floor`/`wall`.
- Paramètres : « Vider la pièce — retirer tous les meubles » → « Réinitialiser la pièce — sols & murs par défaut »
  (efface aussi tout ancien meuble en base).

## [Non versionné] — 2026-07-27 · apps/web — compagnon : course réelle du soleil et de la lune
Le soleil et la lune du décor suivent désormais leur **vraie trajectoire** selon la localisation et l'instant (plus de
fenêtre horaire fixe) :
- **Position astronomique** (altitude + azimut) calculée pour la lat/lon réelles et l'heure : soleil = algo NOAA basse
  précision (`sunAltAz`), lune = série tronquée (`moonAltAz`). Lat/lon exposées par `useLocalWeather` (géoloc ou repli IP ;
  défaut Suisse 46,8/8,2).
- **Projection** sur la voûte (`skyProject`) : est (lever) à gauche, sud (midi) au centre, ouest (coucher) à droite ;
  hauteur = sinus de l'altitude. Vrais lever/coucher et hauteur méridienne (ex. Suisse fin juillet : soleil ~62° à midi,
  lever ~6 h, coucher ~21 h).
- Chaque astre n'est visible **qu'au-dessus de l'horizon** ; les deux peuvent coexister (lune de jour atténuée, soleil
  couchant + lune levante au crépuscule).
- Vérifié en prod : à midi soleil haut au SE, à 20 h 30 soleil bas à l'ouest + lune gibbeuse levante au SE.

## [Non versionné] — 2026-07-27 · apps/web — compagnon : phases réelles de la lune
La lune du décor (`RoomBackground`) affiche désormais sa **vraie forme** selon la date/localisation réelles :
- **Phase calculée** depuis la date locale (mois synodique 29,530588853 j depuis une nouvelle lune de référence) →
  `moonPhaseFrac`. Les 8 formes (nouvelle → premier croissant → premier quartier → gibbeuse croissante → pleine →
  gibbeuse décroissante → dernier quartier → dernier croissant) sont dessinées en SVG (`moonLitPath` : limbe + terminateur
  en demi-ellipse ; `MoonSVG`).
- **Orientation hémisphère nord** (Suisse) : croissant éclairé **à droite** en phase croissante, à gauche en décroissante.
- **Halo proportionnel** à la fraction éclairée (nouvelle lune quasi invisible, pleine lune halo max).
- Vérifié en prod le 27/07 : gibbeuse croissante ~94 % (nouvelle lune 14/07, pleine ~29/07), conforme au ciel réel.

## [Non versionné] — 2026-07-27 · apps/web — compagnon : décor derrière la salle (ciel + horizon par zone)
Composant `RoomBackground` rendu **derrière** la salle iso (`pointer-events:none`, ne gêne ni clics ni HUD) :
- **Ciel dynamique** en dégradé suivant l'heure réelle (jour/aube/coucher/nuit) + **soleil/lune** en arc selon l'heure,
  **étoiles** scintillantes la nuit, **nuages** qui dérivent.
- **Horizon par zone** : **mer** (Plage), **collines** (Jardin), **montagnes** lointaines (pièces intérieures).
- **Oiseaux** le jour / **lucioles** la nuit.
- **Parallaxe** : au déplacement de la vue (pan clic-droit), les couches bougent à des vitesses différentes (étoiles < soleil <
  horizon < oiseaux < nuages) pour la profondeur.

## [Non versionné] — 2026-07-26 · apps/dev — atelier Assets nettoyé (props ChatGPT uniquement)
Les textures sol/mur du jeu sont désormais générées par code (cf. entrée apps/web) → l'atelier de prompts n'a plus à les gérer.
- Retiré du catalogue (`lib/assets.ts`) : les **21 assets textures** (`sols`/`murs`, kinds `floortex`/`walltex`) + leurs catégories,
  + le code mort associé (branches `isTexture` des builders, `NOT_TEX`, entrées `KIND_LABEL`). Reste **121 assets** (meubles, objets
  muraux dont Portes & fenêtres, tapis, déco, nature, nourriture…) — tous des **props à fond transparent**.
- Retiré le **prompt ComfyUI** (`buildComfyInstruction`, `COMFY_GUIDE`) et sa section dans la modale (`catalog.tsx`). L'atelier
  ne montre plus que les **prompts ChatGPT** (principal + variante cohérence). `METHOD_NOTE` simplifiée (props only).

## [Non versionné] — 2026-07-26 · apps/web — compagnon : textures sol/mur générées + Boutique matériaux + Peindre
Jeu iso du compagnon (academie.dowze.ch/compagnon) : les sols/murs peints en couleurs unies → **vraies textures pixel-art**.
- **21 textures générées PAR CODE** (générateur procédural maison, encodeur PNG + bruit tileable), **seamless garanti** :
  14 sols (parquet clair/foncé, chevron, damier, carrelage, moquette, béton, marbre, herbe, sable, terre, pavés, eau, neige)
  + 7 murs (pastel, fleuri, brique, lambris, carrelage, rayures, crépi). Fichiers 1024² dans `apps/web/public/textures/`.
- **Branchées dans le moteur** (`companion-room.tsx`) via `<pattern>` SVG avec **projection iso** (matrices de skew : motif
  couché sur le plan sol, collé sur les 2 murs). Défauts par pièce (intérieur : parquet/carrelage/fleuri… ; extérieur : herbe, sable).
- **Boutique** (`components/companion`) : sections **Meubles / Sols / Murs**, matériaux **achetables** (aperçu swatch, prix, débit gold).
  Gratuits (défauts) marqués « Inclus ».
- **Peindre** (mode Aménager) : rangées Sol/Mur, clic = applique le matériau (payant verrouillé → ouvre la Boutique).
  Matériau appliqué **persisté par pièce** comme item spécial `~floor:`/`~wall:` dans le `items` jsonb existant (0 migration DB).
- **Serveur** (`apps/api/.../pet-care.service.ts`) : `SHOP_PRICES` étendu avec les 21 ids de textures → achetables (débit + `owned`), sans changement de schéma.
- Déployé : `web` + `api` + `worker` reconstruits (voir [[dowze-prod-deploy]]).
- **Peinture PAR CARRÉ (façon blocs Minecraft)** : on choisit un matériau (pinceau) puis on clique les carrés un par un — pas
  obligé de tout repeindre. Sol par tuile ; **murs subdivisés en grille de carrés** (`WLEVELS=3`, `wlPts`/`wrPts`). Override par
  carré persisté (`~ft:`/`~wl:`/`~wr:` avec c/r = position ; caps `MAX_ITEMS`/zod montés à 300). Boutique : **sidebar de catégories**
  (Meubles/Sols/Murs) + le popup ne scrolle/zoome plus la map derrière.
- **Rendu bloc iso correct** : plus de `<pattern>` continu ; **une texture par carré** plaquée sur le parallélogramme via
  matrice affine (`floorFaceMtx`/`wlFaceMtx`/`wrFaceMtx`) → chaque carré = un bloc-texture (méthode standard des jeux iso 2.5D).
- **219 matériaux** (112 sols + 107 murs) générés PAR CODE (`scratchpad/gen2.mjs` : familles de motifs paramétrées par palette —
  parquets/chevrons/damiers/carrelages/marbres/béton/pavés/terrazzo/moquette/mosaïque + unis/rayures/fleuri/pois/brique/lambris/
  vichy/losanges/crépi…). **Catalogue TS généré** = source unique : `materials.generated.ts` (client) + `material-prices.generated.ts`
  (serveur, mergé dans `SHOP_PRICES`).

## [Non versionné] — 2026-07-24 · apps/dev — prompts assets : 2 familles (textures vs props)
Recadrage : le moteur iso crée déjà la géométrie sol/murs. Refonte de `lib/assets.ts` (`buildPrompt`/`buildRefPrompt`/
`METHOD_NOTE`, `AssetKind`) selon la logique **Habbo/Les Sims** :
- **TEXTURES de surface** (`floortex`, `walltex`) : le prompt demande un **swatch carré, plat (top-down), raccordable
  (seamless), plein cadre, SANS iso, SANS perspective, SANS ombre directionnelle, SANS transparence** — juste le revêtement
  à « peindre » sur les surfaces.
- **PROPS** (`prop` furni au sol, `wallprop` objets muraux, `rug` décors au sol) : sprite **isolé à fond transparent** —
  furni à l'angle **iso**, objets muraux **de face** (fenêtres, portes, tableaux, étagères… à poser où on veut sur un mur).
- Reclassement complet du catalogue : `sols`→textures, `murs`→textures (revêtements), **nouvelle catégorie « Portes & fenêtres »**
  (fenêtre, fenêtre ronde, baie vitrée, portes = objets muraux), et objets muraux repérés (horloge, tableau, cadre, étagères
  murales, placard/épices, guirlande, plante suspendue…). Fenêtre/porte ne sont plus « cuites » dans un panneau de mur.
- UI (`catalog.tsx`) : **badge de type** par asset (Texture sol / Texture mur / Meuble‑objet / Objet mural / Tapis) sur la carte
  et dans la modale ; `METHOD_NOTE` explique la méthode **1 ancre PAR FAMILLE**. 142 assets.

## [Non versionné] — 2026-07-24 · apps/dev — outil « Éditeur » (IDE / éditeur de code)
5ᵉ outil dans la top bar, à côté de Fichiers (`components/code.tsx`, `lib/code.ts`, route `api/code`). Éditeur de texte/code
complet façon **Zed / Sublime Text**, **sans dépendance externe** (coloration maison, build Docker inchangé).
- **Coloration syntaxique** maison (tokeniseur à règles collantes `sticky`, overlay `<pre>` derrière un `<textarea>` transparent) :
  JS/TS, C/Java/Go/Rust, Python, Shell, JSON, CSS, HTML/XML, Markdown, texte. Détection auto par extension + sélecteur manuel.
- **Gouttière** de numéros de ligne, **ligne active** surlignée, **position Ln/Col**, nb de lignes, taille, **retour à la ligne** optionnel.
- **Onglets** multi-documents (indicateur « modifié », fermeture), **sidebar** des documents (nouveau / ouvrir / renommer / supprimer).
- **Édition** : Tab = 2 espaces (indentation/désindentation de bloc), **auto-indentation** à l'Entrée, **auto-fermeture** des paires
  `() [] {} "" '' \`\``, annulation native préservée (`execCommand insertText`), raccourcis **⌘S** (enregistrer) / **⌘F** (rechercher).
- **Recherche & remplacement** (précédent/suivant, nombre de résultats, remplacer / tout remplacer).
- **Thème clair / sombre** (bascule soleil/lune) sur **tout l'outil** (chrome + surface + couleurs de syntaxe One Light / One Dark),
  mémorisé dans `localStorage`.
- **Sauvegarde serveur par compte** (comme Dessin) : un fichier texte par document dans le volume (`/data/code/<user>/`),
  5 Mo/doc, nom assaini, session requise.

## [Non versionné] — 2026-07-24 · apps/dev — explorateur « Fichiers » façon macOS Finder (refonte)
Recherche/analyse du Finder (HIG + drives web) puis refonte complète de `components/files.tsx` en vrai explorateur :
- **Sidebar** (Favoris : Accueil ; Dossiers : accès rapide) + **toolbar** (retour/avance avec historique, fil d'Ariane,
  sélecteur de vue, recherche, Nouveau dossier, Importer) + **barre d'état** (nb éléments, sélection, espace utilisé/quota).
- **3 vues** : **Icônes** (grille + thumbnails), **Liste** (colonnes triables Nom/Modifié/Taille/Type), **Colonnes (Miller)**.
- **Interactions Finder** : sélection simple / ⌘/Ctrl+clic / Maj+clic, double-clic pour ouvrir, **menu contextuel** (clic droit),
  **Quick Look** (Espace / clic) pour images et texte, **glisser-déposer vers un dossier** (déplacement), upload OS (fichiers+dossiers),
  renommer en place, supprimer, raccourcis clavier (Espace, Entrée, ⌘A, ⌘⌫). Accent **bleu Finder** (#0A84FF) local à l'outil.
- Backend : route download `?inline=1` (aperçu/thumbnails), PATCH étendu au **déplacement** (`destDir`), route `save` (édition texte).
- **Éditeur de texte** dans le Quick Look (textarea, Enregistrer → `api/files/save`) pour les fichiers texte/code.
- **Sidebar type PC** : « Accueil » retiré ; **6 catégories fixes** auto-créées (Bureau, Téléchargements, Documents, Images,
  Musiques, Vidéos) avec icônes + drop-target ; bouton **+** (à côté de « Favoris ») pour ajouter une catégorie (dossier racine).
- **Barre de stockage** en bas à droite de la barre d'état (nb fichiers/dossiers + jauge + utilisé/quota).
3ᵉ outil dans la top bar (`components/files.tsx`, `lib/files.ts`, routes `api/files/*`). Stockage RÉEL par compte dans
le volume (`/data/files/<user>/`), accessible depuis n'importe quel PC.
- **Upload** : glisser-déposer de **fichiers ET dossiers** (arborescence préservée via `webkitGetAsEntry`), + bouton Importer.
  Multi-fichiers, chemins relatifs nettoyés segment par segment (anti-traversée), quota 2 Go/compte, 100 Mo/fichier.
- **Navigation** : fil d'Ariane + clic sur dossier ; **Nouveau dossier** ; **renommer / supprimer / télécharger**.
- **Tailles** par élément (dossiers = taille récursive) + **total de l'espace** (poids utilisé / quota + nb fichiers/dossiers).
- Sécurité : `resolveSafe` (chemins sous la racine de l'utilisateur), session requise (middleware + route). Limite proxy NPM montée à 200 Mo.

## [Non versionné] — 2026-07-24 · apps/dev — outil « Dessin » (Paint / schémas)
4ᵉ outil dans la top bar (entre Tâches et Fichiers) : `components/draw.tsx`, `lib/draw.ts`, routes `api/draw/*`.
- **Canvas HTML5** (1280×800) + palette d'outils : **crayon, gomme, ligne, rectangle, ellipse, flèche, texte**.
- **Couleurs** (palette + sélecteur custom), **épaisseur** (slider), **remplir** (formes), **annuler/rétablir** (⌘Z / ⌘⇧Z),
  **effacer**, **télécharger** (PNG).
- **Dessins nommés** enregistrés côté serveur (PNG dans `/data/draw/<user>/`), **galerie « Mes dessins »** avec miniatures
  (ouvrir / renommer / supprimer). Sécurité : nom assaini, session requise, 20 Mo/dessin.
- **Barre du bas** (infos : outil, couleur, épaisseur, dimensions, calques, état non enregistré) + **zoom** (− / % / + /
  Ajuster, Ctrl/⌘+molette) avec canvas scrollable quand agrandi.
- **Vrai système de calques type Photoshop (A→Z)** : canvas empilés (le navigateur composite via `mix-blend-mode` dans un
  contexte `isolate`), panneau Calques complet :
  - **16 modes de fusion** (Normal, Produit, Superposition, Incrustation, Obscurcir, Éclaircir, Densité couleur ±, Lumière
    crue/tamisée, Différence, Exclusion, Teinte, Saturation, Couleur, Luminosité) par calque — appliqués à l'écran
    (`mix-blend-mode`) et à l'aplatissement (`globalCompositeOperation`).
  - **Vignettes** (thumbnails) de chaque calque, régénérées à chaque trait/opération (damier = transparence).
  - **Glisser-déposer** pour réordonner les calques dans le panneau (+ boutons ↑↓ conservés).
  - **Verrouillage** par calque (cadenas — bloque le dessin/effacement), **visibilité** (œil), **opacité** (0–100 %).
  - **Fusionner avec le calque dessous** (merge down, respecte opacité + mode) et **Aplatir** l'image.
  - **Dupliquer**, **renommer** (double-clic), **supprimer**, calque actif surligné.
  - **Outil Déplacer** : repositionne le contenu du calque actif (snapshot → `drawImage` décalé).
  - gomme en `destination-out` (révèle les calques dessous). **Undo/redo par calque**.
  - **Persistance** : projet JSON (`api/draw/project`) — chaque calque en dataURL + `blend`/`locked`/`opacity`/`visible` ;
    PNG aplati (avec modes + opacité) pour miniature/téléchargement ; réouverture restaure calques + métadonnées.
- **Palette de couleurs type Photoshop** : carré saturation/valeur + curseur de teinte + hex + R/G/B + swatches (popover).
- **Règles** activables (haut + gauche) avec graduations, synchronisées au zoom et au défilement.
- **Bibliothèque d'images** (icône dans la **barre d'outils gauche** → panneau latéral) pour les schémas : ~30 stencils vectoriels
  groupés (Infrastructure : serveur, écran/PC, tour, portable, base de données, disque, cloud, internet ; Réseau : routeur,
  switch, Wi-Fi, pare-feu, bouclier, antenne, ethernet, connexion ; Général : utilisateur, groupe, mobile, imprimante, dossier,
  verrou, clé, e-mail, terminal, réglages, alerte, horloge). **Glisser sur le dessin** (placé au drop) ou **cliquer** (au centre) ;
  recolorés à la **couleur active** et transparents (PNG).
  - **Chaque image = un objet sur son propre calque** (nommé d'après l'icône), rasterisé depuis un cache SVG haute résolution.
  - **Sélectionnable / déplaçable / redimensionnable** avec l'outil **Déplacer** : clic pour sélectionner (du plus haut au plus bas),
    **boîte de transformation à 8 poignées** (déplacement + redimensionnement dans tous les sens). Métadonnées (inner/couleur/x/y/w/h)
    **persistées** dans le projet → l'objet reste éditable après réouverture. Dupliquer conserve l'objet ; aplatir/fusionner le matrice.

## [Non versionné] — 2026-07-24 · apps/dev — espace multi-outils (top bar) + gestionnaire de tâches
- **Top bar** avec onglets d'outils (`components/workspace.tsx`) : **Assets** (l'atelier de prompts) et **Tâches**.
  Marque + compte/déconnexion déplacés dans la top bar ; `Catalog` nettoyé (plus de marque/logout, `h-full`).
- **Outil Tâches** (`components/tasks.tsx`, `api/tasks/route.ts`) : **kanban** À faire / En cours / Fait.
  Création avec **type** (Tâche/Idée/Bug) + **priorité** (Urgente→Basse, tri auto). **Drag & drop natif** (HTML5,
  sans dépendance) pour déplacer entre colonnes (id via `dataTransfer`, colonne surlignée au survol). **Clic sur une carte
  → modale** (titre éditable + type/priorité/statut + date, actions Enregistrer/Supprimer avec confirmation).
  Persisté par utilisateur dans le volume (`/data/tasks.json`).

## [Non versionné] — 2026-07-24 · apps/dev — prompts transparent direct + doc exhaustive (recherche)
Recherche approfondie (app web ChatGPT, PAS l'API — l'utilisateur confirme que le chat gère bien le PNG transparent).
- **Fond TRANSPARENT direct** dans les prompts : « fully transparent background — a real RGBA PNG with a genuine alpha
  channel » + bloc négatif serré interdisant explicitement le **damier**/carte (évite les faux transparents). Fini le magenta.
- Prompt en **lignes labellisées** (View/Style/Composition/Background/Do NOT/Output), invariants figés verbatim, une seule
  ligne variable (l'objet). `buildRefPrompt` = contrat **PRESERVE / CHANGE ONLY / CONSTRAINTS** avec l'ancre jointe.
- `METHOD_NOTE` : vérifier l'alpha, Projet ChatGPT, ré-ancrage tous les ~6 assets, secours remove.bg.
- **Doc exhaustive** `docs/13-COMPAGNON/01-prompts-assets.md` (A→Z) : modèles gpt-image-1/1.5/2, accès, 6 principes de
  prompting, transparence + vérif alpha + secours, cohérence/ancre, isométrie, style, variantes, résolution, tableau
  échecs↔correctifs, **5 templates prêts**, workflow complet 139 assets, outils gratuits, section Codex, sources.

## [Non versionné] — 2026-07-23 · Nouvelle app `apps/dev` — atelier de prompts d'assets (dev.dowze.ch)
Nouvelle app Next.js 15 interne pour **générer les assets PNG** du jeu isométrique du compagnon.
- **Design system** : `npx getdesign@latest add figma` → `apps/dev/DESIGN.md` (tokens figma : mono N&B + blocs pastel,
  accent magenta, pilules, hairline) repris dans `globals.css` (@theme).
- **Auth autonome (aucune dépendance)** : login uniquement, **pas d'inscription**. Comptes gérés par l'admin via l'env
  `DEV_ACCOUNTS="user:pass,..."`. Session = cookie signé HMAC-SHA256 (Web Crypto, OK middleware + route handlers).
  `middleware.ts` protège tout ; `verifySession` dans `lib/session.ts`.
- **Catalogue** (`lib/assets.ts`) : ~130 assets classés (sols, murs, chambre/salon/cuisine/bureau, déco, jardin/plage,
  nature, objets, nourriture ; intérieur/extérieur). Chaque prompt = template optimisé (recherche) STYLE (Habbo×AC×Dofus×
  Tamagotchi, retro-pixel cute) + CAMERA (iso 2:1 dimétrique, 30°, orthographique ; variantes sol/mur/tapis) + OBJET +
  CLEANLINESS (PNG transparent, `gpt-image-1`).
- **UI** (`components/catalog.tsx`) : **barre latérale gauche** (marque + progression globale + recherche + catégories à
  pastilles/compteurs, catégorie active → contenu focalisé ; « Tout » = toutes les sections ; toggle « Masquer les créés »
  + user/déconnexion en bas). Cartes **compactes** : case à cocher to-do (persistée par utilisateur via `/api/todo` →
  `/data/todo.json`), nom `.png`, **Copier le prompt** (principal) / **Nom**, **prompt toujours affiché** dans la carte,
  et bouton **« Plus »** → **popup centrale** (prompt en grand + « Marquer comme créé » + Copier le prompt / Copier le nom,
  fermeture croix/clic-dehors/Échap). (Refonte après retours : sidebar, ergonomie, sous-titre retiré, prompt déroulé + modale.)
- **Déploiement (EN LIGNE, vérifié bout en bout)** : `apps/dev/Dockerfile` (pattern monorepo) ; service `dev` + volume
  `dev-data` dans `compose.yaml` ; routeur Traefik **fichier** `/srv/data/traefik/dynamic/dev.yml` (Traefik = provider
  fichier, pas les labels docker) ; cert Let's Encrypt : `dev.dowze.ch` ajouté au SAN acme.sh (ré-émission dns_ikv1/Infomaniak).
- **Chaîne réseau complète (topologie réelle dowze.ch)** : DNS **A `dev.dowze.ch` → 51.178.51.40** (créé via l'API Infomaniak,
  token acme.sh) → **VPS 51.178.51.40** = nginx **stream `ssl_preread` (SNI passthrough)** `/etc/nginx/stream.conf` : ajouté
  `dev.dowze.ch → 10.0.0.4:443` (prod via WireGuard ; sans ça le SNI inconnu partait vers le NAS `default 10.0.0.2:443`) →
  **Traefik prod** → conteneur. Vérifié public : login 200, auth admin 200, TLS valide (cert couvre dev), DNS propagé (1.1.1.1/8.8.8.8).

## [Non versionné] — 2026-07-23 · Compagnon : banque de répliques élargie + anti-répétition renforcée
- **Beaucoup plus de répliques** (`companion-brain.ts`) : bavardage, motivation, 4 tranches horaires, 7 types de météo,
  6 pièces, états — plus les réactions aux soins passées à ~8–10 variantes chacune. → il se répète nettement moins.
- **Anti-répétition sur les 6 dernières** répliques (au lieu de la seule dernière) : `pickLine(ctx, recent[])` filtre
  l'historique récent ; `lastLine` devient un tampon des 6 dernières côté jeu ET compagnon flottant.
- Vérifié en prod : 16 clics → 15 répliques distinctes (1 seule répétition, espacée de 8 tirages).

## [Non versionné] — 2026-07-23 · Compagnon : cerveau étendu (plus malin + réactions + flottant autonome)
Extension du cerveau sans IA :
- **Plus de répliques + combos « intelligents »** (`companion-brain.ts`) : lignes croisant **pièce × météo × heure ×
  état** (ex. jardin+pluie « on rentre ? », plage+chaud « on se baigne ? », bureau 8–19 h « une séance ? »,
  cuisine+faim, chambre+nuit/fatigue, salon+soir, orage/pluie à l'abri…) avec poids élevés pour surgir au bon moment.
- **Réactions aux soins** : `pickReaction(action)` → réplique variée à chaque nourrir/jouer/dormir/nettoyer/soigner/câliner
  (ex. « Je me régale ! », « Tout propre ! »), branchée dans `doAction`.
- **Compagnon flottant autonome** (autres pages, `companion.tsx`) : **parole spontanée** contextuelle quand il est au
  repos (toutes ~26–48 s), **clic = réplique** contextuelle, **petit saut** (`cmp-hop`) à chaque prise de parole.
  Contexte via `lib/ambient.ts` = heure locale + météo **par IP (sans prompt géoloc)**, partagée + cachée 30 min.
  Un message de l'IA (bus) reprend toujours le pas sur la parole spontanée.
- Vérifié en prod : soin → « Je me régale ! » ; flottant clic → « La soirée est douce. », spontané → « Hii ! ».

## [Non versionné] — 2026-07-23 · Compagnon : « cerveau » autonome sans IA (NPC de jeu vidéo)
Un compagnon qui **vit et parle tout seul** comme un NPC de jeu — **100 % côté client, 0 réseau, 0 clé IA, 0 crédit,
instantané**. Complément (pas remplacement) de l'IA réelle ; on joue sur la rapidité et le zéro-délai.
- **Nouveau module** `lib/companion-brain.ts` (pur, réutilisable) :
  - **Dialogue** : banque de ~60 répliques pré-écrites taguées par contexte (humeur, jauges, heure locale, météo, pièce,
    température) → sélection **pondérée + anti-répétition** + variables `{name}`. `pickLine(ctx)` = instantané.
  - **Autonomie (utility AI)** : `decideAction(ctx)` note *dormir / flâner / visiter un meuble / mimique / bulle* selon
    l'état (fatigué ou nuit→dort ; mauvais temps→se pose ; jour→balade) et tire au sort pondéré. `pickWanderTarget()` = case libre proche.
- **Intégration** (`companion-room.tsx`) : boucle `setInterval` 900 ms (en pause si onglet caché, menu ouvert, transition,
  ou déjà en mouvement) avec cadence gérée par un cooldown ; réutilise le déplacement iso + les anims existants
  (`autoAnim` : dort=waiting, salue=waving, saute=jumping). Le clic ou un déplacement manuel **reprend la main** 4 s.
  Le clic sur le compagnon utilise désormais `pickLine` (répliques contextuelles) au lieu d'une liste figée.
- Vérifié en prod : déplacement autonome (4 positions/14 s), bulle au clic « Bonne soirée ! » (heure réelle),
  bulle spontanée « Je suis en pleine forme ! » (jauges hautes). Aucune requête, aucun crédit.

## [Non versionné] — 2026-07-23 · Compagnon : Boutique + monnaie « gold »
- **Économie serveur** : `pet_care` gagne `gold` (int, défaut 300) + `owned` (jsonb, ids d'objets débloqués ;
  lot de base gratuit : plante/tapis/chaise/lampe/fleur). Migration `0054_pet_shop.sql`.
- **Catalogue Boutique** = prix **côté serveur** (`SHOP_PRICES`, 30→200 gold). `POST /companion/shop/buy { item }` :
  valide prix + solde + non-possédé, débite le gold, débloque l'objet, renvoie l'état de soin à jour (gold + owned).
  `GET /companion/care` renvoie désormais `gold` + `owned`.
- **UI jeu** :
  - **Compteur de gold** : pilule autonome (pièce ambre) **au-dessus du board** (haut-gauche), au-dessus du scoreboard santé.
  - **Bouton Boutique** en **bas à droite** → **modale compacte** centrée (max-w-2xl, ~86% de haut) : grille d'objets
    (aperçu + nom + prix), « Acheter » / « Trop cher » / « Possédé », solde en gold dans l'en-tête.
  - La **palette Aménager** ne montre que les objets **possédés** (+ un bouton `+` vers la Boutique) ;
    on doit acheter un meuble avant de pouvoir le placer.
- Vérifié en prod : achat Arbre (−80 → 220 gold), objet passé « Possédé », ajouté à la palette, persistant après rechargement.

## [Non versionné] — 2026-07-23 · Compagnon : heure locale + météo réelles (HUD + map)
- **Haut-droite du jeu** : **horloge · météo · engrenage** sur une ligne (heure + météo à gauche de la roue paramètre), zoom en dessous.
  - **Horloge** : heure locale EXACTE de la localisation (HH:MM:SS + date), mise à jour chaque seconde.
  - **Météo** : température + condition RÉELLES via **géolocalisation** (navigateur, repli IP `ipwho.is`) +
    **Open-Meteo** (`current=temperature_2m,weather_code,is_day`, codes WMO → libellé FR + icône). Rafraîchi /15 min.
- **Sur la map** :
  - **Cycle jour/nuit** : teinte interpolée selon l'heure locale (nuit bleu nuit → aube/coucher orangés → plein jour clair).
    L'éclairage est **clippé à la silhouette de la pièce** (sol+murs+meubles+compagnon) via `clip-path`, au-dessus des entités —
    il n'affecte QUE la map, jamais les boutons du HUD.
  - **Effets météo** : **pluie / neige / brouillard / orage** (particules CSS `wx-rain`/`wx-snow`/`wx-fog`/`wx-flash`)
    pilotés par la catégorie WMO ; ciel clair/nuageux = pas de particules.
- Fichiers : `lib/use-local-weather.ts` (hook géoloc+Open-Meteo), icônes météo Lucide + `skyTint()` + `WeatherFx`
  dans `companion-room.tsx`, keyframes dans `globals.css`. Aucune clé API, aucune CSP à ajuster (Open-Meteo CORS-ouvert).
- Vérifié en prod : horloge = heure locale (18:27:13), météo 25° « Ciel clair », teinte ciel `rgba(255,163,104,.24)` (golden hour), pluie animée.

## [Non versionné] — 2026-07-23 · Compagnon : meubles PAR pièce
- Les meubles/objets/accessoires sont désormais **propres à chaque pièce** : changer de pièce = un décor différent
  avec ses propres meubles (Chambre ≠ Salon ≠ Cuisine…).
- **Modèle** : `pet_room.items` (jsonb) passe d'un tableau unique à une **map `{ idPièce → RoomItem[] }`** ;
  contrat API `GET/PUT /companion/room` → `{ room, rooms }` (`sanitizeRoomMap`, garde-fou 400 items global).
  **Aucune migration DB** (jsonb) ; l'ancien format tableau est **auto-migré** sous la clé `chambre`.
- **Front** (`companion-room.tsx`) : `items` unique remplacé par `roomsMap` + `items = roomsMap[room]` ;
  `updateItems()` écrit la pièce courante ; « Vider la pièce » ne vide que la pièce active.
- Vérifié en prod : Chambre (arbre/plante/télé) et Salon (table) gardent chacune leur déco, y compris après rechargement.

## [Non versionné] — 2026-07-23 · Compagnon : nav simplifiée + vrai menu Paramètres
- **Nav** : « Mon compagnon » retiré d'« Apprendre » ; en bas de la barre latérale, « Mon Copilote » remplacé par
  **« Mon compagnon »** (→ le jeu `/compagnon`). La page `/copilote` reste accessible en direct mais n'est plus dans la nav.
- **Menu Paramètres** (popup engrenage du jeu) devient un **vrai menu à sections** (barre latérale + pages) :
  **Compagnon** (apparence = `CompanionPicker`), **Copilote (IA)** (modèle + clés API = `CopiloteSettings` extrait de la page),
  **Maison** (vider la pièce). Composants : `components/copilote-settings.tsx` (extraction), `components/companion/settings-menu.tsx`.

## [Non versionné] — 2026-07-23 · Compagnon : « Maison » — jeu isométrique (Habbo-like)
Socle d'un jeu **2,5D isométrique** où le compagnon vit dans des **pièces à meubler** (chambre, salon, cuisine,
bureau, jardin, plage), style rétro-cute (Habbo × Animal Crossing × Dofus × Tamagotchi).
- **Grille iso** SVG (sol en losanges + 2 murs / extérieur sans murs) ; **compagnon qui marche** au clic (animé, `running`).
- **Profondeur** : entités triées par `c+r` (premier/arrière-plan → passe devant/derrière) + **perspective** (échelle selon la profondeur).
- **Meubles** : palette + placement/retrait (mode *Aménager*), 10 meubles SVG starter ; **sauvegardés par compte**
  (table `pet_room`, migration `0053`, `GET/PUT /companion/room`).
- **Pièces** commutables ; `getPetRoom`/`setPetRoom` (`api.ts`).
- **Transition de pièce façon Dofus/Habbo** : au changement de pièce, le compagnon **marche vers la porte** (coin avant),
  **fondu**, puis **entre** dans la nouvelle pièce et marche jusqu'au centre (machine à états exit→enter, `onArriveRef`).
- **Une seule page** (plus d'onglets Soin/Maison) : la Maison isométrique est le fond, le **soin est superposé autour** —
  nom/âge/humeur en haut, **jauges à gauche**, **actions de soin en bas** (remplacées par la palette en mode Aménager),
  contrôles de pièce en bas. **Zoom molette** + **déplacement de la vue au clic droit maintenu (pan)**.
- Doc `docs/13-COMPAGNON` §8quater (vision + analyse Habbo/AC/Dofus + technique + **pipeline PNG** pour meubles générés par IA + roadmap).

## [Non versionné] — 2026-07-23 · Compagnon : Tamagotchi (soin du compagnon)
Le compagnon devient un **Tamagotchi** — on s'en occupe pour créer une boucle d'engagement quotidienne
(revenir chaque jour + étudier). Toutes les fonctions A→Z :
- **5 jauges** (satiété, bonheur, énergie, hygiène, santé) qui **décroissent en temps réel** — recalcul **au timestamp**
  côté serveur (pas de cron) : à chaque lecture/action on applique le temps écoulé depuis `last_tick`.
- **6 actions** : nourrir, jouer, dormir, nettoyer, soigner, câliner (effets + réaction visuelle du pet).
- **Âge** (depuis `born_at`) + **humeur** dérivée mappée sur une animation → l'écran réagit.
- **Non-punitif** : décroissance douce, pas de mort permanente (négligé → triste/malade, réveillable).
- Backend : table `pet_care` (migration `0052`), `PetCareService`, `GET /companion/care` + `POST /companion/care/:action`.
- Front : page **`/compagnon`** (nav « Apprendre ») — pet dans son monde, jauges, humeur, âge, boutons de soin ;
  `getPetCare`/`actPetCare` dans `api.ts`. Doc `docs/13-COMPAGNON` §8ter.
- **Refonte « vrai jeu » plein cadre** : la page passe en `isFull` (toute la zone de contenu), le **pet flottant est masqué**
  sur cette page (plus de doublon), scène (monde) plein écran + **HUD** (nom/âge/humeur) + **jauges à icônes** (Lucide) +
  **barre d'actions colorée** + **feedback animé** (bulle « Miam ! » qui monte, `@keyframes tam-float-up`). Bouton d'accès
  en haut de *Mon Copilote*.

## [Non versionné] — 2026-07-23 · Compagnon : mode « cam » + mondes (immersion study-with-me)
Nouveau mode d'affichage optionnel : le compagnon passe en **tuile façon visio Discord** (bords arrondis) avec
un **décor (« monde ») derrière le pet**, posé au sol, à **taille fixe** — comme s'il était en cours avec toi.
- **Mondes en SVG** (`companion-worlds.tsx`, zéro asset externe) : salle de classe, plage, piscine, espace, forêt, café.
- **Tuile cam** (`companion-cam.tsx`) : ratio 4:3, pastille « en direct » + nom ; **seule la tuile se redimensionne** (`camSize`), pas le pet.
- **Global** (`companion.tsx`) : rend la cam quand `camMode` (déplaçable + redimensionnable ; clamp/drag généralisés largeur/hauteur).
- **Réglages** (picker, dans *Mon Copilote*) : interrupteur *Mode cam*, choix du monde (miniatures live), curseur *Taille de la cam*, aperçu live.
- **Perso au compte** : `camMode/world/camSize` ajoutés à `profiles.companion` (jsonb) + zod API + synchro + store.
- **Nom du compagnon** : champ pour nommer sa persona (`companionName`, distinct du nom d'un pet importé), affiché en bas de la cam à la place de « Dowze ». Sauvegardé au compte (`companion.name`).
- **Pas d'interrupteur** : le mode cam n'est PAS activable/désactivable manuellement. Il s'activera **automatiquement** en session de travail/concentration (à venir). Pour l'instant, le compagnon sur le site reste le **pet normal** ; la section « Mode cam » du Copilote ne sert qu'à **préparer** (aperçu + choix du monde + taille de la cam).
- Doc `docs/13-COMPAGNON/00-compagnon.md` (§8bis) mise à jour (concept + recherche body-doubling/Focusmate/Forest/Lofi + implé).

## [Non versionné] — 2026-07-23 · Compagnon : « Super NONO » = pet par défaut de tout le monde
Ajout de **Super NONO** (récupéré de codex-pets.net, auto-hébergé `public/pets/super-nono-v2.webp`, 1536×1872)
aux **pets de Dowze** (1er de `CURATED_PETS`) et défini comme **`DEFAULT_URL`** → compagnon par défaut de tout
utilisateur qui n'a pas choisi. Migration store (`version:1`) : l'ancien défaut local (Feather) → Super NONO,
sans écraser un vrai choix (le compte prime à l'hydratation). Vérifié : compte neuf → Super NONO.

## [Non versionné] — 2026-07-23 · Compagnon : bibliothèque « Nos pets » (50 max) + aperçu des animations

### 🐾 Une vraie collection de pets, gérable, + aperçu
- **Bibliothèque par compte** : plusieurs pets importés (jusqu'à **50**), sauvegardés au compte. Table
  `companion_pets` passée de « 1 pet par profil » (PK `profile_id`) à **id propre + nom** (migration `0051`).
  Nouvelles routes : `GET /companion/pets` (liste), `PATCH /companion/pet/:id` (renommer),
  `DELETE /companion/pet/:id` (supprimer) ; `GET /companion/pet/:id` sert désormais par id de pet.
  Le nom est repris de `pet.json` (`displayName`) du .zip, sinon du nom de fichier. Limite 50 vérifiée à l'import.
- **Profil → « Nos pets »** (`companion-picker.tsx`) : grille des pets importés — cliquer pour choisir,
  **✎ renommer** (inline), **🗑 supprimer**, compteur `n/50`. Placée entre les pets de Dowze et l'import.
- **Aperçu des animations** : entre la taille et le choix, un panneau montre les **9 animations** du pet choisi
  (grille cliquable à gauche) et les rejoue **en grand, taille réelle, à droite** (`ANIM_LABELS`).
- Front : `listCompanionPets` / `renameCompanionPet` / `deleteCompanionPet` + helper `del()` dans `api.ts`.

## [Non versionné] — 2026-07-23 · Compagnon : installer un pet par .zip, l'app fait tout

### 🐾 « L'app se charge du reste »
Une seule façon, simple et robuste : sur une galerie (petdex.dev, codex-pets.net, codex-pet.com, codexpet.top),
**télécharge le .zip du pet et dépose-le dans l'app** → l'API extrait `spritesheet.webp`, le valide, le stocke,
et l'utilise. (Une planche `.webp/.png` seule marche aussi.) Route API `POST /companion/pet` (le navigateur ne
peut pas écrire dans le storage — bug ES256) ; planche **stockée et servie par l'API** (`GET /companion/pet/:profileId`,
table `companion_pets(profile_id, mime, bytes bytea)`, migration `0050`) → contourne le bug d'upload storage. Front :
`installCompanionPet(FormData)` + `companionPetUrl()` (`api.ts`) ; picker (`companion-picker.tsx`) = import fichier/.zip ·
pets curés · taille · Aucun · 4 liens « où trouver des pets ».

> Note : une première version acceptait aussi « coller une commande/lien » (`npx codex-pet-cli add …`, etc.) avec
> téléchargement serveur ; retiré à la demande — **import .zip uniquement**, donc **plus aucun fetch serveur**
> (surface SSRF nulle par construction).

### 🔒 Sécurité
- **Aucun fetch serveur** : l'API ne télécharge rien depuis une entrée utilisateur → pas de SSRF possible.
- **Zip** : parseur via `zlib` natif (zéro dép), lit la seule planche, `inflateRawSync({maxOutputLength})` = anti zip-bomb ;
  fichier ≤ 12 Mo, planche extraite ≤ 6 Mo.
- **Validation image par octets magiques** (RIFF/WEBP, PNG) — jamais l'extension. Service public renvoie
  `X-Content-Type-Options: nosniff` + `Content-Security-Policy: default-src 'none'` (jamais interprété en HTML/JS).
- Route d'install **authentifiée** + **rate-limitée** (12/min).
- **Fix affichage (cross-origin)** : la route `GET /companion/pet/:id` renvoie `Cross-Origin-Resource-Policy: cross-origin`.
  Sans ça, le CORP `same-origin` global (Helmet) faisait bloquer l'image par le navigateur (`ERR_FAILED`) puisque l'app
  (`academie.dowze.ch`) affiche une image servie par `api.dowze.ch` → compagnon vide (« Pet installé » mais pet invisible).
  NB : la 1re réponse en cache (`immutable`) peut rester bloquée → un ré-import (nouveau `?v=`) ou un hard-refresh régénère l'URL.

### 🖱️ Import : bouton fichier natif + glisser-déposer + auto-update PWA
Le champ d'import est l'**input fichier natif visible** du navigateur (le vrai bouton « Choisir un fichier »,
cliqué en direct = ouverture garantie du sélecteur, zéro indirection) + une **zone de glisser-déposer**.
Ajout de `components/sw-updater.tsx` (monté dans `app/layout.tsx`) : la PWA **se met à jour et recharge l'onglet**
quand un nouveau service worker prend le contrôle → les déploiements arrivent enfin dans les onglets ouverts
(le cache du SW faisait qu'un correctif ne parvenait pas à l'utilisateur tant qu'il ne relançait pas le navigateur).

## [Non versionné] — 2026-07-23 · Compagnon : pet perso par compte (import libre, n'importe quel site)

### 🐾 Choisir son pet comme on change une photo de profil / un skin
Le choix du compagnon devient **personnel à chaque compte** (perso, visible que par soi, synchronisé
entre appareils) et **libre depuis n'importe quel site** de pets Codex (codex-pet.com, petdex.dev, …).

- **Par compte** : colonne `profiles.companion jsonb` (migration `0049_companion.sql`) = `{ url, size, hidden }`,
  exposée par `GET /accounts/me`, écrite par `PATCH /accounts/me/profile`. Front : hydratation au chargement
  puis **sauvegarde débouncée** (`lib/companion-sync.ts`, montée dans le `CompanionProvider`). localStorage
  reste un cache instantané / hors-ligne.
- **Le pet = une URL de planche** (`lib/companion-pet.ts`) : curé (`/pets/…`), importé, ou n'importe quel site.
  Le rendu **auto-détecte la grille** depuis les dimensions natives de l'image (`codex-pet.tsx`) → marche pour
  1536×1872, 1536×2288, etc., quelle que soit la galerie.
- **Profil → « Mon compagnon »** (`companion-picker.tsx`) : pets curés · **Importer un pet** (upload d'une
  planche `.webp/.png` dans le bucket `avatars`, comme la photo de profil) · **Coller une URL** (URL directe
  ou nom de pet codex-pet.com) · **taille** (barre) · **Aucun** (désactiver). Chacun fait le sien, librement.
- **« Où trouver des pets »** : liens directs vers les galeries (codex-pet.com, petdex.dev, codexpet.top,
  codex-pets.net) sous le choix (`PET_SITES` dans `lib/companion-pet.ts`). codex-pet.com marqué **« direct »**
  (son CDN autorise le hotlink → coller le nom suffit) ; les autres se **téléchargent puis s'importent**.

**Vérifié en prod** (test connecté, compte jetable supprimé ensuite) : choix par compte hydraté/sauvegardé
(colonne `companion` en base = `{url,size,hidden}`), pet joué depuis n'importe quelle URL de planche, liens OK.
**Deux limites constatées** : (1) **petdex.dev bloque le hotlink** (403 cross-origin) → passer par l'import ;
(2) **l'upload storage échoue** (`new row violates row-level security policy`) — bug d'infra **préexistant**
touchant aussi la photo de profil : le token user est **ES256** (nouvelles clés de signature) mais storage-api
le valide en **HS256** (secret JWT legacy) → il voit `anon` et la RLS bloque. À corriger côté stack Supabase
(pointer la validation JWT de storage-api sur la clé/JWKS ES256).

### 🔎 Recherche — écosystème « pets Codex »
Galeries (sources d'assets) : **codex-pet.com** (1536×1872, utilisée), **petdex.dev** (multi-agents, la plus
grosse), **codexpet.top / codex-pets.net**. Apps de bureau : clawd-on-desk, agentpet, openpets.sh, oc-claw.
Le format 192×208 est le standard de fait → un même lecteur joue les planches de plusieurs galeries.

## [Non versionné] — 2026-07-22 · Compagnon : apparences « pets Codex » (personnalisation)

### 🐾 Choisir n'importe quel pet de codex-pet.com comme compagnon
Le compagnon peut désormais prendre l'apparence d'un **pet façon Codex** (codex-pet.com), rejoué à
l'identique. Schéma d'animation repris exactement du site : planche **1536×1872**, frames **192×208**,
grille 8×9, **9 animations** (idle/running-right/running-left/waving/jumping/failed/waiting/running/review),
une par ligne, jouées en CSS `steps()`.

- **Rendu** (`components/companion/codex-pet.tsx`) : lecture de la sprite sheet par ligne, `prefers-reduced-motion`
  → frame fixe. **Mapping état→animation** (`lib/companion-pet.ts`) : repos→idle, réfléchit/lit→**review**,
  travaille→running, content→**jumping**, question→**waving**, erreur→**failed**, hors-ligne→**waiting**.
- **Profil → « Mon compagnon »** (`companion-picker.tsx`) : Dowze par défaut · pets **curés auto-hébergés**
  (téléchargés dans `public/pets/`) · **mode libre** (n'importe quel pet, par son nom, servi depuis le CDN
  codex-pet). Choix persisté (zustand/localStorage `dowze-companion-pet`).
- Premier pet curé auto-hébergé : **aiso-feather** (`public/pets/aiso-feather.webp`, 1536×1872).
- **Note licence** : la galerie est communautaire/ouverte ; pour un produit enfants on garde des pets
  **originaux** (sans IP) côté curé, le mode libre reste à la main de l'utilisateur.
- **Vérifié en prod** : le pet s'affiche et joue l'idle (planche auto-hébergée servie en 200), état→animation
  câblé, drag conservé.
- **Réglages ajoutés** (profil) : **curseur de taille** (60–260 px, `size` dans le store, appliqué en direct au
  compagnon) + option **« Aucun »** pour désactiver le compagnon (`hidden`). Le blob « Dowze » est retiré du
  choix ; défaut = **Feather**. 7 pets curés auto-hébergés : aiso-feather, aka-shiba, aqua-wisp, bipy, boba-2,
  bolt, cloudy.

## [Non versionné] — 2026-07-22 · Le **Compagnon Dowze** (C0/C1) — pet global, déplaçable, réactif

### 🫧 Un petit compagnon qui incarne l'IA de Dowze (présent partout, déplaçable, rassurant)
Après 3 recherches sourcées (cf. `docs/13-COMPAGNON`), implémentation du compagnon : un personnage SVG au
**premier plan sur toutes les pages**, **déplaçable à la souris** (position mémorisée), qui montre en mots
simples et non-punitifs ce que fait l'IA — sans intrusion (modèle « Pet » de Codex, pas Clippy/Duo).

- **Personnage SVG stylisé** (blob bleu, yeux qui clignent, étincelle Dowze, Lucide-style, **pas d'emoji**),
  animations CSS `transform`/`opacity` coupées par `prefers-reduced-motion`.
- **Global & premier plan** : monté dans `app/layout.tsx` (overlay `z-[9999]`, `pointer-events` seulement sur
  le personnage/la bulle) → présent sur **toutes** les pages (publiques comprises).
- **Déplaçable** : drag Pointer Events (souris + tactile, écouteurs `window`), position **persistée**
  (localStorage), clampée au viewport. Clic (sans déplacement) = ouvre/ferme la bulle.
- **Machine à états pilotée par les vrais appels IA** (`lib/companion-bus.ts`, TS pur) : `aiTask()` enveloppe
  les fonctions de `lib/api.ts` (compose/ingest, `generateExercises`, `generatePlanning`, `generateDossier`,
  langues…) → `reading`/`preparing`/`organizing` (debounce 400 ms anti-clignotement) → `done` → repos ;
  `error`/`offline` non-punitifs (**« Oups, un souci de mon côté »** ≠ « on réessaie ensemble »). Concurrence
  gérée (compteur d'actifs). Micro-copie FR ≤ 6 mots, variantes tournantes.
- **Bulle façon BD** (pointe vers le personnage, coin, dismissible ✕) + **question socratique** plafonnée
  (mécanisme prêt, câblage proactif = C2).
- **Accessibilité** : dessin `aria-hidden` ; sens via `role="status" aria-live="polite"` (transitions) et
  `role="alert"` pour les vraies erreurs.
- **Vérifié en prod** : présent sur l'accueil ; drag (1224,867)→(271,222) + persistance au reload ; sur un
  vrai ingest LLM (BYOK) → séquence **« Je lis ce que tu as fait… » (0,4 s) → « C'est prêt ! » (2,4 s) →
  repos** ; chemin d'erreur → « Oups, un petit souci de mon côté. ». **Doc `docs/13-COMPAGNON`** (conception +
  plan C0→C4).

## [Non versionné] — 2026-07-22 · « Mes apps » : lanceur déplacé en barre latérale + page dédiée

### 🧭 Le lanceur d'apps quitte la top bar pour la barre latérale (page `/apps`)
- L'`AppLauncher` (popover) est **retiré de la barre supérieure** de l'académie (`app-shell.tsx`).
- Nouveau lien **« Mes apps »** (icône grille) dans la barre latérale, **juste sous « Mon Copilote »**
  (`NAV_SECONDARY`), menant à une **page dédiée `/apps`** au lieu d'un menu déroulant.
- **Page `/apps`** : grille de cartes de l'écosystème — Académie (« Tu es ici »), Fitness, Sports,
  Alimentation — chacune sa couleur et son **icône Lucide** (nouvelles : `IconGrid`, `IconGraduation`,
  `IconDumbbell`, `IconUtensils` ; **aucun emoji**), ouvrant l'app correspondante (session partagée).
- Les apps satellites gardent leur lanceur en top bar (inchangées).

## [Non versionné] — 2026-07-22 · AppLauncher intégré dans l'académie (+ fix Tailwind `@source`)

### 🧭 Navigation d'écosystème depuis l'académie
- **`apps/web`** consomme désormais `@dowze/ui` : l'`AppLauncher` (grille « Mes apps Dowze ») est placé dans
  la barre supérieure (desktop + mobile) de `app-shell.tsx`. Liste : Académie (courante) + Fitness + Sports +
  Alimentation, avec pastille de couleur ; sert de navigation **et** de découverte (session partagée
  `.dowze.ch`, aucun re-login).
- **Fix Tailwind v4** : les classes utilitaires de `@dowze/ui` (hors du répertoire de chaque app) n'étaient
  pas scannées → l'AppLauncher s'affichait **non-stylé (popover 0×0)** dans TOUTES les apps. Ajout de
  `@source '../../../../packages/ui/src';` dans le `globals.css` des 4 apps (web, fitness, sports,
  alimentations). Vérifié : popover 256×195, les 4 apps redéployées.

## [Non versionné] — 2026-07-22 · Plugins **P5** : Sports & Alimentation EN LIGNE — écosystème complet

### 🏊🥗 Les 3 verticales orchestrées dans UN seul planning (P0→P5 terminés)
`sports.dowze.ch` et `alimentations.dowze.ch` déployés, complétant l'écosystème. Réplication du patron
Fitness. Migration `0048`.

- **Hook partagé** `useDowzeProfile` (`@dowze/auth`) : résout `profileId`/`displayName` depuis la session
  partagée — factorisé pour toutes les apps satellites.
- **`apps/sports`** (Next.js, accent **sky**) : discipline + **entraînement récurrent** (`sports.training`)
  dans le planning + **matchs à date fixe** (`sports.event` via `POST /v1/calendar/entries` = **contrainte
  dure**, conflit → 409) + compose/ingest. Schéma `sports_sessions` + RLS.
- **`apps/alimentations`** (Next.js, accent **amber**) : **meal-prep récurrent** (`alimentation.prep`) +
  **idées de menus** (compose) + journal (ingest). **Garde-fous produit stricts** : régularité/planification
  uniquement, **jamais de comptage calorique ni de conseil médical** (pas de scope `health:write`, bannière
  visible, instructions IA explicites). Schéma `alimentation_entries` + RLS.
- **Registre** (migration 0048) : sports + alimentations seedés `active` ; fonction RLS `owns_profile()`.
  Manifestes `dowze-plugin.yml`.
- **Infra répliquée** : Dockerfiles + services compose (`edge`) ; cert réémis à **6 SAN** (academie, api,
  supabase, fitness, sports, alimentations) ; 2 A records (API Infomaniak) ; 2 routeurs Traefik ; **2 SNI
  ajoutés au reverse-proxy nginx du VPS** (→ 10.0.0.4).
- **Vérifié en prod** : `https://sports.dowze.ch` et `https://alimentations.dowze.ch` = **200** ; **les 3
  verticales dans un seul planning** — fitness (emerald ×3, avant l'étude), sports (sky ×2, après-midi),
  alimentation (amber ×1), placées par l'orchestrateur. Typecheck + builds verts.

**Plateforme de plugins : P0→P5 tous livrés & vérifiés en prod.** Dowze est une super-app de style de vie —
académie + 3 apps satellites, une identité, un planning orchestré par l'IA.

## [Non versionné] — 2026-07-22 · Plugins **P4** : AppLauncher + Fitness EN LIGNE (`fitness.dowze.ch`)

### 🏋️ La première verticale satellite est en ligne — session partagée, séances dans le planning
Phase visible : `fitness.dowze.ch` déployé, prouvant la plateforme de bout en bout (SSO + planning + IA).

- **`packages/ui`** : `AppLauncher` (grille des apps de l'écosystème, icônes Lucide inline) — commun academie/fitness.
- **`apps/fitness`** (Next.js) : **session partagée** via `@dowze/auth` (cookie `.dowze.ch` → **aucun re-login**),
  SDK `@dowze/api-client`, écrans **Ma forme** (régularité **non-punitive**, prochaine séance → planning,
  boutons composer/j'ai-fait-ma-séance), **Réglages** (objectif hebdo, **consentement santé Art. 9 séparé et
  révocable**), porte d'activation. Accent emerald, épuré, Lucide only.
- **Schéma `fitness`** (migration `0047`) : `fitness_sessions` + **RLS** (chacun ne voit que ses séances ;
  « database-per-service » — le plugin possède sa donnée, accédée via le client Supabase sous session partagée).
  RGPD : pas de donnée médicale stockée ; consentement santé géré à l'activation (config plugin), révocable.
- **Manifeste** `apps/fitness/dowze-plugin.yml` (reflété par le registre, seedé en 0045).
- **Intégration planning (P2)** : l'app déclare `fitness.workout` via `POST /v1/calendar/recurring` → les
  séances apparaissent dans le planning académie, placées par l'orchestrateur.
- **IA (P3)** : compose (prompt de séance à donner à SON IA) + ingest (résumé → snapshot) via `/v1/ai`.
- **Infra** : `Dockerfile` + service compose `fitness` (image `dowze/fitness:local`, réseau `edge`) ; cert TLS
  (fitness ajouté au SAN du cert dowze via acme.sh) ; **DNS** A record `fitness.dowze.ch → 51.178.51.40`
  (API Infomaniak) ; routeur Traefik (file provider) ; et surtout ajout du **SNI `fitness.dowze.ch` → prod
  (10.0.0.4:443) dans le reverse-proxy nginx du VPS** — l'IP publique est portée par le VPS, qui route par
  SNI ; academie/api/supabase y étaient déjà, fitness manquait (d'où « marche en local prod, pas en public »).
- **Vérifié** : `https://fitness.dowze.ch` répond **200**, cert valide (SAN fitness). Session partagée,
  activation + consentement, workout dans le planning, compose/ingest opérationnels. Typecheck + build verts.

## [Non versionné] — 2026-07-22 · Plugins **P3** : IA/RAG scopée (compose/ingest) — implémenté

### 🤖 Un plugin utilise l'IA de Dowze sans la réimplémenter (compose/ingest scopé)
Phase P3 implémentée : un contrat **IA scopé `ai:infer`** qui **proxifie** vers le Copilote existant.
Fidèle à la philosophie — l'IA de Dowze **orchestre** (donne le prompt, la structure), le prof/coach reste
l'IA de l'élève (ChatGPT/Claude). Schémas `2.46.0`.

- **Contrat** (`@dowze/schemas/plugin-ai`) : `ComposePluginBody` (contexte plugin → prompt), `IngestPluginBody`
  (résumé + **spec de champs sérialisable** — le plugin décrit ce qu'il veut extraire, il possède
  l'interprétation de son snapshot).
- **API `/v1/ai`** (scope `ai:infer` via `PluginScopeGuard`) :
  - `POST /v1/ai/compose` — **déterministe, sans coût** : assemble un prompt lisible depuis le contexte du
    plugin (titre, objectif, niveau, contexte) + un `closingPrompt` pour le résumé de fin (→ ingest).
  - `POST /v1/ai/ingest` — construit un schéma Zod à la volée depuis les champs et **proxifie vers
    `CopiloteService.generateStructured`** : crédits/BYOK réutilisés, filet `jsonrepair→Zod` hérité. Dowze
    ne fait qu'extraire (aucun conseil), le plugin met à jour sa progression.
- **Doc OpenAPI** mis à jour (`/v1/ai/compose`, `/v1/ai/ingest`).
- **Vérifié en prod** (BYOK DeepSeek) : compose **403** sans `ai:infer` / **201** avec (prompt + closingPrompt
  assemblés) ; ingest d'un résumé de séance (« 4×8 développé couché 50kg, tractions, épaules ont tiré,
  ~55 min ») → snapshot `{exercices:["développé couché","tractions"], dureeMin:55, ressenti:"plutôt
  satisfait", douleur:true}`, `creditsSpent:0` (BYOK). Typecheck + tests schémas verts.

## [Non versionné] — 2026-07-22 · Plugins **P2** : contribution au planning (implémenté)

### 🗓️ Une activité de plugin (« sport 3×/sem ») s'inscrit dans le planning, orchestrée avec l'étude
Phase **centrale** implémentée : un plugin déclare une **activité récurrente** ; le moteur déterministe de
Dowze l'**orchestre** avec l'étude (contraintes dures → priorités → préférences souples). Schémas `2.45.0`,
migration `0046`.

- **Contrat** (`@dowze/schemas/calendar`) : `RecurringActivity` (fréquence, durée, intensité, contraintes
  dures/souples, priorité, missPolicy) et `CalendarEntry` (projection ponctuelle). Nouveau type de bloc
  `plugin` portant couleur/icône/deep-link.
- **Orchestrateur multi-source** (`@dowze/core weeklySchedule`) : résolution en **couches priorité/position**
  — l'étude reste le socle (langue+révisions **jamais évincées**), activités récurrentes **espacées** (jours
  alternés, récupération/cap OMS/jours de repos), **séance modérée placée AVANT l'étude** (boost cognitif),
  **intense en fin de journée** (jamais avant un bloc exigeant), **non-punitif** (best-effort). **Sortie
  identique à l'existant sans activité** (non-régression). +10 tests (15 au total).
- **Migration `0046`** : `recurring_commitments` (déclarations, « source ») + `calendar_entries`
  (projection ponctuelle, unique par `source_app`+`source_ref`).
- **API `/v1/calendar`** (scope `calendar:write`, identité plugin via `sourceApp`/`x-dowze-plugin`) :
  `POST /recurring` (+ upsert, invariants), `DELETE /recurring/:profileId/:sourceApp/:sourceRef`,
  `POST /entries` (**conflit → 409**, émet `calendar.entry.created`), `GET …`. `schedule.view` fusionne les
  récurrents des plugins **activés** (révocable).
- **UI calendrier** : blocs `plugin` stylés (palette safelistée d'après le manifeste : Fitness = emerald +
  icône `activity`) ; fiche popup avec bouton **« Ouvrir dans Fitness »** (deep-link vers le sous-domaine).
- **Vérifié en prod** : « sport 3×/sem » modéré → placé **lun/mer/ven, 1er bloc avant l'étude**,
  langue+révisions préservées, rendu emerald + popup deep-link ; scope **403** avant activation / **201**
  après ; entrée ponctuelle **201** + chevauchement **409**. Typecheck + tests (core 82, schémas 7) verts.
- **Note** : les entrées ponctuelles datées (matchs) sont stockées + événement émis, mais leur rendu
  date-aware dans le calendrier (aujourd'hui récurrent hebdo) viendra avec Sports (P5).

## [Non versionné] — 2026-07-22 · Plugins **P1** : registre & modèle de scopes (implémenté)

### 🧩 Le cœur sait déclarer, activer et autoriser des plugins
Deuxième phase **implémentée** : le registre de plugins, l'activation par utilisateur avec octroi de
**scopes révocables** (moindre privilège), et le middleware qui gouverne l'accès. Schémas `2.44.0`,
migration `0045`.

- **Contrat partagé** (`@dowze/schemas/plugins`) : `CORE_VERSION`, scopes canoniques (`profile:read`,
  `calendar:read`, `calendar:write`, `ai:infer`, `health:write`, `xp:write`) + libellés de consentement,
  `pluginManifestSchema` (dowze-plugin.yml : scopes requis/optionnels, `contributes`, `configSchema`),
  projections registre/activation, `satisfiesMinCore` (compat semver `min_core_version`).
- **Migration `0045`** : `plugin_registry` (slug, subdomain, status, versions, scopes, contributes,
  config_schema, `client_secret_hash`) + `user_plugin_activation` (profil × plugin, `granted_scopes`,
  config, unique). **Plugin fictif Fitness** seedé (`status=active`) → catalogue de démonstration.
- **Module API `plugins` versionné `/v1/`** (préfixe introduit, politique de dépréciation **N/N-1**) :
  `GET /v1/plugins` (catalogue), `GET /v1/plugins/mine/:profileId` (catalogue + état d'activation),
  `POST /v1/plugins/:id/activate` (compat `min_core_version`, scopes ⊆ requis∪optionnels, tous les requis
  accordés, **config validée contre `configSchema`**), `POST /v1/plugins/:id/deactivate` (révocation).
- **Middleware de scopes** : `PluginScopeGuard` + `@RequirePluginScope('…')` — une route ne passe que si
  l'utilisateur a **accordé** le scope à ce plugin (403 sinon). Prouvé par `GET
  /v1/plugins/:id/scope-check/:profileId`.
- **Bus d'événements** : réutilise le Redis pub/sub existant (`RealtimeService`) pour diffuser
  `plugin.activated` / `plugin.deactivated` aux flux de l'utilisateur.
- **Doc OpenAPI** : `docs/12-PLUGINS/openapi-v1.yaml` (source de génération du SDK `@dowze/api-client` en P3).
- **Vérifié en prod** (via l'API `api.dowze.ch`, compte de test jetable) : catalogue OK ; scope-check
  **avant** activation → **403** ; activation → **201** (scopes + config) ; scope-check **après** → **200** ;
  scope requis manquant → **400** ; config hors-enum → **400** ; après révocation → **403**. Typecheck +
  tests schémas verts.
- **Note** : identité d'app serveur-à-serveur (**Client Credentials**, `client_secret_hash`) scaffoldée ;
  enforcement complet avec le premier backend plugin (P4).

## [Non versionné] — 2026-07-22 · Plugins **P0** : fondations monorepo & SSO `.dowze.ch` (implémenté)

### 🔐 Session partagée entre apps (`.dowze.ch`) — le socle multi-apps est en ligne
Première phase **implémentée** de la plateforme de plugins : les fondations partagées du monorepo et le
**SSO par cookie de domaine parent**. Academie tourne désormais sur ces packages ; une future app
`fitness.dowze.ch` héritera de la session sans re-login.

- **4 nouveaux packages partagés** (`packages/`) :
  - **`@dowze/auth`** — client Supabase préconfiguré dont la **session vit dans un cookie sur `.dowze.ch`**
    (au lieu du `localStorage` cloisonné par origine). Stockage cookie **fragmenté** (`dowze-auth.0/.1/…`,
    contourne la limite ~4 Ko), `Domain=.dowze.ch` en prod / cookie d'hôte en local, `Secure`+`SameSite=Lax`,
    clé de stockage commune `dowze-auth`. Hook `useSupabaseSession`, **`globalLogout`** (révoque le refresh
    token, scope global, + purge le cookie).
  - **`@dowze/config`** — base TypeScript stricte partagée (`tsconfig/base.json`) pour les futures apps.
  - **`@dowze/ui`** — design system partagé (skeleton : `cn` ; primitives + `AppLauncher` viendront en P4).
  - **`@dowze/api-client`** — SDK typé du cœur (skeleton : `DowzeClient` + `request()` scopé ; méthodes
    `/v1/` générées depuis l'OpenAPI en P1/P3).
- **Academie basculée sur `@dowze/auth`** : `apps/web/src/lib/supabase.ts` réexporte le client partagé
  (transparent pour tous les appelants) ; déconnexion via `globalLogout`. Ajouté à `transpilePackages`.
- **Vérifié en prod** (academie) : après connexion, cookie `dowze-auth.0` posé sur **`domain=dowze.ch`**
  (envoyé à tous les `*.dowze.ch`), `Secure`, `SameSite=Lax` ; session **persistée au rechargement**
  (round-trip cookie → `getSession` → réhydratation du profil). Typecheck + `next build` verts.
- **Note** : le changement de backend de stockage (localStorage → cookie) impose **une reconnexion unique**
  aux sessions existantes (l'ancien jeton localStorage est orphelin). Durcissement `HttpOnly`/SSR
  (`@supabase/ssr`) prévu ultérieurement.

## [Non versionné] — 2026-07-22 · Conception : plateforme de PLUGINS

### 🧩 Dowze devient une super-app de style de vie (doc + plan, pas encore implémenté)
Après **3 recherches sourcées** (architecture de plugins / identité fédérée & écosystème multi-apps /
habitudes récurrentes & orchestration du planning), conception complète d'une **plateforme de plugins** :
apps satellites first-party (`fitness.dowze.ch`, `sports.dowze.ch`, `alimentations.dowze.ch`) réutilisant le
cœur de Dowze (identité, IA/RAG, profil, **planning**). Modèle : **first-party extensions** (manifest
déclaratif + API `/v1/` versionnée à scopes + contribution « source + projection » au planning + registre +
isolation par schéma Supabase + RGPD Art. 9 pour la santé) ; **SSO** par cookie `.dowze.ch` ; **gateway**
`api.dowze.ch` ; **monorepo** Turborepo + packages partagés (`ui`, `auth`, `api-client`, `config`) ;
**AppLauncher** commun. Contrat d'**activités récurrentes** dans le planning orchestré par l'IA (contraintes
dures/souples OMS + habitudes Lally/Gollwitzer + non-punitif Breines/Chen + régularité alimentaire AHA).
**Doc** : `docs/12-PLUGINS/` (vision, architecture, contrat planning, 3 plugins, plan phasé P0→P5).
Implémentation à venir (P0→P2 = cœur, puis Fitness).

## [3.5.0] — 2026-07-22

### 📅 Planning refait : calendrier épuré (année/mois/semaine/jour) + emploi du temps généré
Refonte complète du Planning après **3 recherches sourcées** (répartition hebdo / profils de disponibilité
& apprenants adultes / UX calendrier). Migration `0044`, schémas `2.43.0`.

- **Calendrier façon Apple/Google** (`/planning`, fait maison en CSS Grid, sans grosse librairie) : 4 vues
  **Année → Mois → Semaine → Jour** (divulgation progressive), navigation ‹ Aujourd'hui ›, grille horaire,
  aujourd'hui surligné, ligne « maintenant », tap-to-drill. Chaque bloc = **couleur pastel + icône Lucide +
  label** (Langue bleu, Révisions ambre, Cours violet, Expédition sarcelle, Passion rose). Jour de repos en
  état vide « Repos », vacances en bannière + jours atténués.
- **Emploi du temps GÉNÉRÉ par le moteur déterministe de Dowze** (`@dowze/core` `weeklySchedule`, sans appel
  LLM : fiable/instantané/gratuit) : langue quotidienne courte protégée le matin + révisions, cours répartis,
  **expéditions espacées** (jours alternés), passion en fin de journée plafonnée ; bloc = clamp(3,5·âge,
  15-50) ; remplissage ≤ 80 % ; **compression** quand le temps manque (passion → expéditions → volume des
  cours → jamais langue+révisions).
- **Vrai contenu dans les créneaux (blocs cliquables)** : `langue`→langue active (« anglais »), `revision`→
  « Révisions (N) » (N = FSRS dues réelles), `cours`→prochaine compétence prescrite (ex. « Explorer couleurs,
  formes et matières »), `passion`→label de l'électif. Chaque bloc mène à sa page (langue/tests/séance/
  expéditions/passion).
- **6 profils de disponibilité** (autonomie encadrée, panneau « Mon rythme ») : **Plein temps · Matinée ·
  Après-midi · Cours du soir · Week-end · Léger** + réglage fin « Avancé » (jours actifs / plage / intensité)
  + **Vacances & pauses** (mode maintenance). Module API `schedule` (`learner_schedule` + `schedule_vacations`).
- Vérifs : typecheck api+web, tests (schemas 7 / core 73 / api 62), vérifié live (Léa : semaine générée,
  bascule « Plein temps » → expéditions intercalées, vue Mois).

## [3.4.0] — 2026-07-22

### 🗣️ Cours de langue « Parler » + 🎨 Cours secondaire « Ma passion » (2 cours, 5 recherches sourcées)
Deux nouveaux cours, conçus après **5 recherches sourcées** (apprendre à parler / séquencer plusieurs
langues / répartition du temps / passions & exploration / classe langue-cible & choix géo) et un audit du
système. Schémas `2.42.0` ; migrations `0041`/`0042`.

- **Cours de langue** (`/langues`, module `languages`, doc `10-APP-WEB/28`) : centré **communication**
  (TBLT). **Modèle Dowze : l'IA de Dowze N'EST PAS le prof** — comme « Ma séance », elle **compose** un
  prompt lisible (consigne TBLT, ~90 % langue cible, feedback « prompt », mode vocal, niveau CECRL,
  mémoire, centres d'intérêt) que l'élève colle dans **SON IA (ChatGPT/Claude)** qui joue le professeur, y
  compris à l'oral ; puis Dowze **ingère** le résumé texte (l'IA interne le structure, **Dowze recalcule le
  niveau**). **Une langue active à la fois**, l'IA débloque la suivante **à la proficience** (seuil ≈ A2/B1,
  durci si langue proche), **anciennes langues en maintenance**. **Choix 100 % libre + propositions
  géographiques** (voisins, pays plurilingues, prime salariale) avec « pourquoi » projectif. **Classes
  « langue cible only »** entre pairs du monde entier — écran « Ma Classe » façon **WhatsApp** (liste
  verticale des groupes + chat). Niveau suivi **par langue** (`learner_languages`), `lang-*` = référentiel CECRL.
- **Cours secondaire** (`/passion`, module `electives`, doc `10-APP-WEB/29`) : passion **optionnelle, 100 %
  libre**, poussée jusqu'au pro (**Plan A / Plan B**, taux de base honnête, récompenses informatives, mode
  plaisir/pro séparé). **Mode découverte** (5 disciplines × 1 semaine + **journal quotidien** analysé par
  l'IA en **hypothèses, jamais verdict**). Changement = **verrou DOUX** (engagement affiché non bloquant) +
  **réflexion 1 mois** + **rampe de sortie** sans pénalité (verrou dur de 6 mois **rejeté par la
  recherche** pour les ados — décision actée avec l'utilisateur). Temps **plafonné ~20 %** (bloc-tampon).
- **Répartition du temps** (`/planning/:id/budget`, `@dowze/core` `dailyBudget`) : grille quotidienne par
  âge (langue protégée le matin, révision bornée, cœur académique 60-70 %, passion plafonnée), affichée sur
  « Aujourd'hui » (`DailyBudgetCard`).
- Vérifs : typecheck api+web, tests (schemas 7 / core 67 / api 62), lint OK. Docs `08-langues` (bannière
  implémenté), `28`, `29`. Zéro emoji (icônes Lucide `IconLanguages`/`IconMic`).

## [3.3.0] — 2026-07-21

### 🧭 Atlas : couche épistémique, rang ISCED explicite, densification, RAG sémantique, voisinage amont
Fermeture des écarts restants de l'audit — l'Atlas devient épistémiquement riche, plus large, et se
génère avec ancrage vérifié.

- **Rang ISCED explicite** (migration 0039) : colonne `skills.rank` (1 Fer → 10 Dowzer Suprême),
  backfillée (miroir SQL de `rankOfSkill`). `rankOfSkill()` lit désormais la colonne (autoritatif) et
  ne retombe sur la regex de description qu'en absence de rang. Fin de la fragilité du regex.
- **Couche épistémique activée** (0039) : demi-vie du savoir par domaine (`half_life_years` : info 5,
  pc 12, svt 10 ans ; formels stables = null) ; statut `emergent` sur les nœuds de front de recherche
  (rang ≥ 8). `compose()` surface le statut (humilité épistémique) et **les sources de référence**
  (ancrage) dans le prompt de séance.
- **Densification** (migration 0040) : +5 disciplines au-delà des 6 académiques — **Arts & création,
  Citoyenneté & société, Corps & mouvement, Langues du monde, Métiers & artisanats** (5 nœuds close
  chacune, rang + seuil + source par domaine, calées Socle commun / CECRL / EPS / CAP). `DISCIPLINES`
  passe de 6 à 11 ; `disciplineOf`/`prefixOfDiscipline` unifiés sur une table de préfixes.
- **Génération vérifiée + ancrée** : `generateNextSkills` exige ≥1 source réelle, un rang ISCED et un
  statut épistémique, puis une **passe de vérification adversariale** (`verifyDrafts`, sceptique,
  température 0) rejette les nœuds douteux et écarte les sources jugées inventées. *Vérifié en prod* :
  nœuds « trous noirs » (rang 6) ancrés sur Schwarzschild 1916 & Hawking-Ellis 1973.
- **Voisinage amont — « je veux apprendre X »** : `POST /skills/toward-goal/:profileId`
  (`growTowardGoal`) fabrique la compétence-cible d'un objectif libre **plus la chaîne de prérequis**
  qui la relie aux acquis de l'élève, close et ingérée. *Vérifié* : « comprendre les trous noirs » →
  chaîne « gravitation newtonienne → trous noirs » greffée sur les fondations.
- **Récupération sémantique — GraphRAG vectoriel** : `compose()` retrouve les notes de carnet **et les
  nœuds du graphe** sémantiquement proches du sujet (embeddings `real[]` + cosinus). Colonnes
  `skills.embedding` / `carnet_entries.embedding` (0039), backfill des nœuds via
  **`POST /skills/embed-graph/:profileId`** (`embedGraphNodes`, par lots de 64). `compose()` injecte les
  compétences voisines *par le sens* (autres branches). *Vérifié en prod* : Jina v3 (1024 dim), 202 nœuds
  embarqués, arts-1 → « Observer et décrire / Dessiner d'après observation ». Best-effort sans clé.
- **Consensus multi-passes** : `generateNextSkills(..., passes)` génère N passes et ne garde que les
  compétences convergentes (Jaccard de titres ≥ 0,5) ; activé (2 passes) sur le front de recherche
  (rang ≥ 8). *Vérifié* : grow sur info-27 → nœuds rang 9 convergents, sources réelles (EU Ethics
  Guidelines 2019, IEEE Responsible AI 2021).
- **Schéma** : `Skill.rank` ajouté (`packages/schemas`).

## [3.2.0] — 2026-07-21

### 🌱 Atlas vivant (génération de nœuds au bord) + dossier branché à la séance
Suite à l'audit Atlas/RAG : on ferme les deux écarts prioritaires — le graphe **grandit** vraiment,
et la séance quotidienne **connaît enfin l'élève**.

- **Génération vivante de nœuds (école générative, runtime)** : nouveau module
  `apps/api/src/skill-generation/`. Quand un élève maîtrise une **feuille-frontière** (compétence
  qu'aucune autre n'a pour prérequis), l'Atlas **s'étend automatiquement** : le Copilote
  (`generateNextSkills`, `generateObject` + schéma Zod strict) génère la ou les compétences
  suivantes (profondeur = frontière + 1, même discipline, niveau situé dans la description), puis
  **`SkillGraphService.ingest()` valide la loi de clôture AVANT d'écrire**. Endpoints
  **`POST /skills/grow/:profileId`** et **`GET /skills/next-or-grow/:profileId`** (prescrit, et fait
  pousser si l'on est au bord → parcours **sans fin**). *Vérifié en prod* : greffe de 2 nœuds
  depth 31 (« au-delà du doctorat ») sur `info-27`, arêtes + clôture valides.
- **Dossier élève → prompt de séance** : `copilote.compose()` injecte désormais l'**objectif de
  fond** et les **centres d'intérêt** du dossier (`learnerProfileLine`) → le tuteur ancre ses
  exemples dans les *funds of knowledge* de l'élève. Corrige l'écart « le dossier pilotait les
  expéditions mais pas la séance ».
- **Doc** : `03-ARCHITECTURE/01-atlas.md`, `09-ecole-generative.md`,
  `10-APP-WEB/23-ia-de-dowze-le-moteur.md` mis à jour (état d'implémentation + feuille de route :
  voisinage amont, ancrage source des nœuds générés, récupération sémantique).

## [3.1.0] — 2026-07-18

### 🔁 La boucle d'apprentissage fermée + école générative + observabilité
Jalon qui transforme le squelette en **produit vivant** : la chaîne apprendre → pratiquer →
observer → maîtrise → étape suivante fonctionne enfin de bout en bout.

- **Boucle d'apprentissage (P0)** : nouvel écran **`/seance`** (compétence prescrite → leçon
  générée via le pont `.json` → pratique auto-évaluée → `POST /progression/observe` → **BKT** →
  la **frontière avance**). Endpoint **`GET /progression/:id/next`** (prochaine compétence).
- **Placement (P0)** : `/demarrer` permet de déclarer des compétences **à toute profondeur**
  (groupées par niveau) — la **clôture** place l'élève haut, il ne refait pas l'acquis.
- **Validation → maîtrise (P0)** : réussir un palier (`selfValidate`/`peerReview`) **marque la
  compétence maîtrisée** (`markMastered`) → fait avancer la frontière. Les deux systèmes ne sont
  plus découplés.
- **École générative (P1)** : **`POST /skills/ingest`** ingère une ossature générée via le pont,
  **revalidée par la loi de clôture** avant persistance (croissance paresseuse du graphe). Câblée
  à la page **Pont** (« Persister au graphe »).
- **Contenu (P1)** : le seed gagne deux fils de démonstration multi-niveaux (numératie, littératie)
  avec grilles — graphe **clos vérifié** par `validateGraph`.
- **Observabilité (P2)** : couche **OpenTelemetry + Sentry optionnelle et sans dépendance
  obligatoire** (chargée dynamiquement, no-op si non configurée), filtre d'exceptions global,
  variables d'env documentées.
- **Tests & CI (P2)** : **test d'intégration Testcontainers** (migrations → seed → diagnostic →
  frontière → validation, hors du run unitaire), **job Playwright e2e** ajouté à la CI, smoke
  e2e mis à jour pour la nouvelle interface.
- **Sécurité** : `npm audit fix` (multer via `@nestjs/platform-express`, esbuild) → **0
  vulnérabilité** rétablie.
- **Vérifié** : build/typecheck/lint/format verts ; **99 tests** unitaires (core 57 · api 35 ·
  schemas 7) ; 14 routes web en 200. *(Base réelle, Testcontainers, Playwright et visio :
  exécutables côté déploiement avec Docker/navigateurs/SDK — non exécutés ici.)*

## [3.0.0] — 2026-06-08

### 🎉 Produit complet — E2E, résilience & finition
Jalon majeur : toutes les couches (base → cœur → API → web → CI) **et** tous les parcours majeurs
(auth, onboarding/diagnostic, expéditions, carnet, progression, planning, validation, communauté/temps réel,
parental, modération) sont en place, testés et en **CI verte**.
- **`@dowze/web`** : **Playwright** (config + smoke e2e : accueil, navigation, pont) — `test:e2e` ;
  pages de **résilience** `error.tsx` (réessayer) et `not-found.tsx` (404).
- **A11y** : `lang="fr"`, rôles/headings, cibles tactiles, états vides/erreurs gracieux sur tous les écrans.
- **Vérifié** : build/typecheck/lint verts ; **99 tests** unitaires (core 57 · api 35 · schemas 7) ;
  `npm audit` 0 vulnérabilité. *(Les e2e Playwright nécessitent les navigateurs `npx playwright install`
  et un serveur lancé ; non exécutés en CI par défaut.)*

### Récapitulatif de l'implémentation (2.18 → 3.0.0)
Monorepo npm workspaces + Turborepo : `packages/schemas` (types Zod) · `packages/core` (logique pure :
clôture R1-R8, BKT, SM-2, planning, pont, frontier, diagnostic, expéditions, minuteur) · `supabase/`
(migrations + RLS + seed) · `apps/api` (NestJS, ~15 modules) · `apps/web` (Next.js 15, ~14 écrans, PWA).
**Reste ouvert** (profondeur produit) : génération de contenu IA branchée aux écrans, visio, tests
d'intégration Testcontainers, observabilité OpenTelemetry/Sentry, contenu pédagogique réel à grande échelle.

## [2.38.0] — 2026-06-08

### Ajouté — Déploiement & durcissement
- **Docker** : `apps/api/Dockerfile` (multi-stage, build filtré `@dowze/api` + prune prod, runtime
  `node:22-alpine`) ; **`docker-compose.yml`** (Postgres + Redis + API + **worker**) ; `.dockerignore`.
- **Vercel** : `apps/web/vercel.json` (install + build filtré `@dowze/web`).
- **Durcissement API** : **helmet** (en-têtes de sécurité) + **rate limiting** (`@nestjs/throttler`,
  100 req/min, garde globale).
- **Guide** : [`docs/11-IMPLEMENTATION/02-deploiement.md`](docs/11-IMPLEMENTATION/02-deploiement.md)
  (Supabase EU, checklist de prod).
- **Vérifié** : build/typecheck/lint verts ; **99 tests** ; `npm audit` 0 vulnérabilité.

## [2.37.0] — 2026-06-08

### Ajouté — Jobs & observabilité
- **`@dowze/api`** : **Redis cache-aside** (`CacheService` + clés **versionnées** pures testées),
  **BullMQ** (`JobsService` : files `parental-digest` et `peer-notify`, **jobId idempotent**, backoff
  exponentiel, `removeOnComplete`) avec un **process worker séparé** (`worker.ts` → `npm run worker`,
  graceful shutdown), **pino** (logs structurés + redaction) utilisé au démarrage. Connexion Redis par
  options (compat BullMQ). Helpers purs testés (api : 35 tests).
- **Vérifié** : build/typecheck/lint verts ; **99 tests** ; `npm audit` 0 vulnérabilité. *(L'exécution des
  jobs nécessite Redis.)*

## [2.36.0] — 2026-06-08

### Ajouté — PWA & hors-ligne (Serwist)
- **`@dowze/web`** : **Serwist** (service worker `src/app/sw.ts`, généré au build vers `public/sw.js`),
  **manifest** (`app/manifest.ts` → `/manifest.webmanifest`), méta `appleWebApp`. App **installable** et
  **utilisable hors-ligne** (réviser sans connexion) ; les appels IA (pont `.json`) restent réseau.
- SW désactivé en dev, actif en build de prod. `public/sw.js` ignoré par git (généré).
- **Vérifié** : `next build` (génère le SW) + typecheck + lint verts ; **94 tests** ; 0 vulnérabilité.

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
