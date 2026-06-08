# Le système de validation (sans QCM, inspiré d'École 42)

> *On ne valide pas une compétence avec des QCM auto-corrigés — créer des milliers de questions pour toutes
> les branches est ingérable, et trahit l'esprit du projet. Dowze valide par **paliers** : on **s'auto-valide
> d'abord** (ça débloque tout de suite, on passe à la suite), puis une **validation par les pairs** plus
> forte arrive **en file d'attente** (optionnelle, dépendante de la communauté, qui peut prendre des
> semaines/mois — sans jamais bloquer la progression). C'est le modèle École 42.*

---

## Le principe : 4 paliers, dont 1 seul est bloquant (et c'est le plus léger)

```
PALIER 1            PALIER 2 (option,     PALIER 3                 PALIER 4 (option)
AUTO-VALIDATION  →  immédiat)          →  VALIDATION PAR LES     → ENDOSSEMENT
(checklist          PRÉ-CORRECTION         PAIRS                    EXPERT / ÉPREUVE
 factuelle)         AUTO (IA/tests)        (en file, async)         (échantillon, enjeux élevés)
     │                                                                
 ✅ DÉBLOQUE          feedback immédiat    confiance moyenne         confiance forte
 la suite tout       (équivalent          (r ≈ 0,69 pairs/expert)   (certification externe)
 de suite            « Moulinette »)      ⏳ peut prendre des
 (NON-BLOQUANT)                            semaines/mois — tu fais
                                           autre chose pendant
```

> **La clé** : seul le palier 1 (auto-validation) conditionne la progression — et il est **instantané**.
> Tout le reste **monte le niveau de preuve** *après coup*, sans jamais t'attendre.

---

## Palier 1 — L'auto-validation (instantanée, débloque la suite)

Quand tu termines une Expédition/compétence, tu **t'auto-valides** sur une **checklist FACTUELLE** — pas
une note que tu te donnes :

```
☑ Mon livrable existe et fonctionne
☑ J'ai répondu aux 5 critères de la grille
☑ Je peux expliquer ce que j'ai fait et pourquoi
☑ J'ai testé / vérifié mon résultat
```

→ **Ça débloque immédiatement la compétence suivante.** Tu n'attends personne.

> ⚠️ **Pourquoi factuel et pas « je me sens niveau 4/5 » ?** Parce que l'auto-évaluation de *confiance* est
> peu fiable (Dunning-Kruger : seuls ~18,5 % des débutants s'auto-jugent juste ; les faibles se
> surestiment). Une **checklist de faits concrets** (« mon code compile », « j'ai un livrable ») est, elle,
> vérifiable et bien moins biaisée. C'est l'astuce qui rend l'auto-validation utilisable.

À ce stade, ta compétence porte un **badge « auto-validé »** = niveau de **confiance faible, mais explicite
et honnête**. Tu avances ; la preuve se renforcera ensuite.

---

## Palier 2 — La pré-correction automatique (optionnelle, immédiate)

Avant ou en parallèle, l'**IA** peut donner un **feedback immédiat** sur ton livrable — l'équivalent de la
**« Moulinette »** de 42 (qui teste automatiquement le code).

- Pour ce qui est **mécanisable** (du code qui doit compiler, un calcul juste) : des **tests automatiques**.
- Pour le reste : un **LLM-as-judge encadré** qui te donne un retour et **signale les copies suspectes**.

⚠️ **L'IA n'est jamais le juge final** : elle a des biais (elle favorise les réponses longues, ses propres
formulations, est sensible aux manipulations). Elle **aide et alerte**, elle ne **certifie pas**. (On lui
demande d'**expliquer** son retour, pas juste de donner un score — ça améliore l'alignement.)

---

## Palier 3 — La validation par les pairs (en file, asynchrone, NON-bloquante)

C'est le cœur du modèle 42, et la validation **forte** par défaut. Tu mets ton livrable **en file
d'attente** de correction par la communauté — et **pendant ce temps, tu fais autre chose** (tu avances,
puisque tu t'es déjà auto-validé). La correction peut venir dans des heures, des jours, parfois des
semaines : **ce n'est pas grave, ça ne te bloque pas.**

**Comment ça marche (repris de 42) :**

| Mécanisme | Détail |
|-----------|--------|
| **Grille = checklist binaire de faits** | L'évaluateur coche oui/non sur des critères vérifiables (« le service tourne ? », « la fonction renvoie X ? ») — **pas** des notes subjectives. C'est ce qui rend un non-expert fiable. |
| **Soutenance** | Tu dois **expliquer et défendre** ton travail (en visio/au Foyer) — prouver qu'on a compris, anti-triche naturel. |
| **≥ 2 évaluateurs, on prend la médiane** | Résiste aux notes aberrantes et au biais de générosité. |
| **Appariement aléatoire + révélé tard** | Tu ne sais qu'à la dernière minute qui te corrige → anti-copinage. |
| **Monnaie d'évaluation** | Pour être corrigé, il faut avoir corrigé les autres (« evaluation points »). Ça crée un marché auto-équilibré : **pas besoin de staff pour corriger.** |

**Fiabilité (crédibilité du système)** : la corrélation entre notes des pairs et notes d'experts est de
**r ≈ 0,69** (méta-analyse Falchikov & Goldfinch, 48 études) — *à condition* d'une grille à critères bien
compris. C'est ce qui légitime la peer-validation comme preuve « forte ».

→ Quand ≥ 2 pairs ont validé, ta compétence **passe au badge « pair-validé »** = confiance **moyenne-forte**.

> **Honnêteté** : cette validation **dépend de la communauté**. Au début (peu d'élèves), elle peut être lente
> ou indisponible — c'est exactement pourquoi elle est en **palier 2 optionnel, jamais l'unique source**.
> Tu n'es jamais bloqué : tu as ton badge « auto-validé », tu continues. La validation par les pairs
> **upgrade** ta preuve quand elle arrive. (Détail démarrage à froid :
> [communauté/cold-start](05-systeme-communautaire/04-securite-cold-start.md).)

---

## Palier 4 — L'endossement expert / l'épreuve (optionnel, enjeux élevés)

Pour les compétences à **fort enjeu** (santé, sécurité, droit…) ou une **certification externe**, un palier
supérieur : **épreuve observée** ou **endossement par un maître de Guilde/expert**, parfois par
**échantillonnage** (un expert re-corrige un % aléatoire pour vérifier la communauté). → badge « endossé » =
confiance **forte**.

---

## Les 3 niveaux de preuve coexistent sur le même acquis

Techniquement (via **Open Badges 3.0 / Verifiable Credentials**, voir [Passeport](../03-ARCHITECTURE/05-preuve-passeport.md)),
une même compétence peut être **ré-endossée** sans refaire le travail :

| Badge | Obtenu par | Confiance | Bloquant pour avancer ? |
|-------|-----------|-----------|--------------------------|
| 🟡 **Auto-validé** | checklist factuelle | Faible (honnête) | **Non — débloque la suite** |
| 🟢 **Pair-validé** | ≥2 pairs, médiane, grille | Moyenne-forte (r≈0,69) | Non (arrive en file, async) |
| 🔵 **Endossé** | expert / épreuve observée | Forte | Non (optionnel, enjeux élevés) |

Sur ton [Passeport](../03-ARCHITECTURE/05-preuve-passeport.md), chacun voit **le niveau de preuve** de
chaque compétence — c'est transparent et honnête. Un employeur sérieux regardera les badges « pair-validé »
et « endossé ».

---

## Anti-triche (sans flicage)

- **Appariement aléatoire** + identité révélée tard (anti-copinage).
- **Évaluateurs calibrés** (modèle *Calibrated Peer Review*) : pour faire monter un badge au niveau
  « pair-validé », l'évaluateur doit avoir prouvé sa fiabilité sur des copies-étalon.
- **Réputation d'évaluateur** (note-t-il trop mou / trop dur, trop loin de la médiane ?) reliée à la monnaie
  de points : bonus aux bonnes corrections, malus aux corrections bâclées.
- **Méta-modération** : la communauté note les corrections elles-mêmes.
- **Signal auto-éval vs peer-éval** : un gros écart répété entre ce qu'on s'attribue et ce que les pairs
  constatent = drapeau (triche ou complaisance).
- **La soutenance** : on ne défend pas un travail qu'on n'a pas compris.

---

## Ce que ça change (et pourquoi c'est mieux que les QCM)

| QCM auto-corrigés (rejeté) | Validation par paliers (adopté) |
|----------------------------|----------------------------------|
| Créer des **milliers de questions** par branche | **Une seule grille (checklist) par compétence**, réutilisée à l'infini |
| Mesure surtout du rappel | Mesure du **travail réel** (livrable + défense) |
| Bloque tant qu'on n'a pas « réussi » | **Ne bloque jamais** : on s'auto-valide et on continue |
| Solitaire | **Nourrit la communauté** (corriger pour être corrigé) |
| Une seule note | **3 niveaux de preuve** transparents qui coexistent |

> **On ne stocke même pas les grilles une par une.** On stocke **une seule règle** : « *pour valider une
> compétence, génère une checklist de critères binaires, observables, sur le travail réel, alignés sur la
> compétence (backward design)* ». L'IA **génère la grille de n'importe quelle compétence à la demande** —
> toujours à jour, jamais à maintenir. C'est le principe de l'[école générative](../03-ARCHITECTURE/09-ecole-generative.md) :
> **une règle remplace une infinité de grilles.** L'auto-validation, la correction par les pairs et
> l'endossement sont, eux, portés par les apprenants et la communauté.

---

## Articulation avec le reste

- **Progression** : seul le palier 1 conditionne l'avancée → cohérent avec
  [« maîtrise, pas temps »](../00-FONDATIONS/03-principes-fondateurs.md) **et** non-bloquant.
- **Passeport** : les 3 niveaux de preuve = les niveaux de vérification de la
  [couche Preuve](../03-ARCHITECTURE/05-preuve-passeport.md).
- **Communauté** : la peer-validation est un pilier du
  [système communautaire](05-systeme-communautaire/01-fonctionnalites.md) (et du moteur « qui maîtrise
  enseigne/corrige »).
- **Cerveau pédagogique** : remplace l'ancienne logique « QCM pour gater » de
  [02-cerveau-pedagogique](02-cerveau-pedagogique.md#5-évaluation).

**Sources** : École 42 (peer-eval, evaluation points, Moulinette, soutenance) ; Falchikov & Goldfinch 2000
(r≈0,69) ; Calibrated Peer Review (UCLA) ; études Dunning-Kruger (auto-éval) ; Open Badges 3.0 /
EndorsementCredential ; NGLC (mastery à paliers, non-bloquant) ; LLM-as-judge (κ>0,80 mais biais). Détail :
[bibliographie](../09-ANNEXES/01-bibliographie.md).
