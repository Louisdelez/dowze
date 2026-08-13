# Matrice exhaustive de la vision Ruche

Source auditée : export ChatGPT du 2026-08-09, 16 tours. Une exigence n'est `FAIT` que si une preuve
précise existe. Le fichier exporté contient huit marqueurs littéraux `Afficher plus` : la matrice couvre
tout le texte effectivement récupéré et les spécifications ensuite validées, mais ne prétend pas connaître
les fragments que Chrome n'a pas développés.

Statuts : `FAIT` = utilisable/testé ; `PARTIEL` = fondation réelle, critère incomplet ; `À FAIRE` = absent ;
`EXTERNE` = activation dépendant d'un fournisseur, compte ou matériel.

## Ruche et exécution

| ID | Exigence / critère | Source | État et preuve |
|---|---|---|---|
| RUC-01 | Une Reine reçoit l'objectif et délègue sans exposer la complexité. | U3/U5/U15 | FAIT — primaire + orchestration générale. |
| RUC-02 | Toute abeille peut déléguer ; toute la chaîne reste traçable. | U3/U13/U15 | FAIT local — graphe contractuel, handoff par maillon et provenance récursive. |
| RUC-03 | Logique composable aux niveaux application, agents, modèles et calcul. | U3 | FAIT dans le périmètre contrôlable ; internals modèle/GPU documentés comme EXTERNES et non pilotables. |
| RUC-04 | Hiérarchie limitant la charge cognitive humaine (Dunbar). | U5 | FAIT — organisations, leaders, routage. |
| RUC-05 | Chemin organisationnel valide le plus court. | A14/U15 | FAIT local — BFS sur `delegatesTo`/`escalationPath`, anti-cycle, repli direct. |
| RUC-06 | Hors rôle : reconnaître la limite avant génération et transmettre. | U15/A16 | FAIT — contrat, contrôle et handoff. |
| RUC-07 | Le destinataire reçoit demande, contexte, sources, urgence, permissions et suite. | U15 | FAIT — `hive_handoffs`. |
| RUC-08 | Assistant principal transverse privé/pro et centralisant les retours. | U15 | FAIT local — primaire transverse, mémoire cross-space avec consentement explicite. |
| RUC-09 | Équipe autonome, test interne, remontée des seules décisions. | U15 | FAIT local — projets/SOP/QA et centre `/attention`. |
| RUC-10 | Fonderie : créer, réutiliser, évaluer, fusionner, retirer. | U3/A4/A6 | FAIT — auto-build, EMA, merge/prune/retrain. |

## Modèles, harness et outils

| ID | Exigence / critère | Source | État et preuve |
|---|---|---|---|
| MOD-01 | Aucun modèle unique imposé. | U5 | FAIT — registre multi-provider. |
| MOD-02 | Modèle, harness, outil et compétence sont des ressources distinctes. | U5 | FAIT local — `hive_runtimes`, types, API, SDK et UI `/runtimes`. |
| MOD-03 | Choix du couple modèle+harness par capacité, qualité, entitlement, coût, latence, confidentialité. | U5/A8 | FAIT local — sélection déterministe testée et exécution journalisée. |
| MOD-04 | Adaptateurs texte, code, recherche, embedding, image, voix, musique, chant, 3D. | U5 | PARTIEL/EXTERNE — Copilote, outils, embedding, MCP code et voix locale ; image/audio/3D déclarés mais moteur réel à choisir. |
| MOD-05 | Méta-harness central ouvert, non monolithique, extensible. | U5 | FAIT local — registre persistant et adaptateurs découplés. |
| MOD-06 | Identité d'agent séparée du runtime réutilisable. | U3/U5 | FAIT — agents et runtimes ont identités/cycles distincts. |
| MOD-07 | Abonnements officiels Codex/Claude reliés via MCP, sans vol de session. | U7 | FAIT — relais MCP. |
| MOD-08 | Relais recevant automatiquement contexte et cahier des charges. | U7 | FAIT local — instruction en file + outil MCP `dowze_search_context` transverse. |
| MOD-09 | Ne pas présenter les internals GPU/modèle comme pilotables par Dowze. | U1/U3 | FAIT — distinction d'architecture. |

## Incarnation, espaces et organisations

| ID | Exigence / critère | Source | État et preuve |
|---|---|---|---|
| ESP-01 | Compagnon = abeille incarnée et spécialisée comme un employé. | U5 | FAIT. |
| ESP-02 | Maison privée, pièces et gestion de la vie personnelle. | U5/U7 | FAIT — Maison/pièces/famille. |
| ESP-03 | Entreprises/projets séparés avec équipes et données propres. | U5/U7 | FAIT — open-spaces/templates/RAG scopé. |
| ESP-04 | Espaces rejoignables : Académie, sport, nutrition, médical, psychologie. | U7 | FAIT local — Académie et template bien-être/sport/nutrition/écoute/orientation avec limites cliniques. |
| ESP-05 | Réunion multi-compagnons et brainstorming par spécialité. | U5 | FAIT — rassemblement visuel, prises de parole, QA puis synthèse du leader dans l’open-space. |
| ESP-06 | Objets représentant serveurs, DB, firewall et actifs. | U5 | FAIT local — `hive_assets`, statuts, objets visuels, espaces et lien coffre dans `/infrastructure`. |
| ESP-07 | Coffre visuel chiffrant les secrets. | U5 | FAIT local — AES-256-GCM, API sans ciphertext et `/autorisations`. |
| ESP-08 | Accès temporaire borné par cible/finalité, approbation et révocation. | U5/U11 | FAIT local — finalité/durée, décision, claim hashé, usage unique, expiration/révocation. |
| ESP-09 | UI isométrique ludique/cute/Tamagotchi mais utile. | U5/U7 | FAIT. |
| ESP-10 | Extensible sans limite applicative arbitraire. | U3/U7 | FAIT — limites dures supprimées. |

## Humanité, émotions et canaux

| ID | Exigence / critère | Source | État et preuve |
|---|---|---|---|
| HUM-01 | Personnalité, ton et spécialité stables par compagnon. | U11 | FAIT. |
| HUM-02 | Faim, énergie, hygiène, sommeil et humeur persistants. | U7/U11 | FAIT — care + scheduler. |
| HUM-03 | Jour, heure, météo et contexte influencent l'humeur. | U11 | FAIT local — météo géolocalisée dans le cerveau visuel et humeur temporelle testée côté API. |
| HUM-04 | Relation humain-compagnon influençant la formulation. | U11/A12 | FAIT local — affinité/confiance/familiarité persistées, injectées dans la génération directe et dans le renderer, sans modifier les faits. |
| HUM-05 | Personnalité/émotion ne modifient jamais les faits. | A12 | FAIT — séparation contenu/rendu. |
| CAN-01 | Direct : bulle 1–2 phrases brèves, naturelles, sans Markdown. | U11 | FAIT — limite phrases/caractères et nettoyage testés. |
| CAN-02 | Messages : naturel, un peu plus long, sans Markdown parasite. | U11 | FAIT — téléphone, persistance, nettoyage et limite testés. |
| CAN-03 | Mail : long, salutation/corps/signature, sans Markdown. | U11 | FAIT local — conventions, relation et nettoyage testés ; transport externe séparé. |
| CAN-04 | Push : essentiel, longueur bornée. | A12 | FAIT côté rendu/file ; transport EXTERNE. |
| CAN-05 | Voix : court, prononçable, sans code brut/Markdown/emoji illisible. | U11 | FAIT local si Web Speech disponible — dictée, réponse vocale et renderer prononçable. |
| CAN-06 | Voix avec accent, hésitations/tics et personnalité. | U11 | FAIT — OpenAI/ElevenLabs pour la voix premium, Kokoro local via Desktop, identité vocale configurable et Web Speech limité au repli. |
| CAN-07 | Rendu = contenu × personnalité × émotion × relation × canal. | U11/A12 | FAIT local pour les canaux : faits immuables, personnalité/émotion/relation fournies au renderer et les réponses directes ordinaires créent désormais leur livraison/énoncé structuré. |
| CAN-08 | Changer de canal sans redemander le contexte. | U13/U15 | FAIT données ; E2E UX à prouver. |
| CAN-09 | Livraisons queued/sent/delivered/read/failed/cancelled auditables. | A12 | FAIT. |

## Mémoire-bibliothèque universelle

| ID | Exigence / critère | Source | État et preuve |
|---|---|---|---|
| MEM-01 | La session LLM n'est jamais la mémoire fondamentale. | U13 | FAIT — événements universels. |
| MEM-02 | Archiver humain↔compagnon et agent↔agent. | U13 | FAIT pour tous les canaux compagnon — IA, orchestration, MCP, pont et dialogues PNJ scriptés. |
| MEM-03 | Conserver contenu, acteurs, date, canal, espace et provenance. | U13 | FAIT. |
| MEM-04 | Reconstruire « qui a mandaté qui ». | U13 | FAIT données/API — CTE récursive, arêtes, anti-cycle et vue des sources. |
| MEM-05 | Retrouver par date, mot, acteur, projet, espace, action et indice vague. | U13 | FAIT local — FTS + trigrammes + pgvector + filtres. |
| MEM-06 | Bibliothécaires : brut → épisodes → faits → relations, source intacte. | U13/A14 | FAIT local — tables dédiées, consolidation nocturne, sources et export. |
| MEM-07 | Connaissance ancienne récupérable depuis tout canal. | U13 | FAIT local — outil de chaque abeille, API/UI et MCP externe. |
| MEM-08 | Cloisonnement et consentement entre sphères. | A14 | FAIT — RLS/scopes/cross-space opt-in appliqué jusque dans l’outil de recherche mémoire des abeilles ; sans consentement, seules la mémoire globale et celle de l’espace demandeur sont visibles. |
| MEM-09 | Export, rétention, oubli sélectif et tombstone. | A14 | FAIT. |
| MEM-10 | Embeddings/index pour l'échelle. | U13/A14 | FAIT schéma/API — HNSW, GIN FTS/trigram et enrichissement événementiel progressif. |
| MEM-11 | Brut append-only hors oubli gouverné. | A14 | FAIT architecturalement. |
| MEM-12 | Bibliothèque visible : filtres, provenance et handoffs. | U13 | FAIT local — `/memoire`, recherche approximative et sources récursives. |

## Autonomie et gouvernance

| ID | Exigence / critère | Source | État et preuve |
|---|---|---|---|
| GOV-01 | Actions sensibles soumises à approbation explicite. | U5/U11/U15 | FAIT pour secrets — inbox `/autorisations`, approuver/refuser/révoquer. |
| GOV-02 | Moindre privilège : durée, cible, finalité et révocation. | U5/A12 | FAIT pour secrets — contrôle serveur et remise à usage unique. |
| GOV-03 | Plan → exécution → QA → retry borné → verdict. | A6/A8/U15 | FAIT — projets/SOP/QA. |
| GOV-04 | Erreurs/décisions auditables et remontées au responsable. | U15 | FAIT local — `/attention`, QA, handoffs, actifs et résolutions journalisées. |
| GOV-05 | Aucune intégration externe déclarée active sans credentials et test réel. | audit | FAIT comme règle de livraison. |

## Graphe d'exécution, récursion et budgets

| ID | Exigence / critère | Source | État et preuve |
|---|---|---|---|
| EXE-01 | Chaque objectif possède un run durable et inspectable. | U3/A4 | FAIT — `hive_runs`, API/SDK et `/operations`. |
| EXE-02 | Chaque délégation devient une tâche enfant reliée au handoff. | U3/U15 | FAIT — `hive_tasks.parent_task_id` et `handoff_id`. |
| EXE-03 | Une abeille peut déléguer récursivement pendant son travail. | U3/A4 | FAIT — outil interne `deleguer_dans_la_ruche`, contexte d'exécution et anti-cycle. |
| EXE-04 | La récursion est bornée en profondeur, fan-out, tâches et durée. | A4 | FAIT — garde serveur testée et deadline persistée. |
| EXE-05 | La délégation n'est retenue que si son gain couvre ses coûts. | A4 | FAIT — comparaison gain/communication/calcul/coordination testée. |
| EXE-06 | Le budget de crédits est chargé sur l'usage réel. | A4/A8 | FAIT — `used_credits/max_credits`, échec et alerte au dépassement. |
| EXE-07 | Cycle pending→accepted→running→completed/failed. | U15 | FAIT — transitions persistées avant/après chaque appel. |
| EXE-08 | Le primaire synthétise sans effacer les productions sources. | U15 | FAIT — sorties de tâches conservées et synthèse séparée. |

## Communication structurée et présence

| ID | Exigence / critère | Source | État et preuve |
|---|---|---|---|
| COM-01 | Séparer faits, intention, confiance, émotion, prosodie et animation. | U11/A12 | FAIT — `hive_utterances`, frame pure testée et branchement sur le chat direct ainsi que sur les réponses de l’orchestration. |
| COM-02 | L'animation ne doit pas être la source de vérité de l'activité. | U5/U11 | FAIT — `hive_companion_states` distinct du rendu. |
| COM-03 | Afficher occupation, activité, urgence, humeur et lieu. | U11 | FAIT — état persisté, polling de la Maison, bulle et fiche. |
| COM-04 | La voix peut être interrompue quand l'humain reprend la parole. | U11 | FAIT local — arrêt SpeechSynthesis et abort/stop reconnaissance. |
| COM-05 | Montrer les micro-états d'attente sans faux dialogue. | U11 | FAIT — « réfléchit… » transitoire retiré sur succès/erreur/relais. |

## Temporalité, calcul et packages d'espaces

| ID | Exigence / critère | Source | État et preuve |
|---|---|---|---|
| TMP-01 | Un fait nouveau peut remplacer l'actuel sans effacer l'ancien. | U13/A14 | FAIT — clé stable, intervalle de validité et chaîne `supersedes`. |
| TMP-02 | Les préférences apprises sont versionnées et consultables. | U13 | FAIT — mémorisation temporelle et historique dans `/memoire`. |
| CAP-01 | Les capacités sont des objets normalisés liés aux agents/runtimes. | U3/U5 | FAIT — registre + bindings synchronisés. |
| CMP-01 | Le calcul est une ressource routable par capacité et localité. | U3/A4 | PARTIEL — le registre est administrable, le moteur choisit réellement un nœud sain compatible avec modalité/confidentialité et journalise ce choix ; la réservation physique d’un GPU et le dispatch hors fournisseur restent EXTERNES. |
| CMP-02 | Refuser nœud malade, saturé ou incompatible avec la confidentialité. | A4 | FAIT — filtres testés. |
| PKG-01 | Un espace est un package versionné avec bâtiment, rôles, capacités, workflows et permissions. | U7/A8 | FAIT — manifeste/checksum/catalogue. |
| PKG-02 | Distinguer créer une instance et rejoindre un service partagé. | U7 | FAIT — installation `create/join`, join interdit aux packages privés. |
| PKG-03 | Le manifeste entrant est strictement borné et vérifié. | audit | FAIT — schéma strict, limites et checksum avant installation. |

## Validation et seules activations restantes

- base vierge PostgreSQL 15 + pgvector : migrations `0001` à `0083` validées avec le seed requis par
  `0023` ; 23 tables Ruche, RLS sur chacune, 23 politiques et 70 index ;
- `npm test` : 180 tests réussis (`91` API, `82` core, `7` schemas) ;
- `npm run typecheck` : 14 paquets sur 14 ;
- build applicatif hors empaquetage natif : 9 cibles sur 9 avec Next.js 16.3.0 ; 43 routes web ;
- audit dépendances de production : 0 critique, 0 haute, 2 modérées et 9 faibles ; les restantes viennent
  de l'ancien SDK AI 4 et exigent sa migration majeure ;
- `npm run lint` : tests réussis puis un défaut local découvert/corrigé dans `/operations`; les avertissements
  historiques de taille de fichiers restent non bloquants. La relance finale fait foi dans l'audit 08.

Les lignes `PARTIEL/EXTERNE` ne sont pas du code local oublié : elles exigent un choix de fournisseur et
des accès réels (image/audio/3D, transport push, voix premium). La mise en production exige en plus une
autorisation de déploiement, les variables d'environnement et l'application des migrations. Le relais MCP
exige que l'utilisateur génère son jeton et connecte son abonnement officiel.
