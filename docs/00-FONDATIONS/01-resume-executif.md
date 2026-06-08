# Résumé exécutif

> *À lire en premier. Quatre pages pour comprendre l'essentiel : le problème, la solution, les preuves,
> le plan, et les risques.*

---

## 1. Le problème

Le modèle scolaire dominant descend pour l'essentiel du **modèle prussien du XIXᵉ siècle**, pensé pour
une société industrielle : classes par âge, programme standardisé, progression au temps (et non à la
maîtrise), examen final, diplôme. Sa forme **n'a presque pas changé en 150 ans**, alors que le monde a
radicalement changé.

Six pannes structurelles en découlent (détail : [Diagnostic § failles](../01-DIAGNOSTIC/02-failles-structurelles.md)) :

1. On avance **au temps, pas à la maîtrise** → les lacunes s'accumulent, invisibles.
2. **Une taille unique pour tous** → le rythme moyen ne convient à presque personne.
3. **Le diplôme ≠ la compétence** → il atteste un temps passé, pas un savoir-faire.
4. **Une éducation épisodique** (concentrée sur la jeunesse) dans un monde qui exige d'apprendre en continu.
5. **Le lieu et l'âge comme barrières** d'accès.
6. **Un savoir qui se périme** plus vite que les programmes ne se mettent à jour.

Deux chiffres résument la crise du modèle de **certification** :

- **85 %** des employeurs déclarent recruter « sur les compétences »… mais dans les faits,
  **moins d'1 embauche sur 700** concerne réellement une personne sans diplôme dans les grandes
  entreprises ayant pourtant retiré l'exigence de diplôme (Burning Glass Institute & Harvard Business
  School, 2024). Le diplôme survit **faute de remplaçant crédible** — pas parce qu'il est bon.

Et le **mur de l'accès** : en 2024, **2,6 milliards d'humains restent hors ligne** (32 % de l'humanité),
concentrés dans les zones rurales (1,8 milliard) et les pays pauvres (ITU, *Facts and Figures 2024*).

---

## 2. L'intuition fondatrice (et la rectification honnête)

On cite souvent le **« problème des 2 sigma » de Bloom (1984)** : un élève avec tuteur personnel +
pédagogie de maîtrise dépasserait 98 % d'une classe ordinaire. C'est une **belle intuition mais un
résultat empiriquement infirmé** : il n'a jamais été répliqué, et les méta-analyses modernes du tutorat
trouvent un effet réel d'environ **d ≈ 0,37** (Nickow, Oreopoulos & Quan, 2020) — soit ~un dixième de la
valeur célèbre. Voir [le démontage du mythe](../01-DIAGNOSTIC/03-mythe-2-sigma-et-verite-tutorat.md).

**Pourquoi est-ce important ?** Parce que Dowze ne repose *pas* sur une promesse magique. L'effet réel du
tutorat (~0,37) reste **l'un des plus forts connus en éducation**, et il se *combine* avec d'autres
leviers très solides : pédagogie de maîtrise (d ≈ 0,52), pratique de récupération espacée (g ≈ 0,5–0,7),
métacognition (d ≈ 0,57). Le pari de Dowze est l'**empilement de leviers prouvés**, pas un miracle.

---

## 3. La solution : la pile Dowze

Dowze est conçu comme une **pile** de 6 couches, car la leçon de l'échec des solutions actuelles est
claire : *les briques existent, c'est l'architecture qui les relie qui manque.*

| Couche | Nom | Résout |
|--------|-----|--------|
| 1 | **L'Atlas** | Carte vivante et ouverte de tous les savoirs (vs programme figé) |
| 2 | **Le Mentor** | IA-tuteur personnel qui *fait penser* au lieu de penser à votre place |
| 3 | **Les Quêtes** | Apprendre par projets réels, maîtrise par l'acte (vs cours passif) |
| 4 | **Les Cercles, Guildes & Foyers** | Le lien humain — l'antidote au décrochage de masse |
| 5 | **La Preuve** | Passeport de compétences vérifiable (vs diplôme) |
| 6 | **Le Socle** | Gouvernance en commun, financement, équité, sûreté |

Détail couche par couche : [Architecture](../03-ARCHITECTURE/).

**Le résultat scientifique le plus actionnable de notre recherche** : l'efficacité d'un tuteur IA dépend
presque entièrement de sa **conception pédagogique**, pas de la puissance du modèle. Même LLM, deux
résultats opposés :
- **avec garde-fous** (scaffolding, refus de donner la réponse) : effet de +0,7 à +1,3 écart-type
  (Kestin et al., *Scientific Reports*, 2025) ;
- **sans garde-fous** (ChatGPT brut) : meilleure performance pendant l'usage, mais **−17 % à l'examen**
  une fois l'IA retirée (Bastani et al., *PNAS*, 2025).

C'est le cœur de la conception du [Mentor](../03-ARCHITECTURE/02-mentor.md).

---

## 4. Ce qui rend Dowze différent des tentatives passées

Chaque solution existante résout *un* morceau et échoue sur l'ensemble (analyse complète :
[Diagnostic § alternatives](../01-DIAGNOSTIC/05-analyse-alternatives.md)) :

- **MOOC** : achèvement médian **12,6 %** (Katy Jordan ; ~5 % de certifiés sur edX) — liberté sans
  cadre = abandon.
- **École 42** (sans prof, P2P) : marche, mais **filtre** au lieu d'inclure (<30 % de complétion, public
  auto-sélectionné hyper-motivé).
- **OLPC, Hole-in-the-Wall** : l'accès matériel seul ne produit **aucun gain** d'apprentissage durable.
- **IA seule** : délestage cognitif, érosion de l'esprit critique.

Dowze en tire **six méta-enseignements** (voir [synthèse du diagnostic](../01-DIAGNOSTIC/README.md)) :
l'accès ne suffit jamais ; l'autonomie doit être *structurée* ; l'ouverture profite d'abord aux favorisés
(effet Matthew) ; l'offline-first est nécessaire ; il faut se méfier des métriques auto-déclarées ;
il faut adapter au stade de vie.

---

## 5. De la naissance à la mort

L'âge n'est plus une donnée du système. On entre, sort, bifurque, recommence à tout moment.
(Détail : [Parcours de vie](../04-PARCOURS-DE-VIE/).)

- **0–6 ans** : le terminal est l'outil **du parent**, pas de l'enfant (les autorités de santé
  déconseillent les écrans avant ~2 ans). Dowze *outille les adultes* pour l'éveil et le jeu.
- **6–18 ans** : exploration guidée, fondations, projets réels, premières Guildes, premières preuves.
- **Adulte** : apprendre et travailler fusionnent ; pivots de carrière ; on mentore les plus jeunes.
- **Âge mûr** : continuer à grandir **et transmettre** — l'expérience devient un trésor commun.

---

## 6. Le plan

Une feuille de route en **4 phases** (détail : [Mise en œuvre](../08-MISE-EN-OEUVRE/01-feuille-de-route.md)) :

0. **Les normes** — poser les standards ouverts (Atlas, Passeport, spec pédagogique du Mentor).
1. **Le pilote** — prouver l'effet sur un domaine + une région, avec mesure rigoureuse (RCT).
2. **L'échelle** — multidomaine, multilingue, reconnaissance du Passeport, kits offline.
3. **Le basculement** — réorientation des budgets publics, reconversion des bâtiments scolaires en
   Foyers, reconnaissance légale du Passeport.

**Métriques de succès** (détail : [métriques](../08-MISE-EN-OEUVRE/03-metriques-evaluation.md)) : gains de
maîtrise mesurés par RCT ; persévérance (vs ~12 % des MOOC) ; **équité de portée** (combien d'exclus
progressent) ; confiance du marché dans le Passeport ; bien-être ; coût par apprenant décroissant.

---

## 7. Les risques, regardés en face

Un projet sérieux affronte ses failles (détail : [Risques & éthique](../07-RISQUES-ETHIQUE/)) :

- **Délestage cognitif** → conception « qui questionne », validation finale *sans* IA.
- **Décrochage** → la couche humaine (Cercles/Guildes/Foyers).
- **Élitisme / fracture** → équité d'abord, offline-first, déploiement inversé.
- **Sécurité des mineurs** → jamais de chatbot « compagnon » non bridé ; conformité AI Act / RGPD / COPPA.
- **Capture** (par un État ou une entreprise) → gouvernance en commun, open source, fédération.

---

## En une phrase

> **Dowze rassemble pour la première fois les briques qui existent enfin — IA-tuteur encadrée, savoir
> mondial gratuit, preuve infalsifiable, communautés — dans une architecture en bien commun qui tient
> ensemble sept exigences qu'aucune solution actuelle ne tient à la fois.**

Ce n'est pas une meilleure école. C'est l'apprentissage comme **droit continu, personnel et partagé**,
de la naissance à la mort.
