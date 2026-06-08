# Spécification — le modèle de données de l'Atlas

> *Comment représenter « toute la connaissance humaine » comme un graphe utilisable, vivant et fédéré.*

---

## Le graphe de compétences

L'Atlas est un **graphe orienté** : des **nœuds** (compétences) reliés par des **arêtes** typées
(relations).

### Schéma d'un nœud (compétence)

```yaml
noeud:
  id: "noos:skill:data-viz-tableau-de-bord"   # identifiant stable et unique
  libelle:
    fr: "Concevoir un tableau de bord de données"
    en: "Design a data dashboard"
    # ... autres langues (branches)
  type: "savoir-faire"        # savoir | savoir-faire | savoir-etre | corporel | civique | esthetique
  description: "..."
  domaines: ["data", "communication"]
  seuil_maitrise:
    description: "Livrer un tableau de bord exploité par un utilisateur réel, lisible et exact."
    niveau: "compagnon"       # novice | compagnon | maitre  (échelle de Guilde)
  preuves_attendues:           # ce qui peut valider la compétence (couche 5)
    - type: "livrable_reel"
    - type: "revue_pairs"
    - type: "attestation_guilde"
  ressources:                  # pointeurs multi-format, agnostiques au support
    - {format: "video", url: "...", langue: "fr", licence: "CC-BY", qualite: 0.0}
    - {format: "article", url: "...", langue: "fr"}
    - {format: "simulateur", url: "..."}
    - {format: "foyer", ref: "atelier-data-lyon"}   # un humain / lieu
  mappings:                    # interopérabilité
    esco: "..."
    onet: "..."
  provenance:
    curateurs: ["guilde:data"]
    sources: ["..."]
  version: "2026.2"
  historique: [ ... ]          # versionnage (qui, quand, pourquoi)
```

### Types d'arêtes (relations)

| Type | Sens | Exemple |
|------|------|---------|
| `prerequis` | A exige d'abord B | « tableau de bord » exige « bases de statistiques » |
| `ouvre_vers` | A prépare à C | « bases de stats » ouvre vers « inférence » |
| `voisin_de` | parenté | « tableur » voisin de « SQL » |
| `compose` | A fait partie de D | « doubler une recette » compose « proportions » |
| `equivaut` | équivalence inter-référentiels | nœud Dowze ↔ compétence ESCO |

---

## Pourquoi un graphe (et pas un arbre / une liste)

- Un **arbre** (programme scolaire) impose un chemin unique et une hiérarchie figée → c'est précisément la
  rigidité qu'on fuit.
- Un **graphe** autorise des **chemins multiples** vers une même compétence (principe « la personne au
  centre ») et reflète la vraie structure du savoir (interconnectée, non linéaire).
- Il permet au [Mentor](03-conception-mentor-IA.md) de calculer un **chemin personnalisé** : partir de ce
  que l'apprenant maîtrise déjà, vers ce qu'il vise, en respectant les prérequis.

---

## Amorçage : ne pas partir de zéro

Le squelette « compétences professionnelles » est importé de référentiels **mûrs et interopérables** :

- **ESCO** (UE) : ~13 939 compétences, multilingue, 3 piliers.
- **O*NET** (US) : >1 000 professions, modèle de contenu.
- **Crosswalk ESCO ↔ O*NET** officiel pour la cohérence transatlantique.

⚠️ Ces référentiels sont **orientés emploi** : ils couvrent mal les savoirs fondamentaux, académiques,
artistiques, civiques, émotionnels. L'Atlas les complète massivement via la **curation communautaire**
(Guildes, éducateurs, experts), pour rester fidèle au principe « une vie n'est pas un CV ».

---

## Gouvernance des données : ouvert mais exigeant

Comme Wikipédia pour les compétences, mais avec des garde-fous renforcés :

- **Curation par les Guildes** (couche 4) : chaque Guilde maintient sa branche → l'Atlas reste **vivant**
  et à jour (réponse à l'obsolescence).
- **Provenance et revue** : chaque nœud et ressource a une source traçable et une revue par les pairs.
- **Versionnage** : tout changement est historisé (qui, quand, pourquoi) ; on peut revenir en arrière.
- **Arbitrage** : la gouvernance (couche 6) tranche les litiges et lutte contre la désinformation.
  *Liberté d'apprendre ≠ relativisme sur les faits* : sur les sujets établis (santé, sciences), l'Atlas
  privilégie le consensus scientifique et signale honnêtement les controverses.

Voir [gouvernance](../06-GOUVERNANCE-ECONOMIE/01-gouvernance-commun.md) et
[équité/biais](../07-RISQUES-ETHIQUE/04-equite-biais.md).

---

## Qualité et lutte contre l'« inflation de contenu »

Le risque (vu sur Open Badges, YouTube) est la prolifération de contenus de faible valeur. Mesures :

- **Évaluation des ressources** par les pairs et l'usage (quelles ressources font réellement apprendre ?).
- **Signalement** des contenus obsolètes ou erronés.
- **Pas de pollution commerciale** : aucune mise en avant payante (pas de modèle publicitaire).

---

## Multilinguisme et savoirs locaux

Chaque nœud porte ses libellés/ressources dans plusieurs langues ; les **langues et savoirs minoritaires
sont des branches à part entière**, pas des traductions secondaires. C'est une exigence d'équité (leçon
de l'échec de Hole-in-the-Wall). Vigilance sur le biais anglophone des LLM (voir
[équité/biais](../07-RISQUES-ETHIQUE/04-equite-biais.md)).

---

## Interfaces (API)

L'Atlas expose des API ouvertes : recherche de compétences, récupération d'un sous-graphe (prérequis,
voisins, ouvertures), résolution de chemin, et mappings vers ESCO/O*NET/CLR. Détail :
[interopérabilité](06-interoperabilite-standards.md).
