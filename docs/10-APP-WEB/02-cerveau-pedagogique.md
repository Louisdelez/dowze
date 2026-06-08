# Le cerveau pédagogique (le structuré)

> *Un LLM seul invente des programmes incohérents (trous, hallucinations). Donc toute la **structure
> pédagogique** — carte des compétences, niveau, progression par maîtrise, séquencement, révision —
> **vit dans l'app**. L'IA enseigne sur cette carte ; elle ne la dessine pas.*
>
> *Principe transverse : **l'IA propose et enseigne ; l'app tient la structure** (carte, niveau,
> séquencement). La maîtrise se valide **par paliers** (auto-validation → pairs), **sans QCM** — voir
> [§5](#5-évaluation--pas-de-qcm--validation-par-paliers-modèle-école-42) et [09-validation](09-validation.md).*

---

## 1. La carte de compétences (graphe de prérequis)

Un **graphe orienté** (DAG) : compétences = nœuds, « est prérequis de » = arêtes. Suffisant pour 90 % des
besoins ; pas besoin de base graphe dédiée au MVP — du **SQL relationnel** suffit.

```sql
CREATE TABLE skill (
  id            TEXT PRIMARY KEY,
  name          TEXT,
  external_ref  TEXT,        -- ex: code Common Core, URI ESCO/O*NET (réutilisation)
  domain        TEXT,
  level_band    TEXT
);

CREATE TABLE prerequisite (
  skill_id      TEXT REFERENCES skill(id),   -- la compétence cible
  requires_id   TEXT REFERENCES skill(id),   -- son prérequis
  PRIMARY KEY (skill_id, requires_id)
);

CREATE TABLE student_skill_state (
  student_id    TEXT,
  skill_id      TEXT,
  p_known       REAL,        -- probabilité de maîtrise (BKT, §2)
  status        TEXT,        -- 'locked' | 'ready' | 'in_progress' | 'mastered'
  updated_at    TIMESTAMP,
  PRIMARY KEY (student_id, skill_id)
);
```

**Amorçage (ne pas partir de zéro)** : importer un référentiel ouvert via `external_ref` —
**ESCO** (UE, ~13 939 compétences, téléchargeable en JSON-LD/CSV/RDF, API), **O*NET** (US, crosswalk
ESCO↔O*NET officiel), **Common Core / plans d'études** (codes stables). C'est la matière première de
l'[Atlas](../03-ARCHITECTURE/01-atlas.md). ⚠️ Ces référentiels sont orientés *métiers* : le scolaire fin et
le non-professionnel demandent une construction/adaptation humaine.

> **L'investissement le plus rentable** : la **qualité du graphe de prérequis**. Il conditionne le
> séquencement, la maîtrise et le diagnostic. C'est là que l'expertise humaine + les Guildes comptent.

---

## 2. Le suivi de maîtrise : BKT (Bayesian Knowledge Tracing)

Pour un MVP : **BKT**, pas Deep Knowledge Tracing. BKT est **interprétable** (un paramètre = une réalité),
tient en ~15 lignes, et un BKT bien réglé égale DKT en pratique (Khajah et al. 2016).

**4 paramètres par compétence** : `p(L0)` (maîtrise a priori), `p(T)` (apprendre à chaque essai), `p(S)`
(*slip* : se tromper en sachant), `p(G)` (*guess* : réussir par chance).

**Mise à jour à chaque réponse** (formules de Corbett & Anderson 1995) :

```python
def bkt_update(p_known, correct, p_slip, p_guess, p_transit):
    if correct:
        num = p_known * (1 - p_slip)
        den = num + (1 - p_known) * p_guess
    else:
        num = p_known * p_slip
        den = num + (1 - p_known) * (1 - p_guess)
    p_cond = num / den
    return p_cond + (1 - p_cond) * p_transit   # P(L) au pas suivant
```

- **Seuil de maîtrise standard : `p_known ≥ 0.95`** (Cognitive Tutors).
- Valeurs de départ raisonnables (à calibrer plus tard avec la lib `pyBKT`) : `p(L0)≈0.3`, `p(T)≈0.2`,
  `p(S)≈0.1`, `p(G)≈0.2`. **Contrainte** : `p(S)<0.5` et `p(G)<0.5` (sinon le modèle dégénère).
- BKT **ne modélise pas l'oubli** (P(L) ne redescend pas) → l'oubli est géré séparément par la révision
  espacée (§6).

---

## 3. Le séquencement : « quoi apprendre ensuite »

La prochaine compétence = celle de l'**outer fringe** : non maîtrisée, mais dont **tous les prérequis sont
maîtrisés**. (C'est le principe d'ALEKS ; la proba qu'un élève réussisse effectivement un item ainsi choisi
est ~0,93.)

```sql
SELECT s.id FROM skill s
JOIN student_skill_state ss ON ss.skill_id = s.id AND ss.student_id = :u
WHERE ss.p_known < 0.95                          -- pas encore maîtrisée
AND NOT EXISTS (                                 -- tous les prérequis maîtrisés
  SELECT 1 FROM prerequisite p
  LEFT JOIN student_skill_state ps
    ON ps.skill_id = p.requires_id AND ps.student_id = :u
  WHERE p.skill_id = s.id AND COALESCE(ps.p_known, 0) < 0.95
);
```

**Priorité** parmi les candidats (du plus simple au plus riche) : (1) ordre du curriculum ; (2) « presque
maîtrisée » d'abord (gains rapides) ; (3) maximiser le déblocage (compétence qui ouvre le plus de suites) ;
(4) y mêler les révisions dues (§6). Pour le MVP, (1) ou (2) suffisent.

---

## 4. La maîtrise (mastery learning) en logiciel

On ne valide qu'au franchissement d'un **seuil**, avec re-pratique jusqu'à l'atteinte. Deux voies
combinables :

- **Voie modèle** : `p_known ≥ 0.95` (BKT).
- **Voie heuristique** : `N` **premières tentatives** correctes d'affilée (ex. N = 3-5).

Repères réels : **Khan Academy** (Familier 50 pts → Compétent 80 → Maîtrisé 100 ; un 100 % du premier coup
saute directement à « Compétent ») ; **ALEKS** (« tug-of-war » de points). Règle anti-triche : **seule la
1ʳᵉ tentative compte** pour la maîtrise ; les re-tentatives sont de la **pratique formative**.

---

## 5. Évaluation — **pas de QCM** : validation par paliers (modèle École 42)

> ❌ **On ne valide PAS par QCM auto-corrigés.** Créer des milliers de questions pour toutes les branches
> est ingérable et trahit l'esprit du projet. Le détail complet est dans
> [**le système de validation**](09-validation.md) ; voici l'essentiel pour le « cerveau » de l'app.

La validation se fait par **paliers**, dont **un seul est bloquant — et c'est le plus léger** :

| Palier | Mécanisme | Bloquant ? | Niveau de preuve |
|--------|-----------|------------|------------------|
| **1. Auto-validation** | checklist **factuelle** (pas un jugement de soi → anti-Dunning-Kruger) | **Non — débloque la suite** | faible (honnête) |
| **2. Pré-correction auto** | tests + IA encadrée (feedback, flag triche) | non | aide |
| **3. Validation par les pairs** | ≥2 pairs, **grille binaire de faits**, médiane, appariement aléatoire, monnaie d'éval | non (en file, **async**) | moyenne-forte (r≈0,69) |
| **4. Endossement expert** | épreuve / échantillonnage | non (optionnel) | forte |

**Le seul artefact à produire par compétence est une grille (checklist)** — réutilisée à l'infini par toute
la communauté. Zéro banque de QCM. Le modèle de maîtrise (BKT, §2) sert au **séquencement et au diagnostic**,
pas à « gater » par QCM.

> **Règle d'or** : la progression n'est conditionnée que par l'**auto-validation** (instantanée,
> non-bloquante) ; la **preuve forte** vient des **pairs** (jamais du seul élève, ni du seul LLM). C'est
> cohérent avec « maîtrise, pas temps » **et** non-bloquant.

---

## 6. La révision espacée (contre l'oubli)

La maîtrise (§2) n'inclut pas l'oubli. On reprogramme les compétences maîtrisées avant l'oubli probable.

- **MVP : SM-2** (l'algo historique d'Anki) — déterministe, ~30 lignes, aucune donnée d'entraînement.
  Qualité de rappel `q ∈ {0..5}` ; `EF ← EF + (0.1 − (5−q)(0.08 + (5−q)0.02))`, plancher `EF = 1.3` ;
  intervalles `1 j, 6 j, puis I·EF` ; échec (`q<3`) → on recommence (`I=1`) mais on garde l'EF.
- **Plus tard : FSRS** (défaut d'Anki depuis 2023) — meilleur, mais ~19 paramètres à optimiser sur des logs
  → inutile tant qu'on n'a pas de volume.
- **Intégration** : table `review_schedule(student_id, skill_id, due_date, …)` ; au séquencement (§3),
  injecter en priorité les éléments **dus** avant d'ouvrir de nouvelles compétences.

---

## 7. Le diagnostic initial (placement)

Situer un nouvel élève dans le graphe en **peu de questions** (~15-30), **sans IRT complet** (sur-ingénierie
au MVP). Méthode : **CAT structurel sur le DAG** (recherche binaire) :

```
poser une question sur une compétence "milieu" du curriculum
  si réussie -> présumer les prérequis acquis, sonder plus haut (compétences avales)
  si échouée -> sonder plus bas (prérequis)
répéter jusqu'à localiser la frontière maîtrisé / non-maîtrisé (l'outer fringe)
```

Chaque réponse **propage** l'information le long des arêtes → on couvre un large domaine en peu de questions.
On initialise les `p(L0)` du BKT à partir de ce diagnostic. ⚠️ Une réponse bruitée (slip/guess) peut mal
classer une branche → prévoir quelques questions de confirmation. Présenter le diagnostic comme **« on
adapte à ton niveau »**, jamais comme un examen.

---

## MVP vs sur-ingénierie

| Brique | MVP simple & rigoureux | À différer |
|--------|------------------------|------------|
| Carte | DAG en SQL + `external_ref` | Espace de connaissances complet (2ⁿ états), base graphe |
| Suivi de maîtrise | BKT 4 paramètres (~15 lignes), seuil 0,95 | Deep Knowledge Tracing (LSTM) |
| Séquencement | Outer fringe (SQL) | Optimisation par apprentissage par renforcement |
| Maîtrise | Seuil + N 1res-tentatives | Calibration fine façon ALEKS |
| Évaluation | **Auto-validation (débloque) + pairs en file** (sans QCM) | endossement expert, calibration avancée |
| Révision | SM-2 déterministe | FSRS optimisé par élève |
| Placement | CAT structurel sur le DAG | CAT IRT avec banque calibrée |

**Suite** : [prompts & continuité](03-prompts-et-continuite.md) — comment l'app pilote l'IA externe.
