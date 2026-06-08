# Les mécaniques d'engagement

> *Ce qui rend la communauté **vivante** — gamification, réputation, ligues, study-together, événements —
> avec les chiffres réels des plateformes qui marchent, et les **garde-fous** pour motiver sans manipuler
> ([principe 9](../../00-FONDATIONS/03-principes-fondateurs.md) : bien-être, pas addiction).*

---

## La règle d'or : deux monnaies, jamais confondues

C'est LE choix de conception central. On sépare strictement :

| Monnaie | Gagnée par… | Sert à… | Inspiration |
|---------|-------------|---------|-------------|
| **XP d'apprentissage** | Signaux **réels** validés par l'IA-tuteur (compétence maîtrisée, quiz réussi, quête validée) | Les **ligues**, la progression | Duolingo (corrigé) |
| **Points communauté** | **Utilité jugée par les pairs** (1 like reçu = 1 point) | Les **niveaux**, débloquer du contenu, le statut | Skool |

> ⚠️ **Pourquoi cette séparation est vitale** : Duolingo est critiqué parce que son XP récompense le
> *volume/temps*, ce qui permet le **« XP farming »** (jouer pour le classement, pas pour apprendre). Chez
> Dowze, l'XP est **mérité** : il vient de la maîtrise *prouvée*. On ne peut pas farmer une compétence qu'il
> faut démontrer. Et les points communauté récompensent l'**utilité aux autres** (likes des pairs), pas le
> fait de poster beaucoup — anti-spam par construction (modèle Skool : on ne gagne **aucun** point en
> postant, seulement quand les autres trouvent ça utile).

---

## Les niveaux communautaires (modèle Skool)

- **1 like reçu = 1 point.** On ne monte pas en spammant ; on monte en étant utile.
- **9 niveaux à seuils exponentiels** : Lvl1=0, Lvl2=5, Lvl3=20, Lvl4=65, Lvl5=155, Lvl6=515, Lvl7=2015,
  Lvl8=8015, Lvl9=33015 points. Monter haut est *durablement* difficile → les anciens sont visiblement
  reconnus.
- **Niveaux spécifiques à chaque espace** (on repart à zéro en changeant de communauté).
- **Déblocage de contenu par niveau** : certaines quêtes avancées, salons, ou ressources s'ouvrent à un
  niveau donné → la participation devient la porte d'entrée de l'apprentissage.
- **Leaderboard de niveau** par classe ; le niveau s'affiche à côté du nom.

---

## Les ligues hebdomadaires (modèle Duolingo, basé sur l'XP réel)

Le moteur de retour régulier le plus efficace connu (crédité de **+25 % de complétion de leçons** chez
Duolingo ; 4× de croissance des utilisateurs actifs depuis 2020) :

- **Cohortes de ~30** joueurs, matchés par habitudes/niveau, classés par **XP gagné sur 7 jours**.
- **Reset chaque dimanche** (heure locale).
- **Promotion dégressive** : les premiers montent de ligue, les derniers descendent ; plus on monte, plus
  c'est dur de rester (Bronze promeut ~⅔, Diamant 0 %). Crée une compétition « gagnable » (adversaires de
  niveau proche — *Goldilocks rule*).
- **Ligues** : Bronze → … → Diamant (10 paliers), Diamant avec tournoi à élimination pour le haut du panier.

**Pourquoi ça marche** (et pourquoi on l'encadre) : aversion à la perte (défendre son rang) + preuve
sociale (ne pas lâcher la cohorte). **Garde-fou Dowze** : comme l'XP = apprentissage réel, « défendre son
rang » *signifie* « apprendre vraiment » — on aligne la mécanique addictive sur le bon comportement, au
lieu de récompenser le temps d'écran.

---

## La réputation Q&A (modèle Stack Overflow)

Pour l'entraide (couche 3), une réputation qui produit du **contenu durable de qualité** :

- Upvote sur réponse **+10**, sur question **+5** ; downvote subi **−2**.
- **Réponse validée** (par l'auteur, un mentor, ou l'IA) → résout le fil, remonte en haut durablement.
- **Privilèges débloqués par paliers** : voter → valider → modérer (modération distribuée, montée
  graduelle de confiance).
- **Plafond journalier** de réputation issue des votes (anti-fermes de votes).
- **Récompenser aussi les bonnes questions** (pas que les réponses) → plus de volume sans perte de qualité.

---

## L'étude ensemble : la motivation par la présence

- **Compteur de temps d'étude + streak + leaderboard de temps** (modèle StudyLion/YPT). ⚠️ Le temps
  d'étude est un **indicateur secondaire** (présence/assiduité), **séparé de l'XP d'apprentissage** : il
  motive à venir travailler, mais ne vaut pas maîtrise. On affiche le temps, mais on **récompense la
  maîtrise**.
- **Annonce d'objectif + check-in** (modèle Focusmate) : dire ce qu'on va faire devant un témoin, puis
  rendre compte → engagement de cohérence prouvé (Matthews : 43 %→76 % d'atteinte d'objectif avec rapport
  régulier à un pair).
- **Pomodoro de groupe** : rythme collectif, signaux partagés.

---

## Social & accountability

- **Streaks d'amis / quêtes coopératives à deadline** : on ne lâche pas quand un pair compte sur soi.
- **Binômes de redevabilité** : apparier par disponibilité (le critère le plus déterminant) + objectif.
- **Mentorat « qui maîtrise enseigne »** : devenir mentor est une **récompense de statut utile** (une
  responsabilité de service), pas un score à exhiber — et c'est le meilleur ancrage pour le mentor
  lui-même (effet protégé).

---

## Le rythme live (le battement)

Le calendrier hebdomadaire (challenge lundi / AMA mercredi / study hall vendredi / recap dimanche) crée un
**battement régulier** : des rendez-vous, des raisons de revenir, de la reconnaissance publique
(shoutouts, AMA). C'est ce qui élimine le décrochage de l'apprentissage isolé en donnant du **momentum
collectif** — on voit les autres avancer.

---

## Les garde-fous anti-toxicité (synthèse)

La gamification est à double tranchant (elle peut générer anxiété → burnout : Frontiers in Public Health
2026). Règles non négociables :

| ✅ On fait | ❌ On ne fait pas |
|-----------|-------------------|
| XP = **maîtrise réelle** | XP = temps/volume (farming) |
| Points = **utilité aux pairs** (likes reçus) | Points pour le simple fait de poster |
| Streaks **doux et pardonnants** (gel de série) | Réinitialisation brutale, culpabilisation |
| Ligues en cohortes de niveau proche (gagnables) | Classement global écrasant |
| Réputation = **rôles de service** (mentor, modo) | Leaderboards de statut pur, course au score |
| Comparaison **à soi** sur le dashboard perso | Comparaison aux pairs imposée partout |
| Notifications **opt-in**, digest | Notifications pressantes par défaut |
| Temps d'étude **affiché**, maîtrise **récompensée** | Récompenser le temps d'écran |

⚠️ **Équité de genre** : la gamification compétitive aggrave l'écart H/F de participation (constat Stack
Overflow). Surveiller activement *qui* monte en niveau et *qui* devient mentor ; ne pas laisser le système
favoriser un profil.

**Suite** : [l'implémentation technique](03-implementation-technique.md).
