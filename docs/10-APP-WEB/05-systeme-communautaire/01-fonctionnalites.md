# Les fonctionnalités du système communautaire

> *La liste complète de ce qu'on construit, couche par couche, avec les mécaniques concrètes. Chaque
> fonctionnalité est inspirée d'une plateforme qui la fait réellement marcher.*

---

## Couche 1 — Les Espaces (l'architecture)

### L'Espace-Classe
L'unité de base : une **cohorte de 20-30 élèves** (taille optimale d'une communauté d'apprentissage) qui
partagent un même espace. Un seul écran regroupe **feed + parcours + calendrier + annuaire + salles
d'étude + Q&A** (modèle Mighty Networks : un espace multi-fonctions ; clarté de navigation façon Circle).

Pourquoi une classe et pas un forum géant ? Parce que les MOOC ont prouvé qu'un forum unique noyé sous le
volume **tue les réponses**. Une cohorte de 20-30 reste **vivable** : on connaît les gens, on est attendu,
on répond.

### Les Guildes (espaces transverses par matière)
Au-dessus des classes, des **Guildes par domaine** (Maths, Langues, Code, Sciences…) — espaces
**inter-classes** dédiés à l'**entraide Q&A** (couche 3) et au **mentorat**. Une Guilde est l'unité de
« réseau atomique » : chaque matière atteint sa masse critique indépendamment, et s'auto-gouverne quand
elle mûrit. (Lien avec les [Guildes de l'architecture](../../03-ARCHITECTURE/04-cercles-guildes-foyers.md).)

### L'annuaire de membres + matching
Chaque espace a un **annuaire consultable** (« People Explorer » de Mighty) : qui sont les autres, leur
niveau, leurs objectifs. Couplé à un **matching** (voir [implémentation](03-implementation-technique.md#6-matching))
qui suggère des partenaires d'étude de même niveau/objectif/disponibilité.

---

## Couche 2 — Feed & contenu communautaire

- **Le feed de classe** : posts, partage de progrès (« j'ai validé la compétence X ! »), questions,
  sondages, **shoutouts** (reconnaissance publique d'un pair).
- **Discussion attachée à chaque leçon/quête** (modèle Coursera/edX) — *pas* un forum global unique. Quand
  on bloque sur l'exercice 4, on discute *sous* l'exercice 4. Le contexte reste collé au contenu.
- **Posts riches** : texte, image, code, lien vers une quête rendue.
- **Tri du feed** : récent + « hot » (ranking avec décroissance temporelle — voir
  [implémentation](03-implementation-technique.md#3-feed--ranking)).

---

## Couche 3 — Q&A / Entraide (la base de connaissances durable)

C'est ce qui transforme l'entraide ponctuelle en **patrimoine réutilisable** (modèle Stack Overflow). Dans
chaque Guilde de matière :

- **Poser une question** (votable), rattachée à des **tags** (matière/chapitre/compétence de l'Atlas).
- **Réponses votées** ; tri par qualité (score de confiance de Wilson, pas moyenne brute).
- **Réponse validée** : marquée par l'auteur de la question, **ou par un mentor, ou par l'IA-tuteur**.
- **Réputation qui débloque des privilèges** : voter, puis valider des réponses, puis modérer (montée
  graduelle de confiance).
- **Le downvote coûte un peu** à l'auteur → filtre le mauvais contenu.

> Effet : les questions des promos d'aujourd'hui deviennent les **ressources des promos de demain**. La
> communauté produit un corpus qui s'enrichit d'année en année.

---

## Couche 4 — Étude ensemble (le différenciateur vivant)

**Le levier le plus puissant** pour transformer des élèves isolés-face-à-l'IA en communauté. Repris des
serveurs Discord d'étude (StudyLion) et de Focusmate.

- **Salles d'étude vidéo** : « Caméra on » (body-doubling visible) et « Silence » (concentration). On
  travaille *en présence* des autres, chacun sur sa tâche.
- **Body-doubling 1-à-1** avec **appariement automatique** (modèle Focusmate) : flux **annoncer son
  objectif → travailler caméra-on en silence → check-in final** sur ce qui a été accompli.
- **Study halls de groupe animés** (modèle Flow Club) : sessions hebdomadaires avec un hôte qui rythme.
- **Pomodoro partagé** (25/5 configurable) : minuteur collectif, signaux communs, rythme de groupe.
- **Compteur de temps d'étude** par matière, **streak d'étude**, stats jour/semaine/mois/total.
- **Leaderboard de temps d'étude** (voir garde-fou en [mécaniques](02-mecaniques-engagement.md)).
- **To-do partagées** : annoncer ses tâches, les cocher, être vu progresser.

---

## Couche 5 — Gamification (deux monnaies séparées)

C'est le point de conception le plus important — détaillé dans
[02-mecaniques-engagement.md](02-mecaniques-engagement.md). En résumé :

- **XP d'apprentissage** = signaux **réels** validés par l'IA-tuteur (compétences maîtrisées, quiz réussis)
  — **jamais le temps ni le volume brut** (sinon « XP farming », le défaut critiqué de Duolingo).
- **Points communauté** = utilité jugée par les pairs (modèle Skool : **1 like = 1 point**), **9 niveaux à
  seuils exponentiels**, **niveaux qui débloquent du contenu**.
- **Ligues hebdomadaires** en cohortes de ~30, promotion dégressive, reset dominical (modèle Duolingo),
  basées sur l'**XP d'apprentissage**.
- **Rangs/rôles visibles** (couleur, badge) par niveau et par temps d'étude.

---

## Couche 6 — Social & accountability

- **Binômes de redevabilité** réservables (apparier par dispo/objectif).
- **Streaks individuels ET d'amis** (streak partagé qui crée une obligation douce envers l'autre).
- **Quêtes coopératives à deadline** (« Friend Quests » : objectif commun à atteindre ensemble avant
  dimanche).
- **Mentorat « qui maîtrise enseigne »** : l'élève qui valide une compétence peut devenir mentor/reviewer
  pour les suivants (effet protégé — il consolide en enseignant, la communauté grandit en capacité).
- **Profils d'élève** : parcours, badges, compétences maîtrisées, contributions.

---

## Couche 7 — Le rythme live (le battement hebdomadaire)

Une communauté vit par ses **rendez-vous**. Calendrier ritualisé (modèle cohortes / cours par cohortes) :

| Jour | Rituel |
|------|--------|
| **Lundi** | **Challenge de la semaine** lancé (un défi commun) |
| **Mercredi** | **AMA / live** (questions récoltées à l'avance) + **rediffusion enregistrée** pour les absents |
| **Vendredi** | **Study hall** de groupe (session d'étude animée, breakout rooms) |
| **Dimanche** | **Recap + shoutouts + leaderboard** de la semaine, puis reset des ligues |

- **Sessions live** avec enregistrement automatique (sert le live *et* les absents — modèle Circle/Mighty).
- **Breakout rooms** pour le travail en petits groupes pendant les lives.
- **Challenges** thématiques (un projet commun, une compétence à viser ensemble).

---

## Tableau récapitulatif — toutes les fonctionnalités

| Couche | Fonctionnalités | Inspiration |
|--------|-----------------|-------------|
| **1. Espaces** | Espace-Classe (cohorte 20-30) ; Guildes par matière ; annuaire + matching | Mighty, Circle |
| **2. Feed** | Feed de classe ; discussion par leçon ; shoutouts ; sondages ; tri hot | Skool, Coursera |
| **3. Q&A** | Questions/réponses votées ; tags ; réponse validée ; réputation→privilèges | Stack Overflow |
| **4. Étude ensemble** | Salles vidéo ; body-doubling 1-à-1 ; study halls ; pomodoro partagé ; temps d'étude + streak ; to-do partagées | Discord/StudyLion, Focusmate, Flow Club |
| **5. Gamification** | XP d'apprentissage (réel) ; points communauté (likes) ; 9 niveaux ; déblocage de contenu ; ligues hebdo ; rangs visibles | Duolingo, Skool, MEE6 |
| **6. Social** | Binômes d'accountability ; streaks (perso + amis) ; quêtes coop ; mentorat ; profils | Duolingo, Focusmate |
| **7. Rythme live** | Challenges hebdo ; AMA/live enregistré ; study hall ; breakout rooms ; recap + shoutouts | Cohortes / CBC |

**Suite** : [les mécaniques d'engagement](02-mecaniques-engagement.md) (comment tout ça motive sans
manipuler), puis [l'implémentation technique](03-implementation-technique.md).
