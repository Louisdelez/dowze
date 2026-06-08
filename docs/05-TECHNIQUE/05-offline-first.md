# Spécification — l'architecture offline-first

> *Le mur de l'accès (2,6 milliards hors ligne, 2 Go/mois en pays pauvre) n'est pas une contrainte
> secondaire : c'est un **principe d'architecture**. Voici comment Dowze fonctionne sans connexion
> permanente.*

---

## Pourquoi offline-first (rappel des faits)

- **2,6 milliards** d'humains hors ligne (ITU 2024), 1,8 milliard en zone rurale.
- **2 Go/mois** de trafic mobile en pays à faible revenu (vs 16 Go en pays riche) → la vidéo HD en continu
  exclut.
- Coût d'un abonnement ≈ **1/3 du revenu mensuel** en pays pauvre.
- Modèle **validé** par Kolibri (Learning Equality) et RACHEL.

Voir [fracture numérique](../01-DIAGNOSTIC/06-fracture-numerique.md) et
[équité](../04-PARCOURS-DE-VIE/06-equite-inclusion.md).

---

## Les quatre modes de fonctionnement

Dowze s'adapte à la connectivité disponible, du mieux au pire :

| Mode | Connexion | Fonctionnement |
|------|-----------|----------------|
| **En ligne** | bonne | Tout disponible : Mentor cloud, vidéo, sync temps réel |
| **Intermittent** | sporadique | Cache local + sync opportuniste quand le réseau passe |
| **Local (Foyer)** | LAN sans internet | Serveur de Foyer (type RACHEL) sert Atlas + Mentor léger en réseau local |
| **Hors-ligne pur** | aucune | Tout depuis le cache local ; sync différée ; « sneakernet » |

---

## Le modèle « seed + sync » (inspiré de Kolibri)

```
   [INTERNET]
       │  (1) un appareil "seed" télécharge une fois
       ▼
  ┌─────────────┐   (2) partage en réseau local (Foyer, WiFi, Bluetooth)
  │ Appareil/   │──────────────────────────────────────────────┐
  │ Serveur     │                                               ▼
  │ "seed"      │        ┌──────────┐   ┌──────────┐   ┌──────────┐
  │ (Foyer)     │        │ terminal │   │ terminal │   │ terminal │
  └─────────────┘        │ apprenant│   │ apprenant│   │ apprenant│
       │                 └──────────┘   └──────────┘   └──────────┘
       │  (3) un appareil peut être transporté physiquement
       ▼     vers une communauté isolée ("sneakernet")
  [communauté sans réseau]
```

1. Un appareil « seed » (souvent un **serveur de Foyer**) télécharge le contenu une fois là où il y a du
   réseau.
2. Il **partage en réseau local** (WiFi local, Bluetooth) avec les terminaux des apprenants — sans
   internet.
3. Si une communauté n'a aucun réseau, l'appareil peut être **transporté physiquement** (« sneakernet »).

---

## Ce qui est mis en cache localement

- **Tranches d'Atlas** pertinentes (les compétences que l'apprenant vise + prérequis), avec leurs
  ressources **légères** (texte d'abord, audio, images compressées ; vidéo seulement si possible).
- **Mentor allégé** : un modèle plus petit, capable des fonctions essentielles (questionner, étayer,
  corriger des exercices) hors-ligne ; le modèle lourd est sollicité au cloud quand la connexion le permet.
- **Quêtes** et leurs gabarits.
- **Le parcours et les preuves** de l'apprenant (stockés localement, signés, synchronisés ensuite).

---

## Synchronisation : robuste et économe

- **Opportuniste** : se déclenche dès qu'une connexion (même brève) est disponible.
- **Différentielle** : ne transfère que les changements (économie de données).
- **Résiliente aux conflits** : conçue pour des connexions intermittentes (résolution de conflits, reprise
  sur coupure).
- **Priorisée** : les preuves et la progression d'abord (petites, critiques) ; les ressources lourdes
  ensuite, si possible.
- **Économe** : compression agressive ; option « WiFi seulement » ; respect des forfaits limités.

---

## Le terminal : une PWA légère

- **PWA** installable, fonctionnant sur smartphone bas de gamme / PC ancien / borne de Foyer.
- **Service worker** pour le cache et le fonctionnement hors-ligne.
- **Mode texte/voix** par défaut en basse bande passante.
- **Accessibilité** native.

---

## Le Foyer comme infrastructure d'accès

Le Foyer (couche 4) n'est pas qu'un lieu social : c'est un **nœud technique** :

- héberge un **serveur local** (type RACHEL) avec Atlas + Mentor léger ;
- fournit **terminaux** partagés pour ceux qui n'en ont pas ;
- sert de **point de synchronisation** et de relais de connectivité ;
- combine ainsi **accès matériel + lien humain** — la réponse au « troisième fossé numérique ».

---

## Limites honnêtes

- Le Mentor **léger** offline est moins puissant que le modèle cloud : c'est un compromis assumé (mieux
  vaut un bon tuteur hors-ligne que pas de tuteur du tout).
- Certaines Quêtes nécessitant des ressources lourdes ou une collaboration temps réel sont **dégradées**
  hors-ligne.
- L'offline-first ne crée pas l'électricité ni les terminaux : il **maximise l'utilité** de ce qui existe,
  mais l'accès matériel reste un enjeu d'infrastructure (voir [équité](../04-PARCOURS-DE-VIE/06-equite-inclusion.md)).

**Référence** : Learning Equality, *Kolibri* ; World Possible, *RACHEL*. Voir
[bibliographie](../09-ANNEXES/01-bibliographie.md).
