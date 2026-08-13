# 29 — Cours secondaire « Ma passion »

> Un cours **optionnel**, choisi à **100 %** : une passion/loisir qu'on peut pousser jusqu'au niveau pro
> (Plan A / Plan B). Mode découverte (5 disciplines × 1 semaine + journal), engagement **doux** + délai de
> réflexion, temps **plafonné**. Fondé sur 2 recherches sourcées (juillet 2026).

---

## 0. L'idée

À côté des cours principaux (le socle, le « plan B » solide), l'élève choisit **une passion** — photo,
cuisine, sport, esport (Valorant, LoL…), dev, création de contenu, streaming… — et la **pousse**, jusqu'à,
peut-être, en vivre. Le **choix libre est le levier n°1 de persistance** (méta-analyse Patall 2008 ; SDT) et
ce qui fait passer un intérêt situationnel à un intérêt durable (Hidi & Renninger). Mais **ça reste
secondaire** : c'est un cours **tampon**, pas prioritaire.

## 1. Choisir : directement, ou par le mode découverte

Deux entrées (`/passion`) :

- **« Je sais déjà »** : champ 100 % libre → on choisit sa passion.
- **Mode découverte** : tester **5 disciplines, 1 semaine chacune** (5 est la zone optimale — au-delà, la
  surcharge de choix paralyse, Iyengar & Lepper). Chaque semaine est **active** (un vrai « faire »), avec un
  **journal de bord quotidien** saisi dans le vif (ce que j'ai fait / aimé / pas aimé + intensité « perdu la
  notion du temps ») — plus fiable qu'un questionnaire rétrospectif (Kahneman DRM). À la fin, l'IA lit les
  journaux et propose **2-3 pistes formulées comme HYPOTHÈSES, jamais un verdict** (« il se peut que… — à
  toi de confirmer »), pour co-construire l'insight sans imposer d'étiquette (Harrington & Loffredo). Un 2ᵉ
  tour de découverte est possible, avec propositions IA (champ toujours libre).

## 2. S'engager sans se piéger : verrou DOUX + réflexion + rampe de sortie

La demande initiale était un **verrou dur de 6 mois**. La recherche l'a **déconseillé** pour des ados : un
blocage technique fabrique **coûts irrécupérables, enfermement et réactance** — précisément la population la
plus vulnérable au sunk-cost (Bryan et al. ; Ruiz & Yabut). Décision retenue (validée avec l'utilisateur) :

- **engagement DOUX** : on **affiche** « tu t'es engagé·e jusqu'au [date] » (~6 mois) — moral, motivant,
  **jamais bloquant** ;
- **changer** passe par une **proposition** puis une **re-confirmation après 1 mois** de réflexion (c'est
  *le délai* qui évite l'impulsivité, pas l'*impossibilité* de changer) ;
- **rampe de sortie** sans pénalité : « ça ne me convient vraiment pas » libère immédiatement (jamais
  verrouiller quelqu'un qui va mal).

## 3. Pousser la passion : le plan (Plan A / Plan B)

L'IA génère un **plan** (backward design) : 5-8 jalons (compétence démontrable + critères mesurables +
projet à produit public + badge). Cadrage clé pour **protéger la motivation intrinsèque** (effet de
surjustification — Deci-Koestner-Ryan) :

- **récompenses informatives** (progrès/maîtrise/badges), pas « gains/abonnés/classement » mis en avant ;
- **Plan A / Plan B** : 2-4 **débouchés adjacents** (esport → joueur, coaching, event, community management,
  dev de jeux) — ne pas tout miser sur une voie ;
- **taux de base honnête** (« vivre à plein temps du streaming est rare : ~… ; mais les compétences servent
  partout ») — ni décourageant, ni mensonger (Tokumitsu) ;
- **mode « plaisir » vs « professionnaliser »** séparé dans l'UX (on ne bascule pas trop tôt en logique de
  rendement) ; passion **harmonieuse**, équilibre de vie encouragé (Vallerand).

## 4. Le temps : plafonné (~20 %)

Le cours secondaire est le **bloc-tampon** : plafonné à **~20 %** du temps d'apprentissage (~30–60 min/jour
selon l'âge), réduit **en premier** les jours chargés (hypothèse de sur-engagement — Fredricks : au-delà de
~14-20 h/sem d'activités, l'ajustement scolaire décline). Affiché sur « Aujourd'hui » (`DailyBudgetCard`).

## 5. Modèle de données

`electives` (passion active, mode, `commit_until` affiché, flux de changement) · `elective_discovery`
(5 × 1 semaine) · `elective_journal` (entrées quotidiennes) · `elective_plans` (Plan A/B + jalons) ·
badges dans `learner_badges` (`discipline = 'Passion · …'`).

## 6. Ce qui reste

- Biaiser (optionnellement) séances/tests vers la passion, comme la spécialisation.
- Signaux d'appétence plus riches (temps réellement passé, engagement) au-delà du journal déclaré.
- Micro-crédentiels/portfolio public par passion.

**Sources** : Hidi & Renninger (2006), Patall, Cooper & Robinson (2008), Deci & Ryan (SDT), Iyengar & Lepper
(2000), Marcia, Schnoes et al. (2018), Bryan, Karlan & Nelson (2010), Ruiz & Yabut (2024), Lepper/Greene/
Nisbett (1973), Deci, Koestner & Ryan (1999), Vallerand, Newport, Tokumitsu (2014), Kahneman et al. (2004),
Harrington & Loffredo (2011), Fredricks (2012).
