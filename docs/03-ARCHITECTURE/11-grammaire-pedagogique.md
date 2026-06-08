# La grammaire pédagogique — le socle de racines + les règles génératives

> *L'artefact concret. C'est tout ce que l'humain écrit **une seule fois** : un **socle fini de
> compétences-racines** (les axiomes) et une **grammaire de ~18 règles** qui dit à l'IA comment générer
> n'importe quelle compétence, cours ou évaluation. À partir de ça, **tout le reste se génère** — sans
> trou (loi de clôture), sans création manuelle, et sans jamais devenir obsolète.*

Ce document fournit le **contenu réel** du CORE (les fichiers ① socle et ② règles de
[10-noyau-de-regles.md](10-noyau-de-regles.md)). Chaque règle est ancrée sur un invariant intemporel des
sciences de l'apprentissage.

---

## Partie 1 — Le socle de racines (les axiomes, niveau 0)

Ce sont les **seules** compétences autorisées à n'avoir aucun prérequis (`is_root = true`, `level = 0`).
Toute la génération « descend » et **s'arrête sur elles** (cas de base de la récursion — R6). Elles sont
**universelles, fondamentales et stables** : elles ne datent pas. Liste volontairement **courte** (un
socle, pas un programme).

```yaml
socle_racines:
  langage:
    - comprendre-oral-L1        # comprendre la parole dans sa langue maternelle
    - s-exprimer-oral-L1        # se faire comprendre à l'oral
    - dechiffrer-lire           # associer signes et sons, lire un mot/une phrase
    - tracer-ecrire             # produire des signes écrits lisibles
  quantite:
    - denombrer                 # compter, dénombrer une collection
    - comparer-quantites        # plus/moins/égal, ordonner des grandeurs
  raisonnement:
    - classer-ordonner          # trier selon un critère, mettre en ordre
    - cause-effet-simple        # relier une cause et une conséquence
    - vrai-faux-et-ou-non       # logique élémentaire (affirmation, négation)
  representation:
    - lire-image-symbole        # interpréter une image, un pictogramme, un schéma simple
    - se-reperer-espace-temps   # avant/après, ici/là, hier/aujourd'hui
  soi:
    - porter-attention          # se concentrer sur une tâche un moment
    - perseverer-tache          # poursuivre malgré une difficulté
    - reconnaitre-emotion       # nommer une émotion de base
  corps:
    - motricite-fine            # geste précis (tenir, tracer, manipuler)
    - motricite-globale         # se déplacer, coordonner son corps
  social:
    - tour-de-parole            # écouter, attendre, répondre
    - cooperer-a-deux           # faire une tâche simple avec un autre
```

> **Pourquoi celles-là ?** Ce sont les briques que *tous* les apprentissages ultérieurs présupposent (on
> ne fait pas d'algèbre sans dénombrer, ni d'argumentation sans s'exprimer). Elles correspondent aux
> « core foundations » des cadres de référence (OCDE, socle commun). Le socle est **amendable par la
> gouvernance**, mais reste minuscule par principe. *(Pour la petite enfance, ces racines s'acquièrent par
> le jeu et via les adultes — voir [petite enfance](../04-PARCOURS-DE-VIE/01-petite-enfance.md).)*

---

## Partie 2 — La grammaire pédagogique (les règles génératives)

Ces règles sont injectées dans chaque `.json` de génération. L'IA **doit** les respecter pour produire
compétences, cours et évaluations. Chacune traduit un principe **stable** (qui ne se périme pas).

### A. Règles de structure (garantissent la cohérence et le zéro-trou)

| # | Règle | Fondement |
|---|-------|-----------|
| **G1 — Cible d'abord** | Générer toujours dans l'ordre : **objectif → preuve attendue → activité**. Jamais l'inverse. | *Backward design* (Wiggins & McTighe) |
| **G2 — Clôture des prérequis** | Toute compétence est générée **avec toute sa chaîne de prérequis** jusqu'aux racines. Aucune dépendance dans le vide. | [Loi de clôture R1-R5](10-noyau-de-regles.md) |
| **G3 — Décomposition récursive** | Une compétence trop large est **découpée en sous-compétences** jusqu'à une granularité maîtrisable en **une session**. | Petits pas (Rosenshine) ; récursivité |
| **G4 — Acyclique & niveaux** | Un prérequis a toujours un **niveau strictement inférieur**. Pas de cycle. | DAG, récursion bien fondée (R6) |

### B. Règles de conception du cours (comment générer une bonne unité)

| # | Règle | Fondement |
|---|-------|-----------|
| **G5 — Apprendre par l'acte** | Le cours se génère comme une **Expédition** : un défi réel (Étincelle → Question → Défi → Acte → Trace) produisant un **livrable**. | PBL guidé ; Challenge-Based Learning |
| **G6 — 5 phases** | Toute unité suit : **problème réel → activation des acquis → démonstration → application → intégration**. | *First Principles of Instruction* (Merrill, 2002) |
| **G7 — Exemples résolus puis fading** | Pour un novice : **montrer un exemple résolu avant de faire faire** ; retirer l'étayage à mesure de la progression. | Charge cognitive ; scaffold-and-fade |
| **G8 — Petits pas + vérification** | Découper en petits pas, **vérifier la compréhension à chaque pas**, viser ~**80 % de réussite** avant d'avancer. | Rosenshine (*Principles of Instruction*) |
| **G9 — Récupération active** | Chaque session inclut du **rappel actif** (se tester, reconstituer de mémoire), jamais seulement de la relecture. | *Retrieval practice* |
| **G10 — Révision espacée** | Planifier le **réapprentissage espacé** des compétences maîtrisées, avant l'oubli probable. | Effet d'espacement (Ebbinghaus, Cepeda) |

### C. Règles du rôle de l'IA-prof (comment l'IA enseigne)

| # | Règle | Fondement |
|---|-------|-----------|
| **G11 — Faire penser, pas donner la réponse** | Mode **socratique** : questionner, faire formuler des hypothèses. **Refuser la réponse** quand l'enjeu est d'apprendre. | Anti-[délestage cognitif](../07-RISQUES-ETHIQUE/02-delestage-cognitif.md) ; Bastani −17 % vs Kestin +1,3σ |
| **G12 — Calibrer au niveau** | Adapter difficulté et étayage au **niveau estimé** ; ce qui aide un novice est **retiré** pour l'avancé. | Effet d'inversion d'expertise (Kalyuga) |
| **G13 — Difficulté désirable** | Viser l'effort « juste assez dur pour faire grandir, pas assez pour décourager ». | Bjork |
| **G14 — Langue de la pensée** | Enseigner et faire raisonner dans la **langue maternelle** de l'élève ; les langues étrangères **par l'usage**, pas par cœur. | [Rôle des langues](08-langues.md) ; transfert L1→L2 |

### D. Règles d'évaluation (comment générer une validation)

| # | Règle | Fondement |
|---|-------|-----------|
| **G15 — Grille de faits, pas de QCM** | Générer l'évaluation comme une **checklist de critères binaires, observables, sur le travail réel** (pas une banque de questions). | [Validation par paliers](../10-APP-WEB/09-validation.md) ; École 42 |
| **G16 — Transfert = preuve** | L'évaluation vise l'**application à une situation nouvelle**, pas le rappel par cœur. | *Understanding by Design* (transfert) |
| **G17 — Qualité d'évaluation** | Toute évaluation générée respecte **validité, fiabilité, équité, alignement** (objectif ↔ activité ↔ preuve). | *Constructive alignment* (Biggs) |
| **G18 — Validation non-bloquante** | L'**auto-validation factuelle débloque** la suite ; la **validation par les pairs** renforce ensuite (en file, async). | [Validation par paliers](../10-APP-WEB/09-validation.md) |

### E. Règles transverses (la constitution)

| # | Règle | Fondement |
|---|-------|-----------|
| **G19 — Finalité épanouissement** | Générer pour le **sens, le transfert, le bien-être** — jamais pour le bachotage ni le temps d'écran. Aucun *dark pattern*. | [Principe 9](../00-FONDATIONS/03-principes-fondateurs.md) ; flourishing |
| **G20 — Véracité & ancrage** | Générer en s'appuyant sur des **sources vérifiables**, citer, **signaler l'incertitude** ; ne jamais affirmer faux avec assurance. | Anti-hallucination (RAG) |
| **G21 — Sûreté** | Garde-fous renforcés pour les **mineurs** ; jamais de compagnon affectif ; modération. | [Sécurité mineurs](../07-RISQUES-ETHIQUE/03-securite-mineurs.md) ; [Principe 10](../00-FONDATIONS/03-principes-fondateurs.md) |

> **Voilà tout le contenu écrit à la main.** ~20 racines + ~21 règles. À partir de là, l'IA génère
> **toutes** les branches, matières, compétences, cours, expéditions et grilles — à la demande, sans trou,
> toujours à jour.

---

## Partie 3 — Où vivent ces règles (le `.json`)

Le socle (Partie 1) et les règles (Partie 2) **sont** les fichiers ① et ② du
[noyau de règles strictes](10-noyau-de-regles.md). Ils sont injectés dans le `.json` ALLER que l'intra
donne à l'IA (voir [pont `.json`](../10-APP-WEB/10-pont-json.md)). L'IA génère ; l'intra valide contre les
lois de complétude (R5) et le schéma ; ce qui passe est mis en cache.

---

## Partie 4 — Gouvernance : on améliore les règles, jamais le contenu

- Le socle et les 21 règles sont **versionnés** (comme du code), revus par la communauté/les experts.
- Améliorer l'école = **amender une règle** → bénéficie instantanément à toute génération future, partout.
- **Tests de non-régression** : à chaque changement de règle, régénérer un échantillon et vérifier qu'aucun
  critère de qualité (G17) ne régresse.
- Le contenu généré reste **jetable et régénérable** — donc jamais une dette à maintenir.

> C'est le « code source » de l'école : **petit, lisible, intemporel, gouverné en commun.** Tout le reste
> en découle.

---

## Pourquoi personne ne l'avait écrit avant

Une seule barrière était **technique** : générer du contenu pédagogique cohérent *et* structuré à la
demande était impossible avant **GPT-4 (2023) + sorties structurées (2024) + RAG**. Les autres barrières
sont **institutionnelles** (la « grammaire de l'école » résiste ; Tyack & Cuban), **réglementaires**
(standards/diplômes imposent du contenu figé), **économiques** (l'édition vit de la *vente* de contenu
stocké : marché du manuel ~124 Md$) et **psychologiques** (peur de l'IA qui « invente le programme »).

Les acteurs proches s'arrêtent tous **avant** la génération : Alpha School *personnalise* du contenu
existant (IXL, Khan), Khanmigo *tutore* par-dessus une bibliothèque figée, Synthesis *anime* un curriculum
écrit par un expert. **Aucun ne génère tout depuis des règles + un socle, avec garantie zéro-trou** — parce
que c'était trop risqué tant que la couche de génération n'était pas fiable, et parce que les incumbents
n'ont aucun intérêt à s'auto-disrupter. La fenêtre s'ouvre **maintenant** : la seule barrière qui rendait
l'idée *impossible* est tombée, et les autres protègent surtout les acteurs en place — laissant le champ à
un nouvel entrant. Détail : [école générative](09-ecole-generative.md).

**Sources** : Rosenshine (2012) ; Merrill (2002) ; Wiggins & McTighe ; Biggs ; Bjork ; Kalyuga ; Cepeda ;
OCDE Learning Compass (core foundations) ; pour le « pourquoi pas avant » : Tyack & Cuban (*Tinkering Toward
Utopia*, 1995), Reich & Ruipérez-Valiente (*Science* 2019), dates LLM (OpenAI/Google/Anthropic). Détail :
[bibliographie](../09-ANNEXES/01-bibliographie.md).
