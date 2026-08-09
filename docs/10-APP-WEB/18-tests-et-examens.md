# Tests, examens & modules d'exercices

> *À Dowze, **on se teste pour apprendre**, pas pour être noté. Les tests hebdomadaires et trimestriels
> sont des outils de **récupération** (l'acte de se souvenir renforce la mémoire), personnalisés par l'IA
> à partir de ta mémoire de progression et de tes erreurs. Ils ne délivrent **aucune note de maîtrise** :
> la validation d'une compétence, elle, reste **par les pairs et par la démonstration** ([principe
> « pas de QCM couperet »](../00-FONDATIONS/03-principes-fondateurs.md)).*

---

## 1. L'idée-force : le test **fait** apprendre (effet-test)

Se tester n'est pas mesurer un savoir déjà là — **c'est un événement d'apprentissage à part entière.**
Récupérer une information en mémoire renforce les voies d'accès, *même quand la tentative échoue*.

- **Re-étudier une notion déjà lue une fois n'a quasiment aucun effet** sur le rappel à une semaine ;
  **se re-tester produit un large gain** (Karpicke & Roediger, *Science* 2008).
- Méta-analyse de 272 effets : se tester vaut **+0,51 σ** vs relire, **+0,93 σ** vs ne rien faire
  (Adesope 2017).
- Quiz fréquents à faible enjeu → **+13 à 25 %** aux examens sur le contenu testé.
- Bonus : **~72 % des élèves se disent *moins* anxieux** grâce à la pratique de récupération régulière.
- **Illusion de savoir** : les élèves sous-estiment l'efficacité du re-test (« je connais déjà »). D'où
  le rôle de l'app : **encourager la récupération même quand on a l'impression de maîtriser.**

C'est pourquoi Dowze en fait un pilier — et pourquoi ces tests sont **fréquents, courts et sans note**.

---

## 2. La distinction qui résout tout : formatif ≠ certifiant

Le même exercice peut servir deux usages opposés. Dowze tranche clairement :

| | **Se tester pour apprendre** (Dowze fait ça) | **Certifier une compétence** (Dowze ne fait PAS ça avec des QCM) |
|---|---|---|
| Nom | *Assessment **for** learning* (formatif) | *Assessment **of** learning* (sommatif) |
| Outils | QCM, cloze, flashcards, réponse courte… | Démonstration, projet, présentation, **pairs** |
| Enjeu | Faible, **privé, sans note** | Élevé |
| Rôle | Nourrit la mémoire (où réviser) | Atteste ce qu'on sait **faire** |

Pourquoi un QCM ne **certifie** pas : il ne touche que le bas de la pyramide de Miller (« sait / sait
comment »), jamais le « **montre** comment » ni le « **fait** ». Sa validité prédit surtout… la réussite
à d'autres QCM. **La compétence se valide en la montrant**, pas en cochant une case.

> **La formule Dowze** : *« On se teste pour apprendre (formatif, privé, sans note). On valide en montrant,
> devant ses pairs (authentique). »*
>
> *Nuance assumée : en maths/sciences, QCM et démonstration corrèlent fortement — on ne prétend pas que
> « le QCM ne mesure rien ». Le refus du QCM-couperet est un **choix pédagogique et éthique**, cohérent,
> pas un slogan.*

---

## 3. Les modules d'exercices (réutilisables)

Des **briques** que l'IA assemble pour composer n'importe quel test. Chaque module produit un **JSON à
schéma strict**, porte un `competenceId`, un `bloomLevel`, et un `sourceRef` (traçabilité — voir §6).

### Priorité 1 — le socle
| Module | Ce qu'il mesure | Règles de qualité clés |
|---|---|---|
| **Flashcard** (recto/verso) | rappel actif pur | 1 idée/carte ; planifiée par [FSRS](15-copilote-orchestrateur.md) (révisions dues) |
| **QCM** | rappel → application | **3 options** (1 bonne + 2 distracteurs), distracteurs = **erreurs réelles**, options homogènes, pas de « toutes/aucune », position aléatoire, **feedback obligatoire** |
| **Réponse courte / trou unique** | rappel en production | point unique, **correction sémantique** tolérante (casse, accents, synonymes) |
| **Cloze (texte à trou)** | compréhension, vocabulaire, grammaire | **scoring sémantique** (accepter synonymes), blancs de longueur constante |

### Priorité 2 — variété cognitive
| Module | Ce qu'il mesure | Règles clés |
|---|---|---|
| **Vrai/Faux + justification** | discrimination | jamais isolé (série de 10-15), pas de mots-signaux (« toujours/jamais »), corriger l'énoncé faux |
| **Appariement** | associations (terme↔définition) | contenu homogène, listes courtes |
| **Remise en ordre / séquençage** | procédural, chronologie | critère d'ordre explicite |

### Priorité 3 — ordre supérieur (correction IA guidée)
| Module | Ce qu'il mesure | Règles clés |
|---|---|---|
| **Question ouverte / explication** | analyse, production | **rubrique livrée avec la question**, feedback tâche/processus, **jamais de note certifiante** |
| **Glisser-déposer (catégorisation)** | organisation | **toujours une alternative clavier** (accessibilité WCAG 2.5.7) |

**Choix de conception** (fondés) : le **QCM à 3 options** est l'optimum (80 ans de recherche : autant d'items
par temps donné, sans perte de qualité) ; le **scoring sémantique** du cloze est plus fiable que le mot
exact ; les **distracteurs** sont le point critique — ils doivent venir des **vraies erreurs des élèves**
(la [mémoire des confusions](16-architecture-etat-memoire.md) de Dowze !).

---

## 4. Le test HEBDOMADAIRE (ex. vendredi)

Un rendez-vous de **révision** qui reprend la semaine et consolide.

- **Contenu** : ce qui a été vu dans la semaine **+ rappel espacé** d'items plus anciens dus (FSRS) →
  **cumulatif et *interleavé*** (thèmes **mélangés**, pas regroupés : entremêler double la rétention à un
  mois car l'élève apprend à *choisir* la bonne procédure — Rohrer 2020, 61 % vs 38 %).
- **Longueur** : **10-15 items**, mix de modules (flashcards, QCM 3 options, cloze, 1-2 réponses courtes).
  ~10-15 min. **Pas de compte à rebours** (voir §7).
- **Note** : **aucune qui compte.** Le score visible = **ton progrès personnel**, jamais un classement.
- **Feedback** : **immédiat**, orienté **tâche et processus** (pas d'éloge du « soi »), avec explication et
  la source (`sourceRef`) ; possibilité de **re-tester plus tard** les erreurs (l'espacement aide encore).
- **Personnalisation par l'IA (depuis ta mémoire)** : ~**60 %** semaine en cours / ~**40 %** révisions dues
  et **erreurs récurrentes** ; difficulté calibrée pour viser **~80-85 % de réussite** (zone proximale de
  développement) ; **sur-échantillonnage des compétences faibles** (modèle de maîtrise type BKT).

---

## 5. L'examen TRIMESTRIEL

Un **bilan de progression** plus large, à enjeu modéré — **jamais un couperet de maîtrise**.

- **Contenu** : couverture cumulative des 3 mois, interleavée, pondérée par l'importance des compétences.
  **Son annonce à l'avance** renforce déjà la rétention (effet d'attente d'un examen cumulatif).
- **Longueur** : **30-45 items** en **sections courtes** (la fatigue dégrade au-delà de ~30 d'affilée), avec
  des **questions ouvertes à rubrique** pour l'ordre supérieur.
- **Note** : un **bilan**, pas un verdict. La **validation de compétence reste par les pairs / la
  démonstration authentique** (§2). L'examen alimente le **plan de révision**, pas un diplôme.
- **Personnalisation par l'IA** : partiellement **adaptative** (CAT-léger : viser ~50 % de réussite attendue
  pour *situer*, puis remonter vers ~85 % en entraînement) ; sections ciblées sur les faiblesses
  persistantes ; items générés par l'IA **ancrés sur sources + validés** (§6).

---

## 6. Garde-fous sur les items générés par l'IA

Les LLM génèrent des QCM **corrects mais souvent trop faciles**, et **anticipent mal les vraies idées
fausses** ; le taux d'erreur factuelle varie fortement selon le domaine. Donc, sans exception :

1. **Ancrage sur source (RAG)** : tout item pointe une source traçable (`sourceRef`) — **pas de génération
   « à froid »**.
2. **Sortie à schéma strict** (JSON Schema) : le non-conforme est **rejeté** automatiquement.
3. **Vérification de la clé** : régénérer N fois et exiger une **bonne réponse stable** (auto-cohérence) +
   contrôle qu'**une seule** option est correcte.
4. **Qualité des distracteurs** : *predictive prompting* nourri par la **banque d'erreurs réelles** des
   élèves (la mémoire des confusions de Dowze) ; repérer les distracteurs jamais choisis via les stats.
5. **Humain/expert dans la boucle** avant tout usage à enjeu (trimestriel) ; pour l'hebdo (faible enjeu),
   validation auto + révision *a posteriori* des items les moins discriminants.
6. **Boucle psychométrique** : suivre difficulté et pouvoir discriminant réels ; retirer/réviser les items
   trop faciles, ambigus ou non-discriminants.

---

## 7. Non-punitif, sans stress (règles d'ergonomie)

- **Pas de compte à rebours visible.** C'est la **pression temporelle** qui nuit (anxiété, perte de moyens),
  **pas la durée** — et sur un test non chronométré, donner plus de temps n'améliore rien. Au mieux une
  **estimation indicative** (« ~10 min »).
- **Faible enjeu par défaut** : pas de pénalité, pas de classement public. Le faible enjeu **garde l'effet-
  test tout en réduisant l'anxiété**.
- **Longueur maîtrisée** : ~8-15 items par session ; au-delà de ~25-30, la précision chute par **fatigue**,
  pas par ignorance.
- **Gamification sobre**, orientée **maîtrise/progrès** — **éviter les *streaks* et récompenses tangibles**
  (elles minent la motivation intrinsèque et la série devient un but en soi).
- **Accessibilité (WCAG)** : tout opérable **au clavier**, **alternative sans glisser** au drag-and-drop,
  contrastes suffisants, pas de contrainte de temps imposée.

---

## 8. Ce qui change côté produit (à implémenter)

- **Bibliothèque de modules** (P1 d'abord : flashcard, QCM, réponse courte, cloze), chacun à **schéma
  strict** + moteur de correction (dont **matching sémantique**).
- **Générateur d'items par l'IA** ancré RAG + garde-fous (§6), piloté par la **mémoire de progression**
  (compétences faibles, erreurs récurrentes, révisions FSRS dues).
- **Test hebdo** (rendez-vous cumulatif interleavé) et **examen trimestriel** (adaptatif léger).
- **Séparation stricte des rôles en base** : ces tests écrivent dans le **modèle d'apprenant** (où réviser),
  **jamais** un statut « compétence validée » — la validation passe par le circuit pairs/démonstration.

**Voir aussi** : [la séance & le minuteur](17-seance-et-minuteur.md) · [le Copilote](15-copilote-orchestrateur.md)
· [architecture de l'état & mémoire](16-architecture-etat-memoire.md) · [expéditions](20-expeditions.md).
