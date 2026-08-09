# 30 — Le cours NATIF Dowze : feuille A4 à modules (par défaut) + mode manuel

> *Par défaut, quand tu démarres « Ma séance » (ou un cours de langue), le cours est **créé et donné par
> l'IA de Dowze** — le Copilote, le RAG structuré et les **agents de l'École** — et affiché **dans Dowze**,
> pas sous forme de chat mais comme une **feuille A4 composée de modules pédagogiques réutilisables** (fiche
> de cours, exemple résolu, QCM, exercices…) que l'IA remplit selon TA compétence du jour. **Rien ne sort de
> Dowze** (clés API internes). L'ancien système — copier un prompt dans ton ChatGPT/Claude — reste dispo,
> mais **masqué derrière un « mode manuel »** qu'on active d'un clic. Le mode par défaut, c'est le cours
> entièrement géré par Dowze, sans quitter Dowze Académie.*

> ⚙️ **Statut : conception (03-08-2026).** Ce document est le fruit d'un audit du code existant + d'une
> recherche pédagogique sourcée. Il définit le design et le plan d'implémentation. Le socle réutilisé est
> déjà en prod (voir §7). Ce qui est neuf est un **assemblage** de briques existantes, pas une refonte.

---

## 1. Le principe (et ce qui change vraiment)

Jusqu'ici (voir [séance](17-seance-et-minuteur.md), [prompts & continuité](03-prompts-et-continuite.md)),
« faire un cours » = Dowze **compose un prompt** que l'élève **copie dans son IA** (ChatGPT/Claude), apprend
là-bas, puis **recolle un résumé** dans Dowze. C'est le modèle *compound AI system* de Dowze :
[l'IA de tutorat est externe, l'état reste dans l'app](23-ia-de-dowze-le-moteur.md).

**Ce qu'on ajoute** : un **second mode, désormais PAR DÉFAUT**, où **l'IA de Dowze donne elle-même le cours**,
en app :

| | **Mode AUTO — cours natif Dowze (nouveau défaut)** | **Mode MANUEL — pont IA externe (ancien, masqué)** |
|---|---|---|
| Qui enseigne | **L'IA de Dowze** : Copilote + RAG + agents de l'École | L'IA de l'élève (ChatGPT/Claude) |
| Où | **Dans Dowze Académie**, rien ne sort | Chez le fournisseur de l'élève |
| Forme | **Feuille A4 de modules** (fiche, QCM, exercices…) | Prompt à copier + résumé à recoller |
| Coût | Clés Dowze (crédits) **ou** BYOK | L'abonnement de l'élève |
| Activation | Défaut | **Clic sur « mode manuel »** (masqué par défaut) |

**Ce qui NE change pas** (on respecte la logique existante) :
- **Une compétence prescrite / séance**, minuteur 45 min, une seule cible ([séance](17-seance-et-minuteur.md)).
- **Dowze RECALCULE la maîtrise** (BKT) — jamais un score du LLM ([le moteur §6](23-ia-de-dowze-le-moteur.md)).
- **Ancrage obligatoire** sur le graphe de compétences + garde-fous (sortie Zod, revue, faithfulness).
- Le pont externe **reste** (les élèves qui veulent leur propre IA gardent le mode manuel).

Le mode AUTO n'est PAS « un chatbot dans une bulle ». C'est le même *compound AI system* — orchestrateur
déterministe + LLM contraint + modèle d'élève explicite — mais dont la **sortie** est désormais un **contenu
de cours structuré rendu comme un document**, au lieu d'un prompt à copier.

---

## 2. Fondation pédagogique (pourquoi des « modules »)

Un bon cours n'est pas un pavé de texte : c'est une **séquence de gestes pédagogiques** validés par la
recherche. On s'appuie sur trois cadres convergents et déjà cohérents avec [la science Dowze](../02-SCIENCE/02-theories-pedagogiques.md) :

- **Les 10 principes de Rosenshine** (issus des sciences cognitives + observation des maîtres) : rappel
  quotidien · petits pas + pratique après chaque pas · beaucoup de questions · **modèles / exemples résolus**
  · pratique **guidée** · vérifier la compréhension · viser un **taux de réussite élevé** · échafaudages ·
  **pratique indépendante** · révision espacée.
- **La libération graduelle de responsabilité (GRR)** : *« je fais → nous faisons → tu fais »* — la charge
  cognitive glisse du prof vers l'élève.
- **Les 6 stratégies des Learning Scientists** : pratique **espacée**, **interleaving**, **récupération**
  (retrieval), **élaboration** (auto-explication, « pourquoi/comment »), **exemples concrets**, **double
  codage** (texte + visuel).

Deux atouts que Dowze possède DÉJÀ et qui rendent ces cadres directement exploitables :
- **Les distracteurs de QCM = les misconceptions de l'élève.** La recherche est nette : un bon distracteur
  incarne une erreur de raisonnement courante et sert de **diagnostic formatif**. Or Dowze **suit déjà** les
  misconceptions actives par compétence (`learnerMisconceptions`, `reconcileMisconceptions`) → on génère des
  QCM dont les mauvaises réponses sont **les confusions réelles de CET élève**.
- **La récupération + l'espacement = FSRS**, déjà en place. Un module « rappel » / « synthèse » alimente
  directement la file de révision.

**Traduction en modules** : chaque geste pédagogique = un **module** = un **template** que l'IA remplit.
C'est la brique du cours natif.

---

## 3. Le catalogue de modules (les « templates »)

Un cours = une **feuille A4** = une **liste ordonnée de modules typés**. L'IA choisit lesquels, dans quel
ordre, et les **remplit** selon la compétence, le niveau (Bloom), les misconceptions et le dossier de l'élève.
Chaque module a : un **but pédagogique**, un **schéma de données** (Zod — souvent DÉJÀ existant), un **rendu**.

| Module | Geste pédagogique | Schéma (source) | Rendu |
|---|---|---|---|
| **`objectif`** | Backward design : ce qu'on saura faire | `lessonSchema.objectives` ✅ | encart d'objectifs (puces) |
| **`rappel`** | Rappel quotidien + récupération (Rosenshine #1) | FSRS dus + `qcm`/`flashcard` ✅ | mini-quiz de réactivation |
| **`fiche`** (notion) | Petits pas + exemples concrets + double codage | `lessonSchema.sections` ✅ | markdown + (schéma) |
| **`exemple`** (résolu) | « Je fais » — modèle pas-à-pas, étapes fadées | `lessonSchema.workedExamples` ✅ (à structurer en étapes) | étapes numérotées, dernière masquable |
| **`guide`** | « Nous faisons » — pratique guidée + indices | `qcm`/`short` + indices (léger neuf) | question à indices progressifs |
| **`qcm`** | Vérifier — distracteurs = misconceptions | `qcmGenSchema` ✅ (`+ distractorRationales`) | `ExerciseCard` (auto-corrigé) |
| **`exercice`** | « Tu fais » — pratique indépendante | `exerciseItemSchema` ✅ (qcm/short/cloze/flashcard) | `ExerciseCard` |
| **`elaboration`** | Auto-explication, « pourquoi / comment » | schéma léger neuf `{ questions[] }` | prompts d'élaboration + zone de note |
| **`schema`** | Double codage : un visuel + légende | schéma léger neuf `{ caption, kind, spec }` | diagramme (SVG/mermaid) + légende |
| **`synthese`** | Points clés → graines de flashcards (espacement) | `flashcardGenSchema[]` ✅ | carte de synthèse + « à réviser » (FSRS) |
| **`bilan`** | Vérification finale → **calcule l'outcome** | dérivé des résultats des modules | auto-éval + confiance → `applyProgress` |

Notes de conception :
- **~80 % des schémas existent déjà** : `lessonSchema` ([content.ts](../../packages/schemas/src/content.ts)) et
  `qcmGenSchema`/`flashcardGenSchema`/`clozeGenSchema`/`shortGenSchema` + `bloomLevelSchema`
  ([exercises.ts](../../packages/schemas/src/exercises.ts), dont le commentaire dit littéralement « modules
  d'exercices réutilisables »). Le neuf est **léger** : `objectif`, `guide`, `elaboration`, `schema`,
  `synthese`, `bilan`, et le **conteneur** (§4).
- **Anti-surcharge** : une feuille n'utilise pas tous les modules. Une séquence GRR type = `objectif` →
  `rappel` → `fiche` → `exemple` → `guide` → `qcm`/`exercice` → `synthese` → `bilan`. Pour une compétence
  déjà à 70 %, on allège la fiche et on charge la pratique (interleaving). Charge cognitive : **une
  compétence, petits pas** ([séance §1](17-seance-et-minuteur.md)).
- **Extensible** : `vrai-faux`, `appariement`, `séquence`, `ouverte` sont déjà réservés dans
  `exercises.ts` (P2/P3) → de nouveaux modules sans refonte.

---

## 4. La feuille A4 : le schéma-conteneur

Le seul vrai objet neuf côté données : un conteneur qui **compose plusieurs modules typés en une page**.

```ts
// packages/schemas/src/course.ts (À CRÉER)
export const courseModuleSchema = z.discriminatedUnion('kind', [
  objectifModuleSchema,   // { kind:'objectif', objectives: string[] }
  rappelModuleSchema,     // { kind:'rappel',  items: (qcm|flashcard)[] }
  ficheModuleSchema,      // { kind:'fiche',   sections: {heading, body}[] }   ← lessonSchema.sections
  exempleModuleSchema,    // { kind:'exemple', title, steps: {text, reveal?:boolean}[] }
  guideModuleSchema,      // { kind:'guide',   prompt, hints: string[], answer }
  qcmModuleSchema,        // { kind:'qcm',     items: qcmGenSchema[] }
  exerciceModuleSchema,   // { kind:'exercice',items: exerciseItemSchema[] }
  elaborationModuleSchema,// { kind:'elaboration', questions: string[] }
  schemaModuleSchema,     // { kind:'schema', caption, mermaid?: string }
  syntheseModuleSchema,   // { kind:'synthese', keyPoints: string[], flashcards: flashcardGenSchema[] }
]);

export const courseSheetSchema = z.object({
  skillId: uuidSchema,
  title: z.string().min(1).max(200),
  level: bloomLevelSchema.optional(),          // niveau visé
  modules: z.array(courseModuleSchema).min(1).max(12),
});
```

Le **`bilan`** n'est pas un module généré : c'est la **clôture** calculée côté app à partir des résultats
des modules interactifs (voir §6). Le contenu de la feuille est **régénérable à la demande** (jamais une
vérité figée — cohérent avec le commentaire de `content.ts`), et **stocké comme RAG** (§5).

---

## 5. Qui fabrique le cours : le Copilote + le RAG + les agents de l'École

Le cours natif est produit par **l'IA de Dowze**, au sens plein : le Copilote (génération contrainte), le
**RAG structuré / GraphRAG** (ancrage sur l'état de l'élève), et les **agents de l'École** (la ruche). Deux
niveaux de qualité, du plus simple au plus riche — **tout réutilise l'existant** (voir l'audit §7) :

**A. Mono-passe (MVP fiable).** `copilote.generateStructured(profileId, { schema: courseSheetSchema, system,
prompt })` où le `prompt` = **le contexte de `compose()`** (compétence prescrite, description, misconceptions
actives, FSRS dus, dossier, GraphRAG). C'est exactement la brique qui génère déjà les exercices en prod
([le moteur §3](23-ia-de-dowze-le-moteur.md)). Une passe, un objet validé, facturé (crédits/BYOK).

**B. Orchestré par l'École (qualité supérieure).** On réutilise **`runProject`** (déjà en prod, cf.
[open-spaces = organisations](../13-COMPAGNON/03-open-spaces-entreprises.md)) : le **Directeur** planifie
les modules, le/les **Prof(s)** de la discipline les produisent (persona + **`orgSearch`** = RAG de l'École),
l'**Évaluateur** valide **par module** (QA + 1 correction bornée), on assemble la feuille et on **l'archive
en RAG** (`companion_space_knowledge`, embeddée, relue par toute l'École). C'est la boucle
leader→rôles→QA→livrable, appliquée à « produire un cours ».

Le **RAG** joue deux rôles : (1) **ancrage amont** — le Prof récupère la base de connaissance de l'École
(`orgSearch`) + le GraphRAG du graphe de compétences pour ne pas sur-généraliser (anti-dévaluation,
[le moteur §5](23-ia-de-dowze-le-moteur.md)) ; (2) **mémoire aval** — le cours produit devient une
connaissance de l'École, réutilisable et affinable.

> **Le pont IA externe et le cours natif partagent le même socle** : `compose()` donne la compétence + le
> contexte ; `applyProgress()` écrit la maîtrise. Le [Pont IA](../13-COMPAGNON/04-ponts-ia-externes.md) fait
> déjà exactement ça pour une conversation ChatGPT/Claude ; le cours natif le fait pour un contenu généré
> **dans** Dowze. Même seam, deux sources.

---

## 6. Le flux complet (mode AUTO)

```
1. Élève clique « Démarrer ma séance ».            → minuteur 45:00 (inchangé)
2. compose(profileId) → compétence prescrite + contexte pédagogique (déterministe, gratuit)
3. runCourse(skillId) :
     A) generateStructured(courseSheetSchema, ctx)        ← MVP
     ou B) runProject sur l'École (Directeur→Prof→Évaluateur→feuille) ← qualité
   → courseSheet validé (Zod) → stocké RAG (skillId, kind='course')
4. Dowze RENDT la feuille A4 en app : modules empilés (fiche, exemple, QCM, exercices…)
5. Élève lit et RÉPOND en app : QCM/exercices auto-corrigés (ExerciseCard), feedback immédiat
6. Clôture : l'app dérive l'outcome des résultats (score QCM/exos → maitrise|progres|bloque)
   → applyProgress(profileId, skillId, outcome, note)  → BKT + FSRS + carnet + misconceptions
7. Synthèse → graines de flashcards ajoutées à la file FSRS. Pause. (inchangé)
```

Points clés (garde-fous — [le moteur §6](23-ia-de-dowze-le-moteur.md)) :
- **Sortie structurée Zod** obligatoire (rester dans le programme), filet `jsonrepair`.
- **L'app RECALCULE la maîtrise** depuis les réponses réelles de l'élève, jamais un score du LLM. Le QCM
  étant auto-corrigé en app, `applyProgress` (sans LLM, gratuit) suffit — pas besoin d'`ingest`.
- **Distracteurs = misconceptions** → le QCM est diagnostic : une mauvaise réponse ré-active la confusion
  (`reconcileMisconceptions`), une bonne la résout.
- **Ancrage** : chaque module généré s'appuie sur la description de compétence + le RAG. Faithfulness/revue
  = les mêmes ⏳ que le reste du moteur (à formaliser).

---

## 7. Réutilisé vs à construire (issu de l'audit du code)

**Déjà en place — à réutiliser tel quel :**
- `copilote.generateStructured` — génération LLM→objet Zod validé, BYOK/crédits/hold-reconcile, filet
  jsonrepair. *Précédent : `ExercisesService` génère déjà QCM/flashcards en prod.*
- `copilote.compose(profileId)` — compétence prescrite + contexte (misconceptions, FSRS, dossier, GraphRAG).
- `copilote.applyProgress(profileId, skillId, outcome, note)` — BKT + carnet + FSRS, **sans LLM ni crédits**.
- Schémas modules : `lessonSchema` (content.ts) + `qcm/flashcard/cloze/shortGenSchema`, `bloomLevelSchema`
  (exercises.ts) + `exerciseItemSchema` (union discriminée).
- Front : **`ExerciseCard`** (rend + auto-corrige qcm/flashcard/short/cloze avec `onGraded`) ; le patron de
  **pile de modules** de `app/tests/page.tsx` ; le kit UI (`Card` = surface papier, `Badge`, `Progress`,
  `Note`, `PageHeader.action`, `icons.tsx` Lucide).
- Agents École : `ensureServiceOrg` (Directeur+Évaluateur+Prof/discipline calibrés au rang), **`runProject`**
  (orchestration + QA + archive RAG), `searchSpaceKnowledge`/`orgSearch` (RAG), `recruitTeachersForQuestion`.

**À construire (léger) :**
1. **`packages/schemas/src/course.ts`** — `courseSheetSchema` (union de modules) + les 6 schémas de module neufs.
2. **Prompt de composition** de la feuille (choisir/ordonner les modules selon niveau, misconceptions, Bloom).
3. **`copilote.runCourse(profileId, skillId)`** (backend) — assemble le contexte `compose` → `generateStructured`
   (MVP) ou `runProject` (École) → feuille → stocke RAG (avec `skillId`, `kind='course'`).
4. **`companion_space_knowledge` : ajouter `skill_id` + `kind`** (migration) pour lier/retrouver un cours par
   compétence et le séparer des notes du pont.
5. **Endpoint** `POST /copilote/cours` (générer) + `POST /copilote/cours/cloture` (dériver l'outcome →
   `applyProgress`).
6. **Front** : un composant `FeuilleA4` (conteneur imprimable) + un `ModuleRenderer` (dispatch sur `kind`,
   étend le patron d'`ExerciseCard`) + un rendu `fiche`/`exemple`. **Dépendances neuves** : un rendu
   **markdown** (fiche), **KaTeX** (maths), coloration code, **mermaid** (schéma) — sinon le contenu riche
   ne s'affiche pas. Respecter les conventions : titres courts, cellules bordées, **Lucide only, zéro emoji**,
   pas de texte d'aide inutile.
7. **Toggle mode manuel** : état `mode: 'auto' | 'manuel'` dans `PageHeader.action` ; le mode `manuel`
   contient **verbatim** l'actuel bloc « copie le prompt / recolle le résumé » (`composeSession`/
   `ingestSummary`/`observe`) — risque quasi nul. Idem pour `/langues`.

**Estimation d'effort** : le cœur (génération + progression) est un **assemblage** ; le gros du neuf est le
**rendu front** (A4 + markdown/maths/schéma) et le schéma-conteneur.

---

## 8. Le mode MANUEL (l'ancien système, gardé mais masqué)

Exigence : garder le flux « copier le prompt dans ChatGPT/Claude », mais **masqué par défaut**, activable
d'un clic. Concrètement :
- Le mode par défaut est **AUTO** (§6). Un discret **« mode manuel »** (dans `PageHeader.action`) bascule
  vers l'ancien écran : `compose()` → `<pre>` du prompt à copier + prompt de bilan + zone pour recoller le
  résumé → `ingest()`. **Aucun changement de logique** : on déplace les blocs existants dans une branche
  `mode === 'manuel'`.
- Le mode manuel reste utile : élèves qui **préfèrent leur propre IA** (BYO-AI de tutorat, cf.
  [le moteur §2](23-ia-de-dowze-le-moteur.md)), ou qui n'ont pas de crédits et pas de BYOK côté Copilote.
- Le [Pont IA webview/desktop](../13-COMPAGNON/05-pont-webview-tauri.md) est une **variante enrichie du mode
  manuel** (ChatGPT/Claude embarqué + injection/capture auto) — même famille : « l'IA externe enseigne ».

Ainsi les deux visions cohabitent proprement : **AUTO = tout Dowze** (défaut), **MANUEL = ponts externes**
(replié, pour ceux qui le veulent).

---

## 9. Cours de langue « Parler » : même logique

[Le cours de langue](28-cours-de-langue.md) suit exactement le même patron `compose → (IA) → progression`.
Il gagne donc le **même toggle AUTO/MANUEL** :
- **AUTO** : Dowze génère une **feuille A4 de langue** (tâche communicative TBLT, mini-fiche lexicale plafonnée
  ~20-25 %, exemples ancrés dans les centres d'intérêt) rendue en app ; l'oral reste possible via l'IA de
  Dowze (TTS/STT à câbler) ou renvoyé au mode manuel pour le vocal des apps externes.
- **MANUEL** : l'actuel `composeLanguageSession`/`ingestLanguageSession` (prompt à copier), inchangé.
- Nuance propre aux langues : l'**oral** reste le point fort de l'IA externe (mode vocal ChatGPT/Claude) →
  le mode manuel garde une vraie valeur ici (à surfacer honnêtement, pas cacher que l'oral y est meilleur
  aujourd'hui).

---

## 10. Ce qui reste honnête (⏳)

- **Faithfulness / revue experte** du contenu généré : le maillon le mieux prouvé contre la dévaluation,
  toujours ⏳ (comme pour tout le moteur, [§6](23-ia-de-dowze-le-moteur.md)). Le mode École (Évaluateur)
  en est une première brique interne, pas une revue humaine.
- **Coût** : un cours natif = plusieurs appels LLM (surtout en mode École multi-agents) → plus cher qu'un
  `compose` gratuit. Cadrer crédits/BYOK et éventuellement **cacher** la feuille (RAG) pour éviter de
  régénérer à chaque ouverture.
- **Rendu riche** (markdown/KaTeX/mermaid) = dépendances front neuves à intégrer proprement (poids, offline).
- **RGPD/EU AI Act** : le contenu généré passe par les fournisseurs LLM ; garder la **résidence UE /
  non-entraînement** déjà notée dans [le moteur §6](23-ia-de-dowze-le-moteur.md).
- **Oral (langues)** : STT/TTS serveur pour rendre l'AUTO vocal robuste (aujourd'hui Web Speech API).

---

## 11. Plan d'implémentation (phasé)

- **P1 — Schéma + génération MVP** : `course.ts` (`courseSheetSchema`) ; `runCourse` mono-passe
  (`generateStructured` + contexte `compose`) ; endpoint `POST /copilote/cours`. *Aucun front encore.*
- **P2 — Rendu A4** : `FeuilleA4` + `ModuleRenderer` (réutilise `ExerciseCard`) ; markdown + KaTeX ; brancher
  la clôture → `applyProgress` (endpoint `cloture`). Remplace le `<pre>`-prompt de `/seance` en mode AUTO.
- **P3 — Toggle + manuel** : `mode: 'auto'|'manuel'` (défaut AUTO) ; déplacer l'ancien flux en branche
  `manuel`. Idem `/langues`.
- **P4 — Mode École** : `runCourse` via `runProject` (Directeur→Prof→Évaluateur) ; `skill_id`/`kind` sur le
  RAG ; cache du cours.
- **P5 — Enrichissements** : mermaid/schéma, modules `vrai-faux`/`appariement`, faithfulness, oral langues.

---

**Sources pédagogiques** : Rosenshine, *Principles of Instruction* (2012) ; Fisher & Frey, *Gradual Release
of Responsibility* ; The Learning Scientists (6 strategies : spaced/retrieval/interleaving/elaboration/
concrete examples/dual coding) ; Sweller (charge cognitive) ; bonnes pratiques QCM (distracteurs =
misconceptions, formatif). Voir aussi [02-SCIENCE](../02-SCIENCE/02-theories-pedagogiques.md).

**Voir aussi** : [séance & minuteur](17-seance-et-minuteur.md) · [prompts & continuité](03-prompts-et-continuite.md)
· [l'IA de Dowze, le moteur](23-ia-de-dowze-le-moteur.md) · [Copilote orchestrateur](15-copilote-orchestrateur.md)
· [cours de langue](28-cours-de-langue.md) · [open-spaces = organisations](../13-COMPAGNON/03-open-spaces-entreprises.md)
· [Pont IA externe](../13-COMPAGNON/04-ponts-ia-externes.md) · [Pont webview desktop](../13-COMPAGNON/05-pont-webview-tauri.md).
