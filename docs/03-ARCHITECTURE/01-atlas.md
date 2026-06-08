# Couche 1 — L'ATLAS · la carte vivante des savoirs

> *Le problème résolu : la rigidité et l'obsolescence du programme standardisé
> ([faille 6](../01-DIAGNOSTIC/02-failles-structurelles.md)).*

---

## L'idée

L'Atlas n'est ni un programme, ni une liste de matières. C'est une **carte** — un graphe vivant de
**toutes les compétences humaines** — que l'on *traverse* par les chemins qui font sens pour soi.

- Les **nœuds** sont des compétences au sens large :
  - **savoirs** (comprendre la photosynthèse, l'inflation, une période historique) ;
  - **savoir-faire** (souder, coder, négocier, cuisiner, rédiger) ;
  - **savoir-être** (réguler ses émotions, coopérer, argumenter) ;
  - **capacités corporelles, civiques, esthétiques** (un geste sportif, comprendre ses droits, lire une
    œuvre).
- Les **liens** expriment les relations entre compétences :
  - *prérequis* (« ceci en exige d'abord cela ») ;
  - *ouverture* (« ceci ouvre vers cela ») ;
  - *parenté* (« ces compétences sont voisines »).

On n'avance pas dans un « niveau scolaire » : on **traverse un territoire**.

> ⚠️ **L'Atlas est la carte, pas le parcours.** L'élève ne choisit **pas** librement son chemin dans
> l'Atlas : il existe un **itinéraire complet et prescrit** à travers la carte — le **Cursus** (tronc commun
> d'éducation générale, identique pour tous, puis spécialisation plus tard). L'Atlas *contient tout le
> savoir possible* ; le Cursus *décide par où l'on passe*. Voir
> [le Cursus & la spécialisation](07-cursus-et-specialisation.md). Le « libre choix » ne concerne que la
> phase de spécialisation et l'apprentissage adulte — pas le tronc commun.

> Spécification du modèle de données (graphe, schéma des nœuds, versionnage) :
> [05-TECHNIQUE/02-modele-donnees-atlas.md](../05-TECHNIQUE/02-modele-donnees-atlas.md).

---

## Les propriétés clés

### Ouvert et fédéré
Co-écrit et curé par des communautés d'experts, de praticiens et de pairs, assistés par l'IA — à la
manière de Wikipédia, mais pour les compétences. Revue par les pairs, versionnage, traçabilité des
sources. Personne ne « possède » l'Atlas.

### Vivant, infini, et jamais figé
L'Atlas est une **carte qu'on n'a jamais fini d'explorer, et qui grandit pendant qu'on l'explore.**

- **Infini** : le savoir humain est en **explosion mesurée** — la science double tous les **~9 à 17 ans**
  (Bornmann & Mutz ; ~7 millions d'articles/an). *(⚠️ on n'emploie pas le mythe « le savoir double toutes
  les 12 heures » : c'est une erreur d'attribution — il parlait des *données*, pas du savoir.)* La carte
  n'affiche donc **jamais « 100 % exploré »** : elle montre un **territoire sans bord**.
- **Non figé** : le savoir se **révise**. Chaque nœud porte un **statut épistémique** (établi / en débat /
  révisé / obsolète) et une **« demi-vie » indicative** selon son domaine (les maths ne périment quasi pas ;
  la médecine ou la tech, vite). Quand le consensus bouge (ex. Pluton n'est plus une planète), le nœud
  **change de statut** et son **historique** raconte l'évolution du savoir — une fonctionnalité, pas un bug
  (Arbesman, *The Half-Life of Facts*).
- **Une frontière personnelle d'exploration** : pour chaque apprenant, la carte distingue le territoire
  **maîtrisé** (éclairé), la **lisière** — ce qu'il est *prêt à apprendre maintenant* (sa zone proximale,
  calculée par les prérequis du graphe) — et le territoire **encore verrouillé**. C'est un « brouillard de
  guerre » qui se lève au fil de l'exploration.
- **Apprendre à désapprendre** : puisque le savoir évolue, Dowze valorise la **révision de ses croyances**
  (humilité épistémique). Quand un nœud « maîtrisé » devient obsolète, l'apprenant est invité à
  l'actualiser — *désapprendre* est une compétence, pas un échec.
- **Maintenu vivant par la communauté** (modèle Wikidata : ~90 M d'entités, entièrement versionné) : les
  **Guildes** (couche 4) entretiennent les branches qui les concernent — mise à jour **continue**, pas un
  programme refait tous les dix ans. C'est la réponse directe à la faille de l'obsolescence.

### Universel mais pas uniforme
La même carte mondiale, mais chaque culture/langue peut l'**enrichir** de ses propres branches
(artisanats, langues, savoirs locaux, histoire régionale). Le multilinguisme est radical : les langues
minoritaires sont des branches, pas des après-coups (rappel : Hole-in-the-Wall a échoué faute de contenu
dans la langue des enfants).

### Agnostique au support
Chaque nœud pointe vers les **meilleures ressources existantes, quel que soit le format** : une vidéo
YouTube, un article, un simulateur interactif, un livre, un humain à rencontrer dans un Foyer. **Dowze ne
réinvente pas tout le contenu du monde — il l'organise et le relie.** C'est précisément ce que YouTube et
les MOOC ne font pas (du contenu sans carte).

### Plus large que « employable »
L'Atlas inclut **explicitement** le civique, l'artistique, l'émotionnel, le corporel, le jeu. Une
éducation qui ne formerait qu'à l'emploi serait une régression, pas un progrès
([principe](../00-FONDATIONS/03-principes-fondateurs.md) : « une vie n'est pas un CV »).

---

## Sur quoi on construit (ne pas repartir de zéro)

L'Atlas s'amorce sur des **référentiels de compétences publics, mûrs et interopérables** :

- **ESCO** (Commission européenne) : 3 piliers (occupations / compétences / qualifications), **~13 939
  compétences**, multilingue.
- **O*NET** (US Dept. of Labor) : >1 000 professions, modèle de contenu détaillé.
- Un **crosswalk officiel ESCO ↔ O*NET** existe déjà.

⚠️ **Limite assumée** : ces référentiels sont **orientés emploi**, pas pédagogie. Ils décrivent mal les
savoirs fondamentaux/académiques et le non-professionnel. L'Atlas les utilise comme **squelette de
départ** pour le volet « compétences professionnelles », puis l'enrichit massivement (savoirs
fondamentaux, arts, civisme, savoir-être) via les communautés.

---

## Anti-désinformation : liberté d'apprendre ≠ relativisme

Un Atlas ouvert n'est **pas** un far-west. La curation est **ouverte mais exigeante** :

- chaque nœud et chaque ressource ont une **provenance** traçable et une **revue** par des experts/Guildes ;
- versionnage et historique (qui a modifié quoi, quand, pourquoi) ;
- signalement et arbitrage par la gouvernance (couche 6).

La liberté d'apprendre ne signifie pas que tous les contenus se valent. Sur les faits établis (santé,
sciences), l'Atlas privilégie le consensus scientifique et signale les controverses honnêtement. Voir
[gouvernance](../06-GOUVERNANCE-ECONOMIE/01-gouvernance-commun.md) et
[équité/biais](../07-RISQUES-ETHIQUE/04-equite-biais.md).

---

## Ce que l'apprenant voit

Concrètement, l'Atlas se présente comme :

- une **recherche** (« je veux apprendre X ») qui situe X dans la carte ;
- une **vue de carte** montrant les prérequis, les voisins et les ouvertures de X ;
- pour chaque compétence : son **seuil de maîtrise**, les **preuves attendues**, et les **ressources**
  recommandées (multi-format) ;
- son **propre parcours** surligné : où il en est, où il peut aller.

Le Mentor (couche 2) utilise cette même carte pour proposer des chemins personnalisés ; les Quêtes
(couche 3) y sont rattachées ; le Passeport (couche 5) référence les mêmes nœuds. **L'Atlas est le langage
commun de toute la pile.**

---

## Ce que l'Atlas n'est pas

- ❌ Un programme officiel imposé.
- ❌ Une bibliothèque de contenus produits par Dowze (il *pointe* vers les contenus du monde).
- ❌ Une taxonomie figée (il est vivant et versionné).
- ❌ Limité aux compétences « rentables » (il couvre toute l'expérience humaine).

**Suite** : [le Mentor](02-mentor.md), qui guide la traversée de l'Atlas.
