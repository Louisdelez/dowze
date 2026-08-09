# Open-spaces = Entreprises / Écoles — agents-employés spécialisés

> Conception & plan. Chaque **open-space** devient une **organisation** (entreprise, SaaS,
> ou école) peuplée d'**agents-employés** ultra-spécialisés (CEO, CTO, dev, graphiste,
> commercial, secrétaire… ou directeur, enseignants…), qui collaborent comme dans une vraie
> boîte. Les **services Dowze** (Académie…) fonctionnent avec le même moteur : l'Académie est
> une **école** (un type d'organisation), avec plusieurs open-spaces par **niveau**.

## 1. Vision

- **1 open-space = 1 organisation** (un gros projet : une entreprise, un SaaS — pas une simple feature).
- Chaque organisation a une **mission**, un **type** (`company` | `saas` | `school` | `custom`), et un
  **effectif d'agents** aux **rôles/métiers** distincts, chacun ultra-spécialisé dans son domaine.
- Chaque agent = un compagnon (mode `agent`, RAG + outils + ReAct) avec un **rôle** du catalogue.
- Les **services Dowze** réutilisent ce moteur : l'**Académie = école** (Directeur, Enseignants par
  niveau/matière, Assistant, Surveillant…), un open-space **par niveau** pour cloisonner.

## 2. Principe directeur (état de l'art)

Consensus 2024-2025 (ChatDev, MetaGPT, CrewAI, AutoGen, Generative Agents ; taxonomie d'échecs MAST) :
**structure > essaim libre**. On adopte :

- **Catalogue de rôles** (CrewAI/MetaGPT) : chaque métier = `{ rôle, objectif, backstory, systemPrompt,
  outils, produit[], écoute[], peutDéléguerÀ[], skin, modèle }`.
- **Superviseur borné** (LangGraph/CrewAI-hiérarchique) : le **leader** décompose → délègue au bon
  spécialiste via `handoff(rôle, tâche, critère)` → **valide** avant d'accepter. Délégation opt-in,
  fan-out & retries plafonnés.
- **SOP par type d'org** (ChatDev/MetaGPT) : pipeline de phases avec artefacts de sortie = portes.
- **Mémoire 3 niveaux** (Generative Agents + ruche existante) : flux par agent (récence+importance+
  pertinence, pgvector) ; **pool partagé par entreprise** (persisté) ; **réflexion/consolidation
  nocturne** (dedup/fusion/prune déjà en place).
- **RAG scopé par entreprise** (`space`) → pas de contamination inter-projets.
- **Rôle « Vérificateur/QA » obligatoire** (contre l'hallucination qui se propage).
- **Believabilité spatiale** (AI Town) : les déplacements dans l'open-space = de vrais hand-offs.

## 3. Ce qui existe déjà (à réutiliser)

- `companion_agents` : multi-agents/profil, `mode` (pnj/agent/relay), `role` (texte libre),
  `personality.systemPrompt`, `rules[]`, `embedding_vec` (pgvector HNSW 1024-d), lifecycle
  (useCount/qualityEma/status), soft-delete/merge.
- `companion_spaces` `{id, name, profileId}` ≈ **une entreprise** ; `room` = `travail:N` (cap 100) /
  annexes ≈ **départements/bureaux**.
- **Split leader/employé déjà là** : leaders en Maison (`space='home'`), employés-abeilles en open-space.
- **Orchestration** : `orchestrate()` décompose → shortlist (KNN pgvector + trigram) → délègue (≤3) →
  synthétise → note (LLM-as-judge → qualityEma).
- **ReAct + outils** (`agent-tools.ts` : calculatrice, date_heure, chercher_connaissances, recherche_web).
- **Jardinage** : merge/prune/retrain/nocturne.
- **Modèle/billing** : chaque appel accepte un `modelId` override (crédits + BYOK).
- **2 renderers** : Maison DOM/SVG, open-space **PixiJS** (jusqu'à 256²).

## 4. Ce qui manque (à construire)

1. **Type d'open-space** (`companion_spaces.type` + `mission` + `template`).
2. **Catalogue de rôles** (enum + preset systemPrompt/skin/outils/modèle par métier).
3. **Seeding** : peupler un nouvel open-space avec un effectif de rôles à la création.
4. **Orchestration par rôle** (adresser « le CTO », respecter l'organigramme).
5. **RAG par entreprise** (`companion_space_knowledge` scopé par `space`).
6. **Outils/modèle par rôle** (allow-list + tier de modèle).
7. **Orgs de service Dowze** (école Académie, open-space par niveau ; `ownerKind` service vs user).

## 5. Modèle de données (cible)

```
companion_spaces
  + type        text  = 'company' | 'saas' | 'school' | 'custom'   (défaut 'custom')
  + mission     text  (nullable)                                   -- north-star injecté partout
  + template    text  (nullable)  -- clé de template de rôles utilisée pour le seeding
  + ownerKind   text  = 'user' | 'service'   (défaut 'user')       -- service = Dowze (Académie…)

companion_agents
  + roleKey     text  (nullable)  -- clé du catalogue (ex. 'cto', 'dev-back', 'enseignant')
  (role text reste, comme libellé humain lisible)

companion_space_knowledge   (NOUVELLE)
  id uuid pk, space text, title text, content text,
  embedding_vec vector(1024),  born_at, updated_at
  index HNSW cosine sur embedding_vec ; index (space)
```

## 6. Catalogue de rôles (backend)

Module `apps/api/src/companion/roles.catalog.ts` — presets par métier :

```
Role {
  key, title,
  systemPromptSeed,        // persona + objectif + backstory + contraintes
  traits[], skinSlug,      // skin du catalogue de pets curatés (variété visuelle par rôle)
  modelTier,               // 'strong' (CEO/CTO/QA) | 'default' | 'cheap' (secrétaire)
  tools[],                 // sous-ensemble de buildAgentTools
  produces[], subscribes[],// artefacts (pub/sub)
  canDelegateTo[]          // organigramme
}
```

**Entreprise / SaaS** : CEO, CTO, Dev backend, Dev frontend, Graphiste, Commercial,
Secrétaire/Assistant, QA/Vérificateur.
**École (Académie)** : Directeur, Enseignant (× matière/niveau), Assistant pédagogique,
Surveillant/Secrétaire, Évaluateur (QA pédagogique).

Templates = `{ key, label, type, mission par défaut, roles[] }` (ex. `startup-saas`, `agence`,
`ecole-college`, `ecole-lycee`…).

## 7. Orchestration par rôle (cible)

- `ORCH_PLAN_SCHEMA` enrichi : la délégation peut viser un **roleKey** (« adresse le CTO ») en plus
  du match sémantique existant.
- Shortlist scopée à l'open-space **actif** (l'entreprise en cours), pas toute la ruche.
- `handoff(roleKey|beeId, subtask, acceptanceCriteria)` : le leader valide l'artefact avant de
  l'accepter (rôle QA). Fan-out ≤ N, retries ≤ 3 (anti-boucle).
- Outils & modèle **par rôle** : on passe `roleKey → tools/modelId` dans `chatAgent/runWithTools`.

## 8. RAG par entreprise

- Nouvelle table `companion_space_knowledge` + variante `searchSpaceKnowledge(space, query, k)`
  (miroir de `searchKnowledge`, filtrée par `space`, KNN pgvector).
- Outil `chercher_connaissances_entreprise` scopé au space courant, en plus de l'Atlas global.

## 9. Variante École (Académie)

Même moteur, on échange le **catalogue de rôles** + la **SOP**. L'Académie = org `type='school'`,
`ownerKind='service'`, un open-space **par niveau** (`ecole-college-4e`, `ecole-lycee-1re`…).
SOP cours : `objectifs → plan de cours → contenu → exercices → évaluation → feedback`, portée par un
rôle Évaluateur. RAG scopé par classe/niveau.

## 10. Plan d'implémentation (phasé)

- **P1 — Fondations** *(backend + un peu de front)* :
  migration `companion_spaces.type/mission/template/ownerKind` + `companion_agents.roleKey` ;
  `roles.catalog.ts` + templates ; `createSpace(type, template)` **seede l'effectif** ; skin **par rôle**
  (fin du robot forcé) ; endpoints (templates, création typée) ; front : choix du **type d'entreprise**
  à la création d'un open-space, nametags par rôle.
- **P2 — Orchestration par rôle** : `ORCH_PLAN` roleKey ; shortlist scopée au space ; `handoff` + QA ;
  outils/modèle par rôle.
- **P3 — RAG entreprise** : table + `searchSpaceKnowledge` + outil scopé ; ingestion (docs projet).
- **P4 — SOP & artefacts** : templates de process, pool partagé persistant, portes par phase.
- **P5 — École / services Dowze** : catalogue école, open-spaces par niveau, `ownerKind='service'`,
  branchement Académie.
- **P6 — Believabilité** : plans journaliers, hand-offs spatiaux, réflexion nocturne enrichie.

## 11. Garde-fous (MAST)

Mission injectée partout ; délégation bornée & opt-in ; retries/fan-out plafonnés ; **QA obligatoire**
avant d'accepter un artefact ; RAG scopé (anti-contamination) ; « un bon agent unique ou un pipeline
structuré bat souvent l'essaim » → on privilégie la structure.

## Sources

ChatDev, MetaGPT (arxiv 2308.00352), CrewAI (hierarchical process), AutoGen/AG2, Generative Agents
(Stanford, Smallville), OpenAI Swarm/Agents SDK, LangGraph, AI Town (a16z), MAST (arxiv 2503.13657).
