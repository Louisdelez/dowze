# Sciences cognitives de l'apprentissage

> *Comment le cerveau apprend, retient et oublie — et ce que cela impose à la conception de Dowze.*

---

## 1. Pratique de récupération (effet test) — TRÈS SOLIDE

**Le principe.** Récupérer activement une information en mémoire (se tester) renforce la rétention bien
plus que la relecture passive. C'est l'un des effets les mieux établis de toute la psychologie cognitive.

**Les preuves.**
- Roediger & Karpicke (2006) : +50 % de rétention à long terme vs relecture répétée.
- Méta-analyse Adesope, Trevisan & Sundararajan (2017), **217 études** : **g ≈ 0,61–0,70**.
- Méta-analyse Rowland (2014) : **g ≈ 0,50**.

**Limites.** L'effet s'atténue pour du matériel très complexe sur intervalles courts, ou sans feedback ;
quelques réplications en ligne échouent. Maximal pour le rappel **différé** et du matériel modérément
difficile, **avec feedback**.

**→ Conception Dowze.** Les [Quêtes](../03-ARCHITECTURE/03-quetes.md) intègrent du test/rappel actif, pas
de la relecture ; le [Mentor](../03-ARCHITECTURE/02-mentor.md) fait *récupérer* avant d'expliquer ; le
feedback est systématique.

---

## 2. Répétition espacée & courbe de l'oubli — TRÈS SOLIDE

**Le principe.** L'oubli suit une courbe décroissante (Ebbinghaus, 1885). Réviser à **intervalles
croissants** (au lieu de bachoter) produit une rétention long terme nettement supérieure (effet
d'espacement).

**Les preuves.**
- Réplication moderne d'Ebbinghaus (Murre & Dros, 2015, PLOS ONE) : correspondance frappante avec 1885.
- Méta-analyse Cepeda et al. (2006), **184 articles / 317 expériences** : la pratique espacée bat la
  pratique massée dans la grande majorité des cas. L'intervalle optimal **dépend de l'horizon de
  rétention** visé.

**Limites.** Les chiffres populaires (« 70 % oublié en 24 h ») sont des approximations, pas des
constantes ; fortes différences individuelles ; données issues de matériel artificiel, à généraliser avec
prudence.

**→ Conception Dowze.** Le Mentor **orchestre la révision espacée** (planification automatique des
rappels) pour ancrer durablement les compétences validées — voir
[conception du Mentor](../05-TECHNIQUE/03-conception-mentor-IA.md).

---

## 3. Théorie de la charge cognitive (Sweller) — SOLIDE

**Le principe.** La mémoire de travail est très limitée ; apprendre = construire des schémas en mémoire
long terme. Trois charges : **intrinsèque** (complexité du contenu), **extrinsèque** (due à une mauvaise
conception — à minimiser), **germane** (consacrée à la construction de schémas).

**Effets documentés** : effet d'exemple résolu (*worked example*), d'attention partagée, de redondance,
et surtout l'**effet d'inversion d'expertise** : les exemples résolus aident les novices mais deviennent
nuisibles aux experts → l'instruction **doit s'adapter au niveau**.

**Limites.** La distinction germane/intrinsèque a été jugée parfois circulaire (Sweller a révisé le
modèle). La mesure de la charge reste débattue.

**→ Conception Dowze.** Réduire la charge extrinsèque (interfaces sobres, une chose à la fois) ; donner
des exemples résolus aux débutants puis les retirer (scaffold-and-fade) ; le Mentor module la complexité
selon le niveau estimé.

---

## 4. Difficultés désirables (Bjork) — CADRE INTÉGRATEUR SOLIDE

**Le principe.** Des conditions qui *ralentissent* l'acquisition améliorent souvent la rétention et le
transfert à long terme. Cinq difficultés désirables à forte base empirique : **espacement, entrelacement
(interleaving), récupération, génération, pratique variée**. Clé : l'« illusion de fluidité » (croire
qu'on apprend parce que c'est facile) est trompeuse.

**Limite cruciale — la tension avec la charge cognitive.** Une difficulté n'est « désirable » que si
l'apprenant a les **prérequis pour finir par réussir**. Pour un vrai novice, ou sur du matériel très
complexe, la difficulté ajoutée devient **« catastrophique »** (Sweller). Il faut donc **arbitrer selon
l'expertise** :

| Niveau de l'apprenant | Stratégie |
|-----------------------|-----------|
| Novice | Guidage fort, exemples résolus, faible difficulté ajoutée |
| Intermédiaire | Difficultés désirables croissantes (espacement, entrelacement) |
| Avancé | Problèmes ouverts, retrait des exemples (sinon redondance nuisible) |

**→ Conception Dowze.** C'est précisément ce que fait le Mentor en *scaffold-and-fade* : il calibre la
difficulté « juste assez dure pour faire grandir, pas assez pour décourager ».

---

## 5. Pédagogie de maîtrise — SOLIDE (effet modéré, robuste)

**Le principe.** On ne progresse à l'unité suivante qu'après avoir démontré la maîtrise (~80-90 %), avec
feedback diagnostique, remédiation et re-test.

**Les preuves.** Méta-analyse Kulik, Kulik & Bangert-Drowns (1990), **108 évaluations contrôlées** :
**d ≈ 0,52**, effets plus forts pour les apprenants faibles.

**Limites.** Effet fortement **dépendant du type de test** (plus faible sur tests standardisés
indépendants) et partiellement attribuable au **temps additionnel** (la maîtrise prend plus de temps).
À cadrer : effet réel mais modeste, surtout bénéfique aux apprenants en difficulté.

**→ Conception Dowze.** Fonde le [principe 1](../00-FONDATIONS/03-principes-fondateurs.md) (« la maîtrise,
pas le temps ») et la **maîtrise-barrière** des Quêtes : on ne valide qu'en démontrant.

---

## 6. Métacognition & apprendre à apprendre — SOLIDE, TRÈS RENTABLE

**Le principe.** Connaître et réguler ses propres processus (planifier, surveiller, évaluer) ;
l'apprentissage autorégulé combine stratégies cognitives, métacognitives et motivationnelles.

**Les preuves.** SRL : d ≈ 0,57 (Hattie). Programmes de *study skills* (Hattie, Biggs & Purdie 1996) :
performance g ≈ 0,27, **affect/motivation g ≈ 0,68**. L'EEF (UK) classe « métacognition et autorégulation »
parmi les interventions au meilleur rapport coût-bénéfice.

**Limites.** S'enseigne mieux **ancrée dans une discipline** que comme « cours de méthode » générique ;
transfert plus difficile chez les jeunes enfants.

**→ Conception Dowze.** Le Mentor « enseigne à apprendre » (gestion de l'attention, de la motivation, de
l'énergie) **en contexte**, dans le fil des Quêtes — jamais comme un module abstrait isolé.

---

## Synthèse : les quatre piliers cognitifs de Dowze

Ces quatre leviers sont les **mieux étayés et mutuellement renforçants** :

1. **Récupération** (se tester) +
2. **Espacement** (réviser à intervalles croissants) +
3. **Maîtrise** (ne pas avancer avant d'avoir compris) +
4. **Métacognition** (apprendre à apprendre, en contexte)

— le tout **calibré à l'expertise** via le cadre des difficultés désirables, et **respectueux de la charge
cognitive**. C'est le socle scientifique sur lequel reposent le Mentor et les Quêtes.

**Sources** : voir [bibliographie](../09-ANNEXES/01-bibliographie.md), section « Sciences cognitives ».
Tableau des effets : [05-tableau-preuves.md](05-tableau-preuves.md).
