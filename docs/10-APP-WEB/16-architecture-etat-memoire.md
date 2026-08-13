# Architecture : mémoire, état, et « est-ce un RAG ? »

> *Analyse fondée sur l'état de l'art 2024-2026 (mémoire d'agents : Mem0, Letta/MemGPT, Zep/Graphiti,
> Cognee, LangMem ; RAG vs GraphRAG ; architectures agentiques Anthropic & 12-Factor ; tuteurs
> intelligents LLM : LOOM, Responsible-DKT). Question de départ : « ça ressemble à un RAG avec des
> agents, des modèles, des skills, de la mémoire — est-ce qu'on le fait bien ? »*

## Verdict

**Oui, le socle est dans les règles de l'art — ce n'est pas naïf, et ce n'est pas un RAG vectoriel (et
ça ne doit pas en être un).** Les trois décisions structurantes de Dowze sont exactement celles que la
littérature récente recommande, et met en garde de **ne pas** trahir :

1. **Le LLM enseigne ; l'application détient l'état de vérité** (graphe de compétences + BKT) et
   **recalcule elle-même la maîtrise**. C'est le pattern de **LOOM** (Dynamic Learner Memory Graph qui
   empêche le LLM d'être la source de vérité) et de **Responsible-DKT**. Un papier de 2025 démontre qu'un
   LLM seul **n'égale pas** un modèle de suivi explicite : estimations de maîtrise instables, mises à jour
   dans le mauvais sens, insensibilité à l'état réel de l'élève. → garder un modèle d'apprenant explicite.
2. **Le petit LLM (Copilote) est un composant de composition + extraction, jamais le dépositaire de
   l'état.** C'est le pattern « augmented LLM » d'Anthropic (« Building Effective Agents ») et le principe
   *12-Factor Agents* (« l'agent est surtout du logiciel » ; « les outils = sorties structurées » ;
   « l'app détient l'état »). Un seul petit LLM + une machine à états applicative **est** une architecture
   agentique correcte — **pas** une version dégradée.
3. **La maîtrise vit dans un état structuré/transactionnel** (BKT en base), pas dans un vector store.

## Traduction des mots de la question

| « ça ressemble à… » | Ce que c'est réellement chez Dowze |
|---|---|
| un **RAG** | Oui, mais un RAG **sur un état structuré**, pas sur des documents/embeddings : on *récupère* l'état de l'élève (compétence du jour, dernière note, maîtrise) et on l'*injecte* dans le prompt. C'est de la génération augmentée par récupération — sur une base de vérité, pas sur un index vectoriel. |
| des **agents** | Un seul « augmented LLM » (le Copilote) piloté par du code déterministe. Le bon niveau : **pas** de multi-agents (coût ×15 sans bénéfice pour un tuteur mono-élève à état partagé). |
| des **modèles** | Multi-fournisseurs (le Copilote) + le modèle **pédagogique** structuré (BKT, DAG, SM-2/FSRS). |
| des **skills** | Le graphe de compétences (DAG de prérequis) = Knowledge Components + structure de prérequis. |
| de la **mémoire** | `carnet` (mémoire épisodique) + `mastery_states` (mémoire sémantique/état) + à venir : état par compétence enrichi. |

## Pourquoi PAS un RAG vectoriel pour l'état

Le suivi de maîtrise est un **état numérique latent qui doit être mis à jour de façon déterministe**
(BKT). Or un vector store est *append-first* (pas d'update/delete), sans transaction, mauvais sur le
numérique exact, et **incapable de distinguer le même fait à deux instants** (« mon niveau était X, il est
maintenant Y » → les deux coexistent). Mettre le knowledge tracing en RAG vectoriel est un **anti-pattern**.
Les embeddings ont une place — mais **en complément** : retrouver des **confusions/épisodes passés
similaires** dans le carnet, jamais pour stocker l'état.

## Ce qui est déjà bien — à garder tel quel

Graphe de prérequis · BKT comme vérité (pas le LLM) · l'app recalcule la maîtrise · extraction structurée
par petit LLM · architecture mono-LLM. **Ne rien changer là.**

## Améliorations « pour le faire proprement » (priorisées)

| # | Force | Amélioration | Action |
|---|-------|--------------|--------|
| 1 | **FORT** | **SM-2 → FSRS** | Migrer la planification (modèle Difficulté-Stabilité-Rétrievabilité) : −20-30 % de révisions à rétention égale. Gérer le démarrage à froid (< ~1000 révisions → paramètres par défaut). |
| 2 | **FORT** | **Extraction type Mem0 (extract → réconcilier)** | Le Copilote sort des faits en **JSON contraint** (schéma + validation, T=0), puis **réconcilie ADD/UPDATE/DELETE/NOOP** contre l'état existant AVANT recalcul BKT → une contradiction met à jour l'état au lieu d'empiler. |
| 3 | **FORT** | **État par compétence enrichi** | Au-delà du binaire : maîtrise continue, incertitude, dernière observation, et surtout **misconceptions/erreurs récurrentes** typées. |
| 4 | MOYEN | **Embeddings sur le carnet** (complément) | Indexer les traces pour retrouver par similarité les confusions passées et les réinjecter (« tu avais déjà buté ici »). Jamais l'état. |
| 5 | MOYEN | **Retrieval plus intelligent dans la composition** | Remplacer le template plat par une sélection : compétences prêtes (DAG) + items dus (FSRS) + misconceptions actives + 1-2 épisodes similaires. C'est du *context engineering*. |
| 6 | FAIBLE | **Consolidation « sleep-time »** | Job asynchrone entre séances : compacter le carnet, dériver les misconceptions, réordonner les révisions. Utile seulement à l'échelle. |

## À NE PAS faire

Transformer le knowledge tracing en RAG vectoriel · laisser le LLM produire directement les scores de
maîtrise / intervalles (il extrait le **qualitatif**, l'app calcule le **numérique**) · passer en
multi-agents · prendre les scores de benchmark mémoire (LOCOMO) pour des preuves (ils sont disputés).

**Sources détaillées** : `~/Documents/Master/04-recherche/dowze/` (à compléter avec ce volet). Voir aussi
[15-copilote-orchestrateur](15-copilote-orchestrateur.md), [02-cerveau-pedagogique](02-cerveau-pedagogique.md).
