# État de l'art : IA et technologie en éducation (2023-2026)

> *Ce que la recherche prouve réellement — distingué de la hype marketing. Le résultat central :
> l'efficacité d'un tuteur IA dépend de sa **conception pédagogique**, pas de la puissance du modèle.*

---

## Le résultat central : conception > puissance du modèle

Deux essais contrôlés randomisés, **même technologie (LLM), résultats opposés** :

| Étude | Dispositif | Résultat |
|-------|------------|----------|
| **Kestin et al. 2025** (*Scientific Reports*/Nature) | Tuteur IA **avec garde-fous** (scaffolds experts, raisonnement pas-à-pas, anti-hallucination), physique, ~194 étudiants Harvard | **+0,7 à +1,3 écart-type** vs cours actif, en **moins de temps** |
| **Bastani et al. 2025** (*PNAS*) | ChatGPT **brut** vs tuteur **avec garde-fous** vs témoin, ~1 000 lycéens | Brut : +48 % pendant l'usage mais **−17 % à l'examen** une fois l'IA retirée. Les garde-fous neutralisent le mal. |

**Conclusion à graver dans l'architecture** : un même LLM peut **doubler** les gains ou **détériorer**
l'apprentissage durable. La variable décisive est le **design** (scaffolding, refus de donner la réponse,
fading), pas le modèle. C'est tout l'enjeu de la conception du [Mentor](../03-ARCHITECTURE/02-mentor.md).

> ⚠️ Limites de Kestin : petit échantillon, étudiants très motivés (Harvard), sessions **surveillées** —
> l'effet pourrait ne pas survivre en usage autonome. À ne pas sur-vendre.

---

## 1. Systèmes tutoriels intelligents (ITS) — la base historique

Méta-analyse de référence (VanLehn 2011) :

| Dispositif | Effet (d) vs absence de tutorat |
|------------|-------------------------------|
| Tutorat **humain** | ≈ 0,79 |
| ITS **step-based** (feedback à chaque étape) | **≈ 0,76** |
| ITS substep-based | ≈ 0,40 |
| Tutorat answer-based (feedback réponse finale seulement) | ≈ 0,31 |

Point capital : les ITS *step-based* sont **quasiment aussi efficaces qu'un tuteur humain**. C'est la
marge réelle dans laquelle un Mentor scalable peut jouer (et cela réfute au passage le « 2 sigma » —
voir [le mythe](../01-DIAGNOSTIC/03-mythe-2-sigma-et-verite-tutorat.md)).

**Limites** : ITS classiques coûteux à construire, limités aux domaines bien structurés (maths,
programmation), peu de transfert. Les LLM lèvent en partie le coût de construction — au prix de nouveaux
risques (hallucination, offloading).

---

## 2. Tuteurs LLM déployés (Khanmigo, Duolingo) — adoption ≠ efficacité

- **Khanmigo** (Khan Academy, sur GPT-4) : déploiement de référence, passé de ~68 000 à **>700 000**
  utilisateurs (2024-25), 380+ districts. **Mais aucune preuve causale publiée (RCT)** qu'il améliore les
  résultats : les chiffres sont des métriques d'**adoption**, pas d'apprentissage. Retours de terrain
  mitigés (saisie d'équations difficile, tuteur trop bavard).
- **Duolingo / Birdbrain** : modèle adaptatif (théorie de réponse à l'item). Chiffres d'efficacité (« +17 %
  de réussite par session ») issus d'**études internes** (conflit d'intérêt) et souvent auto-déclaratifs.

**Leçon** : se méfier des chiffres d'adoption et de fournisseur. Seuls les RCT indépendants prouvent
l'efficacité.

---

## 3. Knowledge tracing (modéliser l'état de connaissance) — utile, à garder interprétable

- **BKT** (Bayesian Knowledge Tracing, 1995) : modèle de Markov caché, 4 paramètres par compétence
  (*learn, guess, slip*, état initial). **Interprétable.**
- **DKT** (Deep Knowledge Tracing, 2015) : réseau de neurones, performant mais **boîte noire**.

Nuance importante (Khajah et al. 2016) : un **BKT bien réglé égale DKT** en moyenne. L'avantage du deep
learning était en partie un artefact de comparaisons mal optimisées.

**→ Conception Dowze.** Privilégier l'**interprétabilité** (un paramètre = une compétence) pour que
l'apprenant *et* le Mentor comprennent où en est la maîtrise. Voir
[conception du Mentor](../05-TECHNIQUE/03-conception-mentor-IA.md).

---

## 4. Génération de contenu & évaluation automatisée — human-in-the-loop obligatoire

Les LLM génèrent exercices et explications, et notent des copies. Mais la fiabilité de la **notation
automatique** est **modeste et instable** : corrélation LLM-humains négligeable à modérée, GPT-4 souvent
plus sévère, bon sur la forme (grammaire) mais faible sur le **contenu et l'argumentation**. Risque de
**biais** (pénalisation des locuteurs non natifs) et d'incohérence (même copie, notes différentes).

**→ Conception Dowze.** L'IA peut aider au **feedback formatif à faible enjeu**, jamais à la validation
sommative seule. La validation de compétence passe par la **preuve de travail réel** et la vérification
multi-source (humaine pour les enjeux élevés). Voir [Passeport](../03-ARCHITECTURE/05-preuve-passeport.md).

---

## 5. Réalité virtuelle / augmentée — effets modestes et décroissants

Méta-analyses : VR immersive **g ≈ 0,38** (effet petit à moyen), avec une **tendance temporelle
décroissante** (les effets forts des premières études s'érodent — effet de nouveauté). Coût matériel,
inconfort sur sessions longues.

**→ Conception Dowze.** La VR/AR est un **complément ponctuel** (simulation d'un labo, d'un geste
technique), **pas un pilier**. On ne mise pas dessus.

---

## 6. La méthodologie à imiter : le « learning engineering » prouvé par RCT

Le meilleur modèle méthodologique du domaine est **ASSISTments** : effets de **0,18 à 0,29 écart-type**
sur tests standardisés, confirmés par plusieurs RCT à grande échelle, classé **Tier 1** (Evidence for
ESSA). Carnegie Learning / MATHia teste ses améliorations par A/B testing (outil open-source UpGrade) sur
des dizaines de milliers d'apprenants.

**→ Conception Dowze.** Dowze adopte cette culture : **améliorations incrémentales prouvées par RCT**, à
grande échelle, plutôt que des promesses. Voir [métriques & évaluation](../08-MISE-EN-OEUVRE/03-metriques-evaluation.md).

---

## 7. Les échecs documentés — apprendre du désastre LAUSD « Ed »

Le district de Los Angeles a lancé en 2024 un chatbot « Ed » (contrat ~6 M$). Le fournisseur (AllHere)
s'est **effondré** quelques mois après le lancement ; la fondatrice a été arrêtée pour fraude. Leçons :

- **procurement rigoureux** (ne pas acheter un produit custom comme s'il existait sur étagère) ;
- **ne pas dépendre d'un fournisseur unique fragile** ;
- **protéger les données élèves** (que sont-elles devenues à la faillite ?) ;
- **human-in-the-loop** indispensable.

Ces leçons nourrissent la [gouvernance](../06-GOUVERNANCE-ECONOMIE/01-gouvernance-commun.md) et la
[conformité](../06-GOUVERNANCE-ECONOMIE/03-juridique-conformite.md) de Dowze.

---

## Conclusions transversales

1. **Conception pédagogique > puissance du modèle** (Kestin vs Bastani).
2. **Adoption ≠ efficacité** (Khanmigo, Duolingo) ; n'invoquer que des RCT indépendants.
3. **Le « 2 sigma » est un mythe** ; le tutorat humain ≈ 0,79σ, les ITS step-based ≈ 0,76σ.
4. **Knowledge tracing** : garder l'interprétabilité (BWT réglé ≈ DKT).
5. **Risque n°1 à concevoir contre** : le délestage cognitif.
6. **VR/AR** : complément, pas pilier.
7. **Gouvernance** : le cas LAUSD impose rigueur, indépendance, protection des données, human-in-the-loop.

**Sources** : Kestin et al. 2025 ; Bastani et al. 2025 ; VanLehn 2011 ; Khajah et al. 2016 ; ASSISTments
(Evidence for ESSA). Détail en [bibliographie](../09-ANNEXES/01-bibliographie.md).
