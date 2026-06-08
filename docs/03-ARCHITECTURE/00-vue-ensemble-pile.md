# Vue d'ensemble : la pile Dowze

> *Pourquoi une « pile », et comment les six couches coopèrent pour tenir les sept exigences qu'aucune
> solution actuelle ne tient ensemble.*

---

## La pile

```
┌──────────────────────────────────────────────────────────────┐
│  6 · LE SOCLE        Gouvernance, financement, équité, sûreté  │  ← le commun
├──────────────────────────────────────────────────────────────┤
│  5 · LA PREUVE       Passeport de compétences vérifiable       │  ← la confiance
├──────────────────────────────────────────────────────────────┤
│  4 · LES CERCLES     Pairs, guildes, foyers, mentorat humain   │  ← le lien
├──────────────────────────────────────────────────────────────┤
│  3 · LES QUÊTES      Projets & défis réels, maîtrise par l'acte│  ← le faire
├──────────────────────────────────────────────────────────────┤
│  2 · LE MENTOR       L'IA-tuteur personnel (scaffold & fade)   │  ← l'accompagnement
├──────────────────────────────────────────────────────────────┤
│  1 · L'ATLAS         Carte vivante et ouverte des savoirs      │  ← le savoir
└──────────────────────────────────────────────────────────────┘
       Accès via n'importe quel terminal (smartphone, PC, borne de Foyer)
```

---

## Pourquoi une pile ?

Parce que le diagnostic est clair : **les briques existent, l'architecture manque.** Une pile exprime que
chaque couche *repose sur* les précédentes et *sert* les suivantes — comme la pile TCP/IP a permis
l'internet en reliant des briques qui existaient déjà.

Chaque couche résout *un* problème qu'une solution existante résout déjà bien isolément. La nouveauté de
Dowze n'est aucune couche prise seule — c'est leur **assemblage cohérent**.

---

## Ce que fait chaque couche, et le piège qu'elle évite

| Couche | Fonction | Piège évité (solution qui a échoué dessus) |
|--------|----------|--------------------------------------------|
| **1 · Atlas** | Cartographier et relier tout le savoir | Le programme figé qui se périme |
| **2 · Mentor** | Accompagner personnellement | L'IA qui pense à votre place (−17 %, Bastani) |
| **3 · Quêtes** | Faire apprendre par l'acte | Le cours passif sans finalité (MOOC, 88 % d'abandon) |
| **4 · Lien humain** | Empêcher l'isolement | L'apprentissage solitaire (MOOC, OLPC) |
| **5 · Preuve** | Attester ce qu'on sait faire | Le diplôme qui ne prouve rien (paradoxe 1/700) |
| **6 · Socle** | Gouverner, financer, protéger | La capture privée et la fragilité (BloomTech, LAUSD) |

---

## Comment les couches coopèrent : un exemple concret

Suivons **Amina, 34 ans**, qui veut apprendre à analyser des données pour son travail.

1. **Atlas** — Amina entre « analyse de données ». L'Atlas lui montre la compétence dans le graphe, ses
   prérequis (statistiques de base, un peu de code), et plusieurs chemins possibles selon ce qu'elle sait
   déjà.
2. **Mentor** — Le Mentor évalue son point de départ (elle maîtrise déjà les bases en tableur), calibre
   la difficulté, et lui propose un chemin. Quand elle bloque, il **questionne** au lieu de donner la
   réponse.
3. **Quêtes** — Plutôt qu'un cours, elle reçoit une Quête réelle : *analyser les ventes réelles de la
   petite entreprise de son cousin et produire un tableau de bord utile.* Elle apprend en faisant.
4. **Lien humain** — Elle rejoint un **Cercle** de 4 personnes menant des quêtes voisines (redevabilité
   mutuelle) et une **Guilde** « Data » où des praticiens plus avancés la conseillent. Elle ne lâche pas,
   parce que son Cercle compte sur elle.
5. **Preuve** — Le tableau de bord livré (qui *sert vraiment*), évalué par ses pairs et un maître de
   Guilde, génère une **preuve vérifiable** dans son Passeport. Un employeur pourra la vérifier en
   quelques secondes.
6. **Socle** — Tout cela est gratuit, ses données lui appartiennent, le système est gouverné en commun, et
   conçu pour qu'elle apprenne *sainement* (pas pour maximiser son temps d'écran).

Plus tard, Amina **enseignera** l'analyse de données à un nouveau venu de sa Guilde — bouclant
*Apprendre → Faire → Enseigner*, ce qui consolide son savoir et nourrit le commun.

---

## Les flux entre couches

- **L'Atlas alimente tout** : Mentor, Quêtes et Preuve référencent les mêmes compétences (un langage
  commun).
- **Le Mentor s'appuie sur l'Atlas** (pour le contenu et les prérequis) et **orchestre les Quêtes** (les
  propose, les calibre, accompagne).
- **Les Quêtes produisent les preuves** qui alimentent le Passeport — automatiquement.
- **Le lien humain (couche 4) traverse tout** : les pairs co-évaluent les Quêtes, les Guildes enrichissent
  l'Atlas, les Foyers donnent accès. C'est le **tissu** qui empêche le système d'être froid et solitaire.
- **Le Socle (couche 6) garantit** que tout le reste respecte les [12 principes](../00-FONDATIONS/03-principes-fondateurs.md).

---

## Les sept exigences, tenues ensemble

C'est l'unique combinaison qui satisfait *simultanément* :

| Exigence | Couche(s) responsable(s) |
|----------|--------------------------|
| Personnalisation | Mentor (2) + Atlas (1) |
| Motivation par le projet réel | Quêtes (3) |
| Lien humain anti-décrochage | Cercles/Guildes/Foyers (4) |
| Preuve vérifiable | Passeport (5) |
| Équité | Socle (6) + offline-first |
| Continuité de toute la vie | Toute la pile + [Parcours de vie](../04-PARCOURS-DE-VIE/) |
| Gouvernance non capturable | Socle (6) |

Aucune solution actuelle ne tient ces sept-là à la fois. C'est l'invention de Dowze.

**Suite** : explorez chaque couche, en commençant par l'[Atlas](01-atlas.md).
