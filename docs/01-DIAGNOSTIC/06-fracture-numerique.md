# Le mur de l'accès : la fracture numérique

> *Un système « terminal + internet » se heurte à un fait qu'il serait malhonnête d'ignorer : une grande
> partie de l'humanité n'a pas (encore) ces deux choses. Ce chapitre transforme ce mur en **contrainte de
> conception**.*

---

## Les chiffres (ITU, *Facts and Figures 2024*)

| Indicateur | Valeur 2024 |
|------------|-------------|
| Personnes en ligne | **5,5 milliards (68 %)** |
| Personnes **hors ligne** | **2,6 milliards (32 %)** |
| …dont en zone rurale | **1,8 milliard** |
| En ligne — pays à revenu **élevé** | 93 % |
| En ligne — pays à **faible** revenu | **27 %** |
| En ligne — pays les moins avancés (PMA) | 35 % |
| Fracture **urbain / rural** | 83 % vs **48 %** |
| Fracture de **genre** (hommes / femmes) | 70 % vs 65 % (≈ 189 M d'hommes en plus) |
| Couverture **5G** — revenu élevé vs faible | 84 % vs **4 %** |
| Possession de mobile — revenu élevé vs faible | 95 %+ vs **56 %** |
| Trafic mobile mensuel — revenu élevé vs faible | 16,2 Go vs **2 Go** |
| Coût d'un abonnement haut débit fixe (pays pauvre) | ≈ **1/3 du revenu mensuel** |

Sources : ITU, *Measuring Digital Development: Facts and Figures 2024* (nov. 2024) ; UN DESA (2025).

---

## Trois lectures essentielles de ces chiffres

### 1. « Être en ligne » ≠ avoir une connexion *utile*

L'écart **2 Go vs 16 Go/mois** signifie qu'une large part des « connectés » **ne peut pas** streamer de
la vidéo ni télécharger de gros contenus. Un système éducatif qui suppose la vidéo HD en continu exclut de
fait des centaines de millions de « connectés ». → Dowze doit être **texte/voix d'abord, vidéo
optionnelle, léger par défaut**.

### 2. Le coût est aussi décisif que la couverture

Quand un abonnement coûte un tiers du revenu mensuel, la connexion existe « techniquement » mais reste
**inabordable**. → Dowze doit fonctionner en **basse consommation de données** et viser le **zéro-rating**
(accès sans coût de données) via des partenariats.

### 3. Les fractures se cumulent sur les mêmes personnes

Rural **et** pauvre **et** femme **et** langue minoritaire : les exclusions s'**empilent**. Concevoir
« pour la moyenne » revient à concevoir pour les déjà-inclus. → C'est la justification du **principe
« équité d'abord »** et du **déploiement inversé**.

---

## La conséquence de conception : l'équité comme pilier, pas comme intention

Un système d'éducation universel qui suppose la connexion **creuserait les inégalités** s'il ne traitait
pas l'accès comme **le tout premier problème, pas le dernier**. C'est ce que la recherche appelle le
« troisième fossé numérique » (Brookings, 2023) : *« les riches ont accès à la technologie et aux
personnes pour l'utiliser ; les pauvres n'ont accès qu'à la technologie. »*

Dowze en fait un pilier architectural (détaillé dans [équité & inclusion](../04-PARCOURS-DE-VIE/06-equite-inclusion.md)
et la [spec offline-first](../05-TECHNIQUE/05-offline-first.md)) :

- **Hors-ligne d'abord** : Mentor et tranches d'Atlas **téléchargeables**, synchronisation opportuniste
  (même intermittente). Modèle validé par **Kolibri** (Learning Equality) et **RACHEL** : un appareil
  « seed » télécharge une fois là où il y a du réseau, puis partage en réseau local — voire est transporté
  à pied (« sneakernet »).
- **Basse consommation** : terminaux modestes, faible bande passante, mode texte/voix.
- **Multilinguisme radical** : les langues minoritaires sont des **branches de l'Atlas**, pas des
  après-coups (rappel : Hole-in-the-Wall a échoué en partie faute de contenu dans la langue des enfants).
- **Les Foyers comme points d'accès** : là où il n'y a pas de connexion à domicile, le Foyer
  (bibliothèque, centre, ancienne école) fournit terminal *et* lien, et sert de relais de connectivité.
- **Le terminal et la donnée comme droits** : Dowze plaide pour faire de l'accès un droit (comme l'eau ou
  l'électricité) et noue des partenariats publics pour le rendre effectif.
- **Déploiement inversé** : on ne commence pas par les zones déjà servies. On conçoit *pour* le village
  sans fibre et *pour* la femme tenue à l'écart du numérique. Ce qui marche pour eux marchera pour tous.

---

## La limite honnête

Dowze ne peut pas, seul, connecter 2,6 milliards de personnes — c'est un problème d'infrastructure
mondiale (réseaux, électricité, terminaux abordables) qui dépend des États, opérateurs et bailleurs.

Ce que Dowze *peut* faire :
1. ne **jamais aggraver** la fracture par ses choix de conception (offline-first, léger, multilingue) ;
2. **maximiser l'utilité** de chaque octet et de chaque Foyer disponible ;
3. **plaider et s'allier** pour étendre l'accès, en montrant qu'une infrastructure d'apprentissage existe
   et n'attend que la connexion.

C'est une posture d'**humilité** : reconnaître ce qui dépasse le projet, tout en refusant de s'en servir
comme excuse pour concevoir « pour les déjà-connectés ».

---

## Sources

- ITU (2024). *Measuring Digital Development: Facts and Figures 2024*.
- UN DESA (2025). *Progress and Gaps: Key Findings from ITU's Facts and Figures*.
- Brookings / Trucano (2023). *AI and the next digital divide in education*.
- Learning Equality. *Kolibri* (offline-first).

Détail en [bibliographie](../09-ANNEXES/01-bibliographie.md).
