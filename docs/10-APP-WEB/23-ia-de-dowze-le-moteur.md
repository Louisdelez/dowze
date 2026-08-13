# L'IA de Dowze : le moteur (le « RAG Dowze »)

> *Le récit central, à faire passer partout. Dowze fonctionne désormais avec **deux IA** aux rôles
> distincts : l'**IA de tutorat** (externe, l'abonnement de l'élève — elle parle) et l'**IA de Dowze**
> (interne, « le Copilote » — elle **fait tourner l'école**). Cette seconde est devenue **indispensable** :
> sans elle, pas de dossier élève, pas de placement, pas de bilan de séance, pas d'exercices, pas de tests,
> pas d'expéditions. C'est un **système tutoriel intelligent (ITS) moderne**, pas un chatbot.*

---

## 1. Ce que c'est, exactement (le nom juste)

L'IA de Dowze est **un système tutoriel intelligent (ITS) moderne, *AI-native*, construit comme un
*compound AI system*** :

- **un orchestrateur déterministe** (la machine à états de Dowze) qui **pilote**
- **un LLM interchangeable** (OpenAI / Google / Mistral / DeepSeek / Anthropic) comme simple **composant
  contraint**, autour
- **d'un modèle d'élève explicite** : graphe de compétences + BKT (maîtrise) + FSRS (révision) + mémoire des
  erreurs (embeddings) + dossier élève.

Ce n'est **pas** « un chatbot GPT », ni « juste un RAG » : c'est le même lignage que **ALEKS** (Knowledge
Space Theory) et **MATHia** (ACT-R + BKT), les deux ITS les mieux prouvés du secteur — mais où un LLM sert
de moteur de langage et de génération.

**Test *AI-native*** (« retire l'IA → le produit s'arrête-t-il ? ») : **oui**. Retirer le Copilote rend la
machine à états inerte (plus de bilan texte→état, plus de placement, plus de génération). L'ancien modèle
BYO-AI par fichier `.json` était *AI-added* (l'IA était optionnelle, greffée) ; l'IA interne le rend
*AI-native*.

---

## 2. Les DEUX IA (à ne jamais confondre)

| | **IA de tutorat (externe)** | **IA de Dowze — le Copilote (interne)** |
|---|---|---|
| Qui | L'abonnement de l'élève (ChatGPT/Claude) | L'IA de Dowze (`apps/api/src/copilote/`) |
| Rôle | Tenir la **conversation** de tutorat | **Faire tourner l'école** (voir §3) |
| Statut | Interchangeable, « jetable », **sans mémoire fiable** | **Le moteur indispensable** |
| Coût | L'abonnement de l'élève | **Coût réel** (crédits prépayés **ou** BYOK) |
| Mécanisme | L'élève **colle un prompt lisible** (plus jamais de `.json`) | API multi-fournisseurs (Vercel AI SDK) |

Le **« BYO-AI »** (Bring Your Own AI) reste vrai — **uniquement pour la conversation de tutorat**. Tout le
reste passe par le Copilote.

---

## 3. Ce que fait le Copilote (pourquoi il est indispensable)

Une méthode générique, `generateStructured<T>()`, ancre chaque appel sur l'état de l'élève + le graphe, et
force une **sortie structurée** (schéma Zod). Elle sous-tend **toutes** les features IA :

- **Composer** le prompt de séance (déterministe, gratuit) — [Copilote](15-copilote-orchestrateur.md).
- **Donner le cours lui-même (nouveau défaut, 08-2026)** : au lieu de seulement composer un prompt à copier,
  le Copilote + le RAG + les **agents de l'École** GÉNÈRENT et LIVRENT le cours **en app**, sous forme de
  **feuille A4 à modules** (fiche, exemple résolu, QCM à distracteurs = misconceptions, exercices…). Rien ne
  sort de Dowze. L'ancien « prompt à coller dans ChatGPT/Claude » devient un **mode manuel** masqué. Détail :
  [le cours natif Dowze](30-cours-natif-feuille-modules.md).
- **Ingérer** le bilan de séance : texte libre → état structuré → BKT + carnet + FSRS + mémoire des erreurs.
- **Dossier élève** : présentation libre → modèle d'apprenant — [onboarding](19-onboarding-profil-placement.md).
- **Placement adaptatif** : génère + corrige les questions, situe le niveau — [placement](19-onboarding-profil-placement.md#5-le-test-de-placement--situer-le-bon-niveau-maternelle--master).
- **Exercices** (QCM/cloze/flashcard/short) et **tests** hebdo/trimestriels — [tests](18-tests-et-examens.md).
- **Expéditions guidées** : 3 propositions + guidage par phase — [expéditions](20-expeditions.md).
- **Mémoire des erreurs** : dédup sémantique par embeddings — [état & mémoire](16-architecture-etat-memoire.md).

Aucune de ces fonctions n'est réalisable par une machine à états seule : elles exigent **compréhension et
génération de langage**. D'où l'indispensabilité.

---

## 4. Pourquoi « RAG Dowze » — et sous quelle définition

On appelle ce cœur le **« RAG Dowze »**, et c'est **défendable** au sens précis du terme. Le RAG
(*Retrieval-Augmented Generation*) = **récupérer** une connaissance externe aux poids du modèle, puis
**générer** en s'ancrant dessus. Les références du domaine (AWS, IBM, NVIDIA, survey académique) incluent
explicitement les **bases structurées et les graphes de connaissances** comme sources de récupération.

Dowze qualifie **à une condition remplie** : la récupération est **dynamique** — à chaque séance, le Copilote
va chercher *ce qui est pertinent pour CET élève maintenant* (sa dernière note scopée, ses erreurs actives,
ses révisions FSRS dues, la prochaine compétence du **graphe**, et — ✅ *branché en 07-2026* — **son dossier
élève** : objectif de fond + centres d'intérêt, pour ancrer les exemples dans ses *funds of knowledge*) et
l'injecte dans la génération. Le curriculum étant un **graphe**, c'est apparenté à **GraphRAG**.

> Terme le plus honnête : **« RAG structuré / GraphRAG sur le graphe de compétences »**. Ce n'est *pas* du
> RAG si le contexte est statique/codé en dur — la récupération conditionnée par l'élève est ce qui le rend
> légitime. Le « RAG Dowze » est le **cœur d'ancrage** de l'ITS, pas le système entier.

---

## 5. Ancrage = anti-dévaluation (mais l'IA seule ne suffit pas)

**L'argument « sans l'IA, l'app manque de connaissance et dévalue » est fondé — à corriger.**

Ce qui est **prouvé** : un LLM **non ancré** sur-généralise et dévalue le savoir — sur 4 900 résumés (Royal
Society Open Science), **même explicitement invités à la précision**, les LLM sur-généralisent dans 26-73 %
des cas, ~5× plus que des humains, et les modèles récents **davantage**. Donc **ancrer** la génération sur le
graphe de compétences (la vérité) est bien **nécessaire** contre la dévaluation.

Ce qui est **faux/exagéré** : « ça ne peut pas se faire sans une IA qui gère *tout* ». La recherche est nette :
la fiabilité **ne vient jamais du LLM seul**. Une IA qui « gère tout » *sans garde-fous* est justement ce qui
**produit** la dévaluation. Le simple prompt « sois rigoureux » est **démontré insuffisant**.

---

## 6. L'architecture correcte (et nos garde-fous : ce qui existe, ce qui manque)

```
Vérité STRUCTURÉE : graphe de compétences / prérequis (le curriculum vérifié)
      ↓ récupération DYNAMIQUE conditionnée par l'élève  ← le « RAG Dowze »
Modèle d'élève : BKT (maîtrise) + mémoire épisodique/sémantique (erreurs, dédup embeddings) + FSRS (quand réviser)
      ↓ contexte injecté
LLM GÉNÉRATEUR (composant contraint, interchangeable)
      ↓
Garde-fous : sortie structurée (schéma Zod) → rester dans le programme → scoring de fidélité
   → rubrique de rigueur → REVUE HUMAINE  →  l'app RECALCULE la maîtrise (jamais un score du LLM)
      ↓
Couche d'abstraction LLM (multi-fournisseurs) + repli + cache  →  dégradation gracieuse
```

**Ce qui est déjà en place (solide)** :
- ✅ **Ancrage** sur les descriptions de compétences du graphe.
- ✅ **Sorties structurées** (schémas Zod stricts, `generateObject` + filet `jsonrepair`).
- ✅ **L'app recalcule la maîtrise (BKT)** — elle ne fait **jamais** confiance à un score du LLM.
- ✅ **Multi-fournisseurs** derrière une abstraction unique (Vercel AI SDK).
- ✅ **Clés chiffrées** (BYOK AES-256-GCM), **crédits** à ledger.
- ✅ **Human-in-the-loop** partiel (l'élève valide son dossier ; la validation de compétence reste par les pairs).
- ✅ **Dossier élève branché au tutorat quotidien** (07-2026) : `compose()` injecte l'objectif de fond et les
  centres d'intérêt du dossier dans le prompt de séance → exemples ancrés dans les *funds of knowledge*.
  Corrige l'écart d'audit « le dossier pilotait les expéditions mais pas la séance ».
- ✅ **Génération vivante du graphe** (07-2026) : le graphe s'étend au bord atteint par l'élève (module
  `skill-generation`), validée par la loi de clôture — voir [l'école générative](../03-ARCHITECTURE/09-ecole-generative.md).
- ✅ **Ancrage + vérification des nœuds générés** (07-2026) : ≥1 source réelle exigée + **passe de
  vérification adversariale** (sceptique, T=0) qui rejette les nœuds douteux et les sources inventées.
- ✅ **Voisinage amont** (07-2026) : `growTowardGoal()` fabrique la cible d'un objectif libre + la chaîne
  de prérequis manquante jusqu'aux acquis (`POST /skills/toward-goal`).
- ✅ **Couche épistémique active** (07-2026) : rang ISCED explicite (`skills.rank`), demi-vie par domaine,
  statut `emergent` sur le front de recherche, sources par nœud — surfacés dans le prompt de séance.
- ✅ **Récupération sémantique — GraphRAG vectoriel** (07-2026) : notes de carnet **ET nœuds du graphe**
  proches du sujet par cosinus sur embeddings (`skills.embedding`, backfill via `POST /skills/embed-graph`).
  `compose()` injecte les compétences voisines *par le sens* (autres branches), en plus des voisins
  symboliques du DAG. *Vérifié en prod* (Jina v3, 1024 dim, 202 nœuds embarqués).
- ✅ **Consensus multi-passes** (07-2026) : dans les zones sensibles (front de recherche, rang ≥ 8), on
  génère plusieurs passes et on ne garde que les compétences convergentes (Jaccard de titres ≥ 0,5).
- ✅ **Densification** (07-2026) : 11 disciplines (les 6 académiques + Arts, Citoyenneté, Corps, Langues,
  Métiers).

**Ce qui manque (à formaliser — honnêteté)** :
- ⏳ **Scoring de fidélité** automatique (faithfulness) sur le contenu généré.
- ⏳ **Revue experte** systématique des items à enjeu (le maillon le mieux prouvé contre la dévaluation).
- ⏳ **Vraie gateway LLM** (repli automatique / circuit-breaker) — aujourd'hui pas de bascule automatique en
  cas de panne fournisseur → **point de défaillance unique** à traiter.
- ⏳ **Conformité RGPD de l'inférence** : DeepSeek s'appelle **hors UE** ; router du texte d'élève hors UE
  n'est pas conforme → prévoir **résidence UE** (Mistral, endpoints UE), **zéro-rétention/non-entraînement**
  contractualisés, registre des sous-traitants, préparation **EU AI Act** (éducation = haut risque probable).
- ⏳ **Banc d'évaluation** multi-modèles (la qualité varie selon le backend).
- ⏳ **pgvector / ANN** : la similarité est calculée en JS (cosinus sur `real[]`), ce qui suffit à
  l'échelle actuelle (~200 nœuds) ; passer à pgvector + index ANN quand le graphe grossira.
- ⏳ **Ré-embedding sur mise à jour** : un nœud modifié garde son ancien vecteur jusqu'au prochain
  backfill ; ajouter une invalidation ciblée (ré-embed à l'écriture).

---

## 7. Le coût — et le « gratuit » honnête

« Coût LLM ≈ zéro » est **faux** : le Copilote a un **coût réel** (~0,2 centime/séance, marge cible ~70 %),
monétisé en **crédits prépayés** (Stripe à venir) **ou gratuit en BYOK**. Le cadrage honnête :

- **Le cœur reste gratuit** : graphe, suivi, carnet, validation par les pairs, **BYO-AI de tutorat**.
- **Le Copilote est un confort payant** (crédits) **ou gratuit** si l'élève met sa propre clé (BYOK).

Le vrai **« moat »** reste l'**état pédagogique accumulé** par élève (graphe + maîtrise + mémoire), pas le
prompt — un simple wrapper de LLM se fait absorber (leçon Jasper), un ITS avec modèle d'élève, non.

---

## 8. Positionnement honnête

On ne revendique **pas** « +X % » : les preuves d'efficacité sont **rares et modestes** même chez les mieux
établis (MATHia ≈ 0,2 σ au terme d'un RCT indépendant ; Squirrel/CENTURY = surtout du marketing). Ce qu'on
revendique : une **architecture juste et auditable** — ITS moderne + modèle d'élève explicite + garde-fous —
et l'ambition de se démarquer par la **preuve indépendante**, pas par des chiffres invérifiables.

**Sources** : Lewis et al. (RAG, 2020) ; survey Gao (2023) ; GraphRAG (Microsoft) ; RAGTruth (hallucinations
persistantes) ; sur-généralisation LLM (Royal Society Open Science) ; roadmap KG+LLM (Pan 2023) ; VanLehn
(ITS) ; Corbett & Anderson (BKT) ; FSRS ; compound AI systems (BAIR) ; Gartner (agent-washing).

**Voir aussi** : [Copilote (détail technique)](15-copilote-orchestrateur.md) · [état & mémoire](16-architecture-etat-memoire.md)
· [vision produit](01-vision-produit.md) · [le pont `.json` (outil d'auteur)](10-pont-json.md).
