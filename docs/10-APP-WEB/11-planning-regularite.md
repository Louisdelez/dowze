# Planning, régularité, présence & minuteur

> *Comment l'intra aide l'élève à **tenir un rythme** — un planning personnel généré, un suivi
> présence/absence bienveillant, et un minuteur synchronisé avec sonneries de début/fin de « cours ». Tout
> est conçu pour **structurer et rendre conscient du temps, jamais pour stresser ni culpabiliser**
> ([principe 9](../00-FONDATIONS/03-principes-fondateurs.md)).*

Ce n'est **pas** un emploi du temps figé à la Pronote (grille imposée, par horaire, identique pour tous).
C'est un **coach de régularité personnel** : il dit *quoi faire, à quel rythme tenir*, et s'adapte à ta vie.

---

## 1. Le planning : généré, personnel, adaptatif

### Qui calcule quoi
| Le « QUAND » → **l'intra calcule** (déterministe, fiable, gratuit) | Le « QUOI » → **l'IA génère** (prompt + `.json`) |
|---|---|
| révisions dues (répétition espacée SM-2 = arithmétique) | le contenu des sessions (Expéditions) |
| tes créneaux déclarés | l'agencement intelligent de la semaine |
| ta prochaine compétence (graphe, loi de clôture) | l'adaptation à tes contraintes |

> On ne laisse **pas** l'IA inventer tes dates de révision (risque d'hallucination) : le *quand* est un
> calcul **garanti** par l'intra. L'IA fait le *quoi*. Détail du `.json` de génération :
> [pont `.json`](10-pont-json.md) et l'exemple dans le chat de conception.

### La règle d'or de la régularité : le plan « SI–ALORS »
Au lieu de « 30 min/jour » (vague), chaque session est un **déclencheur situé** : *« SI mardi, après le
dîner, ALORS j'ouvre tel module »*. L'intention de mise en œuvre est le levier le mieux prouvé de
l'assiduité (Gollwitzer & Sheeran : **d ≈ 0,65**). L'intra stocke donc le **déclencheur** (jour + repère
contextuel + heure approx.), pas juste une durée — c'est lui qui servira à détecter une session manquée.

### Cale sur des cycles ~90 min, adapté à ta vie
- **Élève à plein temps** : blocs quotidiens.
- **Adulte qui travaille** : soirs + micro-révisions de 5 min + sprints intensifs ponctuels.
- **Vie chargée** : pause sans « abandon » ; le carnet de bord garde tout, on reprend où on en était.

---

## 2. La présence/absence : un miroir bienveillant, pas un registre disciplinaire

Objectif : **voir facilement ce qu'on a manqué pour mieux gérer son temps** — pas se faire punir. C'est un
outil d'**auto-régulation** (cycle de Zimmerman : planifier → s'observer → ajuster), pas un contrôle.

### Détection automatique (objective, pas déclarative)
L'auto-déclaration « j'étais là » est biaisée (on se surestime). Donc une session compte comme **faite**
par un **seuil d'activité réel** (≥ 1 exercice/leçon validé, ou ≥ X min actives) — capté automatiquement.

> **Règle :** à la fin de la journée locale du créneau planifié, si le seuil n'est pas atteint → la session
> passe au statut neutre **« non réalisée »** (pas « ABSENT » accusateur). Horodatage en **heure locale** de
> l'élève (zéro faux manqué).

### « Never miss twice » (la règle anti-décrochage)
Manquer **une** fois n'a **aucune** conséquence (la science de l'habitude le confirme : Lally 2010 — un raté
isolé n'altère pas la formation d'une habitude). Le système ne réagit qu'au **2ᵉ raté consécutif** sur le
même créneau. Le message est alors **auto-compassionnel et tourné vers la reprise** :

> *« Lundi n'a pas eu lieu — c'est normal. L'important : ne pas sauter deux fois. On reprogramme 15 min ? »*

Jamais : « tu as raté », jamais de score qui s'effondre. (L'auto-critique *réduit* la motivation ;
l'auto-compassion favorise le rebond.)

### L'absence devient une donnée utile
Une vue **rétrospective** repère les patterns et **propose un ajustement**, sans jugement :

> *« Sur 4 semaines : 3 lundis manqués, 0 samedi. Veux-tu déplacer ta session du lundi au samedi ? »*

→ L'absence ne pénalise pas : elle **améliore ton planning**.

### Rattrapage sans empiler
Une session manquée se **reprogramme** (prochain créneau libre, ou mini-session allégée de 15 min). Mais on
**plafonne** (au plus 1 session reportée active) et on **lisse la charge** — au-delà, on propose de
**« tourner la page »** plutôt que d'accumuler une dette décourageante. Les **révisions** manquées, elles,
se replanifient automatiquement au prochain moment optimal (logique FSRS), sans dette ni pénalité.

### Tableau de bord d'assiduité (sain)
- **Comparaison à soi uniquement** (mon mois vs mon mois passé), **jamais aux autres** (la comparaison
  sociale décourage).
- État **factuel et doux** (pas de rouge alarmant) ; met en avant **la régularité et la reprise** (« 3
  semaines régulières d'affilée », « repris dès le lendemain »).
- **Chaque écran propose une action** (reprogrammer, ajuster), pas un simple constat.

---

## 3. Le minuteur synchronisé + la sonnerie début/fin de « cours »

Tu voulais le **cadre d'une vraie école** : un minuteur qui montre le temps avant le prochain cours, des
pauses, et une **sonnerie** au début et à la fin. On le fait — mais en version **saine** (structure et
conscience du temps, sans stress).

### Le minuteur
- **Compte à rebours avant le prochain cours** : « prochaine session dans 2 h 15 ».
- **Pendant la session** : un **disque/arc coloré qui se vide** (pas des chiffres rouges qui clignotent),
  **discret et masquable** (certains se déconcentrent à trop regarder le chrono → bouton « cacher »).
- Effet prouvé : un minuteur visible **réduit l'anxiété** (il supprime l'incertitude « combien de temps
  reste-t-il ? ») et améliore la concentration (Hallez & Vallier 2025, **d ≈ 0,42**) — *à condition* de ne
  pas le rendre menaçant. **Aucun langage d'urgence/FOMO** (« plus que 2 min !!! » est interdit).

### Les sessions et les pauses
- **Durée configurable** : défaut **25 min** (focus court, idéal débutants/jeunes/TDAH), options 20-45, et
  **50-90 min** (deep work). Plafond par défaut raisonnable.
- **Pause imposée par le minuteur** après chaque session (5-10 min) — mais bouton **« +2 min pour finir ma
  pensée »** (respect de l'« attention residue », ne pas couper une tâche en cours brutalement).
- **Mode pause calme** : écran sobre, suggestion de fermer les yeux / marcher / respirer — **pas d'écran ni
  de notification poussée**. C'est important : le **repos éveillé sans stimulation consolide la mémoire**
  (méta-analyse 2025, **g ≈ 0,45**, effet qui tient à 7 jours). La pause **fait partie de l'apprentissage**.
- Longue pause (15-20 min) après ~4 cycles.

### La sonnerie (douce, pas une sonnerie d'école stridente)
- Un **son à résonance décroissante** (cloche/bol, gong doux) qui **s'éteint sur 3-6 s** — pas un buzzer.
  On *suit le son qui décroît* : ça recentre l'attention au lieu de faire sursauter (modèle de la « cloche
  de pleine conscience »).
- **Au début** : la cloche + un micro-rituel d'« arrivée » (3 respirations, 10 s) avant que le chrono ne
  démarre → on transforme le signal en ancrage d'attention.
- **À la fin** : la même cloche annonce la pause.
- **Checkpoint optionnel** à mi-session ou « 5 min restantes » (cloche très douce) — précieux pour les
  profils qui perdent la notion du temps (TDAH / cécité temporelle).
- **Sans paroles, volume réglable, opt-out total** (mode visuel/vibration seul possible).

### Sessions synchronisées (optionnel) — « toute l'école entre en cours »
Des sessions où plusieurs élèves démarrent **en même temps**, avec une **cloche de début/fin commune** :
ça recrée le rituel collectif d'une école **sans coprésence forcée** (modèle body-doubling / Focusmate :
on annonce son objectif au début, on travaille, on fait un point à la fin). **Opt-in**, et **sans
classement ni série punitive**.

---

## 4. La ligne rouge : sain, jamais manipulateur

Tout ce système est conçu **contre** les dark patterns (l'écueil des « séries » anxiogènes type Duolingo) :

| ✅ On fait | ❌ On ne fait jamais |
|-----------|----------------------|
| Statut neutre « non réalisée » | « ABSENT » accusateur, score qui s'effondre |
| Never miss twice, ton de reprise | Culpabilisation, notifications tristes/FOMO |
| Comparaison à soi | Comparaison aux autres, classements |
| Minuteur = disque doux, masquable | Chiffres rouges clignotants, langage d'urgence |
| Sonnerie douce qui décroît, opt-out | Buzzer strident, sons imposés |
| Pause = consolidation (sans écran) | Pousser du contenu pendant la pause |
| Rappels **opt-in**, alignés sur tes créneaux | Rappels à fréquence anxiogène |

> **La métrique n'est jamais le temps passé ni la série.** C'est la **maîtrise réelle et le bien-être**.

---

## 5. Comment tout ça se génère (cohérence avec le reste)

- Le planning est produit par une **règle de génération** (la [grammaire pédagogique](../03-ARCHITECTURE/11-grammaire-pedagogique.md))
  + le calcul déterministe de l'intra. Quand ta vie change, tu mets à jour tes dispos → **il se régénère**.
- La présence/absence et le minuteur sont des **fonctions de l'intra** (calcul + affichage), pilotées par
  ton planning ; aucune donnée figée à maintenir.
- Tout reste **auto-régulation** (Zimmerman) : planifier (SI–ALORS) → s'observer (présence, minuteur) →
  réfléchir/ajuster (rétrospective, reprogrammation).

---

**Sources** : Gollwitzer & Sheeran 2006 (intentions de mise en œuvre, d≈0,65) ; Lally et al. 2010
(habitudes, 66 j, un raté isolé sans effet) ; James Clear (*never miss twice*) ; Neff (auto-compassion) ;
méta-analyse *wakeful rest* 2025 (g≈0,45) ; Hallez & Vallier 2025 (timer visuel, d≈0,42) ; Mackworth 1948
(décrément de vigilance ~20-30 min) ; cloche de pleine conscience (Plum Village) ; Zimmerman (SRL) ;
Focusmate / body doubling ; FSRS (replanification des révisions) ; UX audio (Toptal, UX Magazine). Détail :
[bibliographie](../09-ANNEXES/01-bibliographie.md).
