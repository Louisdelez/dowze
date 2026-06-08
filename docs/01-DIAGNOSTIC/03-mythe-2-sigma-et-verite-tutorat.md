# Le « problème des 2 sigma » de Bloom : mythe vs réalité

> **Lecture clé.** Beaucoup de projets « EdTech » s'appuient sur le « 2 sigma » comme sur un fait acquis.
> C'est une erreur. Ce chapitre rétablit la vérité — non pour affaiblir Dowze, mais pour le fonder sur du
> solide plutôt que sur un slogan.

---

## Ce que Bloom a affirmé (1984)

Benjamin Bloom publie en 1984 un article célèbre, *The 2 Sigma Problem*. Sa thèse :

- un élève bénéficiant d'un **tutorat individuel** (1-à-1) **combiné à la pédagogie de maîtrise**
  performerait environ **2 écarts-types (2σ) au-dessus** d'un élève en classe conventionnelle ;
- concrètement, l'élève médian ainsi accompagné dépasserait **~98 %** des élèves d'une classe ordinaire.

Le « problème » posé par Bloom n'était pas pédagogique mais **économique** : comment reproduire cet effet
par des méthodes de groupe abordables, puisqu'un tuteur par enfant était « trop coûteux pour qu'une
société le supporte à grande échelle » ?

C'est une intuition séduisante. Elle a nourri d'innombrables discours sur l'IA éducative. **Le problème :
elle ne résiste pas à l'examen des preuves.**

---

## Ce que disent réellement les preuves

### 1. La base empirique d'origine était mince

L'affirmation repose sur **deux thèses de doctorat** de l'Université de Chicago (Anania ; Burke), portant
sur de **petites expériences de ~3 semaines**, sur du matériel pédagogique inédit, évaluées par des tests
conçus par les expérimentateurs eux-mêmes. Une part substantielle de l'effet (~1,1σ) provenait en réalité
du **feedback et des tests supplémentaires**, et non du tutorat en soi.

### 2. Le 2σ n'a jamais été répliqué

Aucune étude rigoureuse n'a reproduit un effet de 2σ. Les méta-analyses modernes du tutorat trouvent des
effets **bien plus modestes** :

| Source | Effet du tutorat (d) |
|--------|----------------------|
| Bloom 1984 (affirmation) | **≈ 2,0** |
| Cohen, Kulik & Kulik 1982 (méta-analyse) | ≈ 0,33 |
| **Nickow, Oreopoulos & Quan 2020** (méta-analyse NBER, **96 études randomisées**) | **≈ 0,37** |

Aucune des 96 études randomisées de Nickow et al. n'atteint 2σ. L'effet réel du tutorat est donc
d'environ **un dixième** de la valeur célèbre de Bloom.

### 3. Même le tutorat *humain* n'est pas magique

La méta-analyse de référence sur les systèmes tutoriels (VanLehn 2011) trouve que le **tutorat humain**
produit un effet de **d ≈ 0,79** (vs absence de tutorat), et non 2,0. VanLehn *réfute* explicitement le
2σ. Surtout, il montre que les **systèmes tutoriels « step-based » atteignent d ≈ 0,76** — c'est-à-dire
**quasiment aussi bien qu'un tuteur humain**. C'est cette marge-là, réelle et atteignable, qui fonde
l'espoir d'un tuteur scalable.

---

## Pourquoi ça ne tue pas Dowze — au contraire

On pourrait croire que démonter le 2σ affaiblit le projet. C'est l'inverse, pour trois raisons :

1. **d ≈ 0,37 reste l'un des effets les plus forts connus en éducation.** Beaucoup d'interventions
   coûteuses peinent à dépasser d ≈ 0,1–0,2. Un tuteur de qualité pour tous, même « seulement » à 0,37,
   serait une transformation majeure — *à condition* d'être accessible à tous, ce que Dowze vise.

2. **Dowze ne mise pas sur un levier unique mais sur un empilement de leviers prouvés** :

   | Levier | Effet typique | Statut |
   |--------|---------------|--------|
   | Tutorat (Mentor) | d ≈ 0,37 | Solide |
   | Pédagogie de maîtrise | d ≈ 0,52 | Solide |
   | Pratique de récupération espacée | g ≈ 0,5–0,7 | Très solide |
   | Métacognition / apprendre à apprendre | d ≈ 0,57 | Solide |
   | Apprendre par projet (guidé) | d ≈ 0,44–0,65 | Positif, à guider |
   | Apprendre en enseignant | effet significatif | Solide |

   Ces leviers ne s'additionnent pas linéairement, mais ils **se renforcent mutuellement** (le cadre des
   « difficultés désirables » de Bjork le théorise). C'est l'architecture qui crée la valeur, pas un
   chiffre miracle.

3. **Le vrai résultat actionnable de 2025 est ailleurs** : l'efficacité d'un tuteur IA dépend de sa
   **conception pédagogique**, pas de sa puissance brute (voir
   [état de l'art IA](../02-SCIENCE/04-etat-art-IA-education.md) et [Mentor](../03-ARCHITECTURE/02-mentor.md)).
   - **Avec garde-fous** : +0,7 à +1,3σ (Kestin et al., *Scientific Reports*, 2025).
   - **Sans garde-fous** : −17 % d'apprentissage durable (Bastani et al., *PNAS*, 2025).

---

## Règle de communication de Dowze

> **Ne jamais citer le « 2 sigma » comme un fait.** Le présenter, si besoin, comme une *intuition
> historique célèbre mais infirmée*, et lui substituer les chiffres réels (tutorat d ≈ 0,37 ; ITS
> step-based d ≈ 0,76 ; IA encadrée jusqu'à +1,3σ dans une étude). L'honnêteté sur les preuves est un
> [principe fondateur](../00-FONDATIONS/03-principes-fondateurs.md) (n° valeur « honnêteté »).

---

## Sources

- Bloom, B. S. (1984). *The 2 Sigma Problem*. Educational Researcher, 13(6), 4-16.
- Nickow, Oreopoulos & Quan (2020). *The Impressive Effects of Tutoring on PreK-12 Learning*. NBER.
- Cohen, Kulik & Kulik (1982). Méta-analyse du tutorat.
- VanLehn, K. (2011). *The Relative Effectiveness of Human Tutoring, Intelligent Tutoring Systems, and
  Other Tutoring Systems*. Educational Psychologist.
- Revue critique : Nintil, *Bloom's two sigma problem: A systematic review* ; Education Next, *Two-Sigma
  Tutoring: Separating Science Fiction from Science Fact*.

Détail complet en [bibliographie](../09-ANNEXES/01-bibliographie.md).
