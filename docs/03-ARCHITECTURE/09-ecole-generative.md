# L'école générative : stocker des règles, pas du contenu

> *Le principe le plus structurant du projet. Une école traditionnelle **stocke du contenu** (programmes,
> cours, manuels) — et ce contenu est **périmé même quand on le met à jour**, parce qu'on le met à jour
> tous les 5-10 ans alors que le monde change en mois. Dowze fait l'inverse : il **ne stocke pas le
> contenu**, il stocke un **petit ensemble de RÈGLES GÉNÉRATIVES intemporelles** qui permettent à l'IA de
> **générer** compétences, cours et évaluations à la demande — toujours à jour. L'intra garde la grammaire ;
> l'IA produit le contenu.*

---

## Le principe : « l'usage infini de moyens finis »

C'est une idée vérifiée dans des dizaines de domaines : un **petit jeu fini de règles** produit une
**variété infinie de sorties valides**.

| Domaine | Règles finies stockées | Produit infini généré |
|---------|------------------------|------------------------|
| Langage (Chomsky) | une grammaire | toutes les phrases possibles |
| Plantes / fractales (L-systèmes) | quelques règles de réécriture | structures infiniment détaillées |
| Jeux (No Man's Sky) | algorithme + graine | 18 quintillions de planètes |
| IA (Constitutional AI, Anthropic) | une « constitution » de principes | tous les comportements de l'IA |
| Logiciel (Infrastructure-as-Code) | le code source déclaratif | l'infrastructure reconstruite à volonté |
| **Dowze (école générative)** | **une grammaire pédagogique** | **compétences, cours, grilles à l'infini** |

> On ne stocke pas toutes les phrases d'une langue — on stocke sa grammaire. Dowze ne stocke pas tous les
> cours — il stocke sa **grammaire pédagogique**.

L'argument d'ingénierie est le même que l'**Infrastructure-as-Code** : stocker le **générateur** (règles +
processus) est infiniment plus durable que stocker l'**artefact** (le contenu fini). Le contenu devient un
**produit jetable et reconstructible à tout moment — donc jamais périmé.**

---

## Ce qu'on stocke (intemporel) vs ce qu'on génère (jetable)

```
┌──────────────────────────────────────────────────────────────────┐
│  STOCKÉ — petit, stable, intemporel (le « code source » de l'école)│
│                                                                    │
│  ① RÈGLES GÉNÉRATIVES  — comment générer une compétence, un cours, │
│     (la grammaire)        une grille, comment être prof            │
│  ② OSSATURE MINIMALE   — un graphe léger de compétences durables   │
│     (le squelette)        + leurs prérequis (PAS de contenu)       │
│  ③ SCHÉMAS             — le format valide de chaque sortie         │
│  ④ PRINCIPES           — qualité, éthique, sûreté, véracité        │
└───────────────────────────────┬────────────────────────────────────┘
                                 │  + GRAINE (profil élève + contexte + date)
                                 ▼
┌──────────────────────────────────────────────────────────────────┐
│  GÉNÉRÉ à la demande par l'IA — illimité, toujours à jour, jetable │
│  les cours · les expéditions · les grilles · les exercices ·       │
│  les exemples · les explications · le « prof »                     │
└──────────────────────────────────────────────────────────────────┘
```

**Exemple concret (la grille).** On ne stocke **pas** une grille par compétence (ça daterait, et il y en
aurait une infinité à maintenir). On stocke **une seule règle** : *« pour générer une grille de validation,
produis une checklist de critères binaires, observables, portant sur le travail réel, alignés sur la
compétence visée (backward design). »* → l'IA génère la grille de *n'importe quelle* compétence à la
demande, toujours cohérente. **Une règle remplace une infinité de grilles.**

---

## Les règles intemporelles (pourquoi elles ne datent pas)

On ne peut faire reposer une école sur des règles que si ces règles **ne se périment pas**. Bonne nouvelle :
les sciences de l'apprentissage et la conception pédagogique fournissent des invariants **stables depuis
des décennies**, parce qu'ils décrivent **comment fonctionne l'esprit humain**, pas *quoi* enseigner.

| Type de règle | Exemples (intemporels) | Source |
|---------------|------------------------|--------|
| **Règles cognitives** | récupération active, répétition espacée, exemples résolus avant pratique, petits pas, ~80 % de réussite | Rosenshine ; Deans for Impact |
| **Règles de conception** | backward design (objectif → preuve → activité) ; 5 phases de Merrill ; niveaux de Bloom | Wiggins & McTighe ; Merrill 2002 |
| **Règles d'évaluation** | validité, fiabilité, équité, alignement (Biggs) | constructive alignment |
| **Règles de qualité/éthique** | véracité (ancrage source), pas de biais, sûreté mineurs | la [constitution Dowze](../00-FONDATIONS/03-principes-fondateurs.md) |

> Ces règles décrivent la **forme** d'un bon apprentissage, indépendamment du sujet. Elles valaient en 1990,
> elles vaudront en 2090. C'est exactement ce qu'on veut stocker. (Distinction durable/périssable : on
> stocke ce qui a une **demi-vie longue**, on génère ce qui a une demi-vie courte — voir
> [Cursus](07-cursus-et-specialisation.md) et [Atlas vivant](01-atlas.md).)

---

## Comment on garantit zéro trou (la loi de clôture)

Une IA **livrée à elle-même** générerait des contenus lacunaires. C'est précisément pourquoi le CORE
impose des **règles strictes de complétude** qui rendent le trou **impossible par construction** — ce
n'est pas laissé au hasard.

> **La loi de clôture** : on ne génère jamais une compétence seule, mais **avec toute sa chaîne de
> prérequis jusqu'aux racines**. Une compétence n'est publiée que si tout ce dont elle dépend existe déjà.
> Plus deux vérifications dures avant publication : (a) **aucun prérequis ne pointe vers le vide**,
> (b) **toute compétence non-racine a au moins un prérequis**. Un parcours troué **ne peut pas franchir la
> validation**.

C'est le **[noyau de règles strictes (R1-R8)](10-noyau-de-regles.md)** : un théorème, pas un espoir. Même
mécanisme éprouvé que les gestionnaires de paquets (aucune dépendance manquante) et les systèmes de build
(graphe complet, ou échec bruyant). **Zéro trou, garanti.**

**La réconciliation** (ce qui rend le système fiable) : on combine les règles avec deux choses.

### 1. Une ossature minimale — **elle aussi générée par l'IA, pas créée à la main**
On a besoin d'un **graphe léger de compétences durables + leurs prérequis** (des *relations*, pas du
contenu) pour garantir la **complétude** (tout est-il couvert ?) et la **cohérence** (aucun prérequis
violé ? — *mesurable* : cohérence = 0 prérequis enfreint). **Mais on ne le construit pas à la main.** Comme
tout le reste, il est **généré par l'IA via un prompt + `.json`** — et la recherche confirme que c'est
faisable et fiable *à condition* de remplacer l'expert humain par une pile de validateurs automatiques.

**Comment l'ossature se génère sans main humaine** (chaîne validée par la recherche 2024-2026) :

1. **Génération paresseuse (lazy)** : on ne génère pas tout le graphe d'un coup. Quand un apprenant arrive
   à une compétence, l'IA génère **juste le voisinage local** (ses prérequis). Le graphe **émerge chemin
   par chemin** (modèle `iText2KG` : génération incrémentale pilotée par un blueprint qui est littéralement
   un `.json`).
2. **Génération séparée de la validation** (leçon clé) : le **LLM génère** (créatif), un **validateur
   déterministe filtre** (le `.json` de règles encode des contraintes vérifiables : graphe sans cycle =
   DAG, schéma respecté, chaque arête citée à une source…). *Ce qui passe le validateur est cohérent par
   construction* — comme la génération procédurale sous contraintes (ASP). Les défauts **structurels**
   (cycles, prérequis qui se mordent la queue) sont détectés et corrigés **à 100 %, automatiquement.**
3. **Ancrage sur sources (RAG)** : l'IA génère le voisinage **à partir de référentiels récupérés**
   (ESCO, manuels, standards) — utilisés comme *sources qu'elle lit*, **pas comme un import construit à la
   main**. C'est le plus gros levier contre les trous et les hallucinations.
4. **Consensus multi-passes** : générer le voisinage 3-5 fois, ne garder que les arêtes sur lesquelles les
   passes **convergent**. Les arêtes « controversées » signalent les trous probables. ⚠️ **On ne s'appuie
   PAS sur l'auto-correction nue** : la recherche prouve (Huang et al., ICLR 2024) qu'un LLM ne fiabilise
   pas son propre raisonnement en se relisant seul.
5. **Générer → valider → cacher** : une portion validée est **stockée et réutilisée** (déterminisme et
   cohérence entre apprenants). On **régénère uniquement sur invalidation** (trou signalé, règles
   modifiées), jamais par défaut. Le résultat devient une donnée — mais **personne ne l'a écrite à la
   main.**
6. **La loi de clôture garantit zéro trou** : générer une compétence, c'est générer **toute sa chaîne de
   prérequis jusqu'aux racines** — une compétence n'est publiée que si tout ce dont elle dépend existe. Le
   trou (prérequis manquant) est **impossible par construction**, vérifié par des règles strictes avant
   toute publication. C'est le **[noyau de règles strictes](10-noyau-de-regles.md)** (R1-R8) qui le
   garantit mathématiquement.

> **Donc : aucune ossature à créer à la main, et aucun trou.** Si une portion de graphe est nécessaire,
> l'intra l'**ajoute en la générant** (prompt + `.json` → IA → validation par la loi de clôture → cache).
> C'est la logique « les règles, pas le contenu » poussée jusqu'au squelette : **une règle de génération
> close** remplace tout graphe écrit à la main, et **garantit la complétude**.

> Ce que les règles garantissent : un parcours **toujours complet** (zéro prérequis manquant, zéro
> orphelin), **par construction**. Ce qui continue de s'**affiner** avec l'usage, ce n'est pas la
> complétude du chemin (garantie), mais la **finesse pédagogique** de chaque étape — qui s'améliore en
> continu sans jamais laisser de trou dans le parcours. Détail : [noyau de règles strictes](10-noyau-de-regles.md).

### 2. Des garde-fous de génération (l'empilement)
Aucune technique seule ne suffit ; on empile (effet mesuré le plus fort : l'ancrage documentaire fait
passer la qualité de <50 % à 75-80 % dans une étude de terrain) :

- **Ancrage sur sources vérifiées (RAG)** + graphe → contre l'hallucination et les trous.
- **Validation par schéma** : toute sortie de l'IA est **validée contre un JSON Schema** avant d'être
  servie → conforme *par construction*, pas par confiance (voir [pont `.json`](../10-APP-WEB/10-pont-json.md)).
- **Boucle d'auto-critique** (modèle Constitutional AI : génère → critique selon les principes → révise).
- **Validation humaine par les pairs/experts** *a posteriori* (la [validation par paliers](../10-APP-WEB/09-validation.md)).

---

## Comment ça marche concrètement (avec le pont `.json`)

```
1. L'intra prend : règles (①④) + le nœud visé du squelette (②) + la graine (élève+contexte+date)
2. → elle compose un .json ALLER (prompt génératif + schéma de sortie attendu ③)
3. → l'élève le donne à son IA → l'IA GÉNÈRE le contenu frais (cours, grille, exercice…)
4. → l'IA rend un .json RETOUR → l'intra le VALIDE contre le schéma (rejette si non conforme)
5. → contenu servi, toujours à jour. Jetable : on peut le régénérer à tout moment.
```

L'intra ne contient donc **aucun cours, aucune grille, aucune compétence détaillée à maintenir** — juste
les règles, le squelette et les schémas. **Le contenu n'est jamais stocké : il est généré, validé, utilisé,
et oublié.** D'où : **toujours à jour, en tout temps, sans maintenance de contenu.**

---

## La gouvernance porte sur les RÈGLES, pas le contenu

C'est ce qui rend le système durable et améliorable (modèle *policy-as-code*) :

- La communauté et les experts **n'éditent jamais le contenu** (jetable). Ils éditent et améliorent **les
  règles et le squelette** — qui se propagent automatiquement à toute génération future.
- Les règles sont **versionnées** (comme du code), avec **revue** à chaque changement.
- **Tests de non-régression** : à chaque modif de règle, on régénère un échantillon et on vérifie qu'aucun
  critère de qualité ne régresse.
- **Détection de dérive** : suivi dans le temps du taux d'hallucination, de la cohérence du graphe, des
  indices de biais.

> Améliorer l'école = améliorer **quelques règles**, pas réécrire des milliers de cours. Une amélioration
> de règle bénéficie *instantanément* à toutes les générations suivantes, partout, pour toujours.

---

## Pourquoi ça bat l'obsolescence (la synthèse)

| École traditionnelle | École générative (Dowze) |
|----------------------|--------------------------|
| Stocke du **contenu** | Stocke des **règles + un squelette** |
| Périmée même mise à jour (cycle 5-10 ans) | **Toujours à jour** (régénérée à la demande) |
| Maintenir = réécrire des programmes | Maintenir = **amender quelques règles** |
| Le savoir daté est figé dedans | Le contenu est **jetable et régénéré frais** |
| Une infinité de contenus à créer/tenir | **Un petit noyau** génère l'infini |

> **L'invention** : Dowze n'est pas un stock de savoir qui vieillit — c'est un **moteur qui régénère le
> savoir en continu**, gouverné par des règles intemporelles et borné par un squelette stable. C'est une
> école qui **ne peut pas devenir obsolète**, par construction.

---

**La complétude est garantie** (zéro trou, par la loi de clôture R1-R8 — c'est un théorème). Ce qui
s'**améliore en continu** avec l'usage, ce n'est pas la complétude du parcours, mais la **finesse
pédagogique** de chaque étape générée (clarté, exemples, profondeur) — sans jamais introduire de trou. Les
invariants pédagogiques sont solides et consolidés ; les techniques de fiabilisation de la génération
s'affinent dans le temps via la gouvernance des règles.

**Sources** : Chomsky (*Aspects*, 1965, d'après Humboldt) ; Lindenmayer (L-systèmes) ; PCG (No Man's Sky) ;
Anthropic (Constitutional AI, 2022) ; Infrastructure-as-Code ; Reggio Emilia (curriculum émergent) ;
Rosenshine (2012) ; Deans for Impact (*Science of Learning*) ; Merrill (2002) ; Wiggins & McTighe ; Biggs
(constructive alignment) ; études 2024-2025 sur les risques et garde-fous de la génération (arXiv
2509.21972 ; KG-RAG ; RAG lesson planning Ouganda). Détail : [bibliographie](../09-ANNEXES/01-bibliographie.md).
