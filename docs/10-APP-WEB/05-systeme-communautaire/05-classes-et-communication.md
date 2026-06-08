# Les Classes & la communication (la sociabilité d'une vraie école)

> *Pour recréer la dimension sociale d'une école traditionnelle : chaque élève est **assigné à une Classe**
> (petit groupe formé automatiquement par niveau, langue et type), où l'on **échange, s'entraide, discute**.
> Les classes ont un **cycle de vie** (trimestre/semestre/année) et un **brassage périodique** — on change de
> classe pour la nouveauté, comme à l'école. Plus une suite de communication : **messagerie, visio, appels,
> groupes, binômes** — le tout en **jardin clos sécurisé**, surtout pour les mineurs.*

S'appuie sur l'[Espace-Classe](01-fonctionnalites.md) déjà posé, et le complète.

---

## 1. La Classe : l'unité sociale

### Taille — deux échelles
- **La Classe = 20-30 élèves (idéal ~24)** : l'unité d'**appartenance** (identité, fil, événements,
  entraide). Assez grande pour une vraie vie sociale, assez petite pour ne pas noyer la facilitation.
- **Les sous-groupes de travail = dyades (2) / trios** : pour le travail actif et l'entraide réelle (les
  dyades génèrent plus de communication et d'entraide que les groupes de 4). Ce sont les
  [binômes/Cercles](04-cercles-guildes-foyers.md) à l'intérieur de la classe.

### Formation automatique (matching)
On assigne chaque élève à une classe par un **matching à contraintes dures + objectif souple** :

| Contraintes **dures** (doivent correspondre) | Objectif **souple** (à équilibrer) |
|----------------------------------------------|-------------------------------------|
| **Langue** d'enseignement | **Niveau** : viser l'**hétérogénéité *dans* la classe** (les plus avancés expliquent, les autres progressent → entraide) |
| **Fuseau horaire / disponibilités** compatibles | et l'**homogénéité *entre* les classes** (classes comparables) |
| **Type de classe** (≈ le « niveau de cursus » / la phase) | |

> La recherche tranche : pour l'**entraide et la sociabilité**, mélanger les niveaux dans une classe marche
> mieux que des classes homogènes. ⚠️ **Ne jamais** matcher sur des « styles d'apprentissage » (ne bat pas
> l'aléatoire). Implémentation : un solveur (algorithme génétique / recuit simulé) ; pour démarrer, un
> **glouton stratifié** (round-robin par niveau, dans un même bucket langue + fuseau) suffit. Détail :
> [matching technique](03-implementation-technique.md#6-matching).

---

## 2. Le cycle de vie & le brassage (changer de classe, comme à l'école)

C'est la demande clé. La recherche montre une **tension réelle** : groupes **stables** = confiance,
appartenance, sécurité ; groupes **rebrassés** = nouveauté, **liens faibles** utiles (Granovetter, confirmé
causalement sur 20 M d'utilisateurs LinkedIn), moins de cliques, moins de stagnation. → On combine les deux,
sur **trois rythmes** :

```
┌────────────────────────────────────────────────────────────────────┐
│  CYCLE (trimestre / semestre) — la CLASSE est STABLE                 │
│  → laisse le temps à la confiance et à l'appartenance de se former   │
│                                                                      │
│   ┌──────────────────────────────────────────────────────────┐      │
│   │  CHAQUE SEMAINE : micro-rotation des BINÔMES/trios          │      │
│   │  → on apprend les prénoms, on prend des risques, anti-clique│      │
│   └──────────────────────────────────────────────────────────┘      │
└────────────────────────────────────────────────────────────────────┘
        │  à la fin du cycle → BRASSAGE : recomposition des classes
        ▼  (nouvelle classe, comme la rentrée — nouveauté, liens faibles)
   ... cycle suivant ...
```

- **La classe dure un cycle complet** (trimestre/semestre) → confiance + appartenance (la présence sociale
  est un prérequis de l'engagement et un facteur clé de **persévérance**).
- **À chaque fin de cycle, rebrassage** : on est réassigné à une **nouvelle classe** (même si on reste au
  même niveau) → nouveauté, nouveaux liens, on ne stagne pas dans le même groupe. Exactement « changer de
  classe chaque année ».
- **Micro-rotation hebdomadaire des binômes** *à l'intérieur* de la classe → le bénéfice social le mieux
  prouvé (prénoms, prise de risque, anti-cliques) sans casser l'appartenance.
- **Les ponts** : on peut **garder 1-2 contacts** (un ami, un binôme favori) au-delà du brassage — Granovetter
  dit d'**ajouter** des liens faibles, pas de détruire les liens forts.

> Résultat : la sécurité d'un groupe stable **+** la fraîcheur d'un renouvellement régulier. On n'est jamais
> figé, jamais isolé.

---

## 3. Ce qui fait vivre la classe (appartenance & entraide)

- **Identité de classe persistante** : un nom, une page, un fil de discussion, des rituels (cf.
  [rythme live](01-fonctionnalites.md#couche-7--le-rythme-live-le-battement-hebdomadaire)).
- **Un mentor référent visible** par classe (présence enseignante) : reconnaît nommément, salue les progrès
  — c'est ce qui fait « je ne suis pas un numéro » et booste la rétention.
- **Onboarding social en semaine 1** (les élèves actifs la 1ʳᵉ semaine finissent beaucoup plus).
- **Binôme d'accountability** + **tutorat par les pairs** à rôles tournants (expliquer consolide ; effet
  prouvé) — détail : [fonctionnalités §6](01-fonctionnalites.md).

---

## 4. La suite de communication

Tous ces outils existent **dans le jardin clos** de la classe/du binôme (voir §5 pour la sécurité) :

| Outil | Usage | Cadre |
|-------|-------|-------|
| **Messagerie privée (DM)** | échanger, s'entraider | **Entre membres de sa classe/binôme** uniquement ; filtrée, signalable |
| **Chat de groupe** | la vie de la classe | Public à la classe, modéré |
| **Visioconférence de groupe** | study rooms, sessions de classe, body-doubling | Salles de classe/binôme à jetons signés |
| **Appels** | s'entraider en direct | En groupe ; 1:1 entre pairs de la même classe ; jamais 1:1 mineur↔adulte non supervisé |
| **Groupes** | projets, entraide | Sous-groupes de la classe (dyades/trios) |
| **Binômes** | redevabilité, body-doubling | Appariés, à rotation hebdo |

**Visio / appels — technique** : SDK embeddable type **100ms / LiveKit / Daily** (rooms à **jetons signés
expirables**, salle d'attente, contrôle hôte) — **jamais de liens publics**. Study rooms façon body-doubling :
**caméra optionnelle, micro coupé par défaut**. **Pas d'enregistrement par défaut** (un enregistrement de
visage/voix de mineur = donnée sensible) ; si appel mentor 1:1, **supervisé/tracé** avec consentement et
rétention limitée.

---

## 5. Sécurité des communications — par la modération + le suivi parental (pas le bridage)

> **L'expérience est la même pour tous, mineurs inclus.** On ne retire aucune fonctionnalité (DM, visio,
> appels) aux mineurs à cause de personnes toxiques : celles-ci se font **modérer**. La sécurité repose sur
> **deux piliers**, détaillés dans [système parental & modération](06-systeme-parental-et-moderation.md) :

1. **Système parental (à la Pronote)** : email du responsable légal à l'inscription (consentement
   vérifiable « email plus », COPPA/RGPD) ; **compte parent optionnel** (tableau de bord : progression,
   planning, présence, synthèse communautaire — **jamais le contenu privé brut**) ; sinon **bilan email**
   périodique ; **alertes urgentes** sur incident grave (validées par un humain).
2. **Modération forte (à la Discord)** : **bots AutoMod** (mots-clés + regex + spam) → **ML de toxicité
   bidirectionnel** (détecte qui harcèle **et** qui est harcelé, multilingue, pour *prioriser* — jamais
   bannir en auto) → **modérateurs humains** qui tranchent → si un **mineur** est impliqué (auteur **ou**
   victime), **alerte au parent**. Détresse/auto-mutilation → escalade humaine immédiate + orientation vers
   de l'aide.

> Point de cadre naturel (sans rien brider) : la communauté est composée de **membres inscrits** (classes,
> Guildes), pas d'inconnus aléatoires — ce qui réduit déjà le risque « contact avec un inconnu ».
> Contre-exemple à ne pas reproduire : **École 42** (communauté non modérée → dérives). Le bon équilibre =
> **fonctionnalités complètes pour tous + modération + suivi parental**. Détail :
> [système parental & modération](06-systeme-parental-et-moderation.md).

---

## 6. Implémentation (rappel)

- **Modèle de données** : `class` (cycle, langue, type), `class_membership` (élève ↔ classe ↔ rôle),
  `binome`, `message`, `call_session`. RLS : un élève ne voit que **sa** classe/binôme (jardin clos par
  construction). Détail : [implémentation technique](03-implementation-technique.md).
- **Matching** : job de formation des classes au début de chaque cycle (solveur), micro-rotation
  hebdomadaire des binômes.
- **Temps réel** : **Supabase Realtime** (chat, présence) + SDK visio (100ms/LiveKit/Daily) pour les appels.
- **Modération** : pipeline IA (grooming/harcèlement) + file humaine (BullMQ) + journalisation. Voir
  [backend](../14-backend.md).

---

## Synthèse

> La **Classe** (≈24, formée par langue/fuseau/type, niveaux mélangés) recrée l'appartenance d'une vraie
> école ; son **cycle de vie + brassage** (classe stable un trimestre, rebrassage ensuite, binômes en
> rotation hebdo, ponts conservés) apporte nouveauté et liens faibles sans isolement. La **suite de
> communication** (DM, visio, appels, groupes, binômes) vit dans un **jardin clos sécurisé** — modération
> IA + humaine, pas de 1:1 mineur↔adulte non supervisé, consentement parental, journalisation. La sociabilité
> et l'entraide d'une école, **en toute sécurité**.

**Sources** : taille de groupe (Wang 2023 ; Li 2025, Frontiers) ; formation de groupes (Vallès-Català &
Palau 2023, PLOS One) ; liens faibles (Granovetter 1973 ; Rajkumar et al. 2022, *Science*, n=20M) ;
appartenance / présence sociale (Community of Inquiry ; WGU Labs) ; sécurité mineurs (COPPA 2025, RGPD-K ;
Khan Academy ; Thorn Safer Predict) ; visio (100ms/LiveKit/Daily ; bonnes pratiques DoE) ; tutorat/binômes
(méta-analyses ERIC/PubMed ; accountability). Détail : [bibliographie](../../09-ANNEXES/01-bibliographie.md).
