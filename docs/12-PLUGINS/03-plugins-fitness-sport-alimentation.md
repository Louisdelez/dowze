# 03 — Les 3 premiers plugins

Chaque plugin est une **app satellite** (`apps/*` + sous-domaine), avec **son schéma** de données,
consommant l'API du cœur via des **scopes**, contribuant au **planning** des activités récurrentes, et
respectant la **philosophie Dowze** (non-punitif, régularité, IA-orchestratrice, RGPD).

## 1. `fitness.dowze.ch` — Dowze Fitness

**But** : la forme physique **régulière** — exercices, progression, mais surtout **des séances inscrites au
planning** que l'IA de Dowze orchestre avec l'étude.

- **Schéma `fitness`** (non exposé pour la partie santé) : `programs`, `exercises`, `workout_sessions`
  (date, faites/prévues), `progression` (charges/répétitions), `health_profile` (données Art. 9, chiffré).
- **Scopes** : `profile:read`, `calendar:read`, `calendar:write`, `ai:infer` (optionnel), `health:write`
  (optionnel, **consentement explicite séparé**).
- **Activité récurrente déclarée** : `fitness.workout`, `frequencyPerWeek` (défaut 3), `durationMin ~50`,
  `intensity`, `hardConstraints` = récup ≥ 24-48 h même groupe, ≥ 1 repos/sem, cap ≤ 300 min/sem, `notBefore:
  [examen, revisions-lourdes]` si intense ; `softPreferences` = séance modérée avant un bloc d'étude si
  possible (bonus cognitif), habit-stacking après un bloc récurrent.
- **Progression** : surcharge progressive douce (progressive overload), suivi charges/répétitions ; **jamais
  de comparaison sociale**, indicateur de **régularité glissante** (pas de streak couperet).
- **IA/RAG** : compose un prompt de séance (objectif, matériel, niveau, historique) que l'utilisateur suit
  avec **son** IA/coach ; ingest d'un résumé (« j'ai fait X ») → met à jour la progression + le planning.
  L'IA n'est **pas** le coach à la place de l'humain.
- **Écran** : « Ma forme » (programme du jour, prochaine séance depuis le planning), progression, réglages
  (objectif hebdo, consentement santé).

## 2. `sports.dowze.ch` — Dowze Sports

**But** : la pratique d'un **sport** (foot, basket, natation, course, esport physique…) — entraînements,
matchs, régularité, intégrés au planning. Proche de fitness mais orienté **discipline sportive + performance
+ événements** (matchs/compétitions) plutôt que renforcement générique.

- **Schéma `sports`** : `disciplines`, `training_sessions`, `events` (matchs/compétitions), `skills`
  (techniques de la discipline), `progression`.
- **Scopes** : `profile:read`, `calendar:read`, `calendar:write`, `ai:infer` (optionnel).
- **Activité récurrente** : `sports.training` (fréquence selon la discipline) + `sports.event` (matchs, à
  date fixe = **contrainte dure** dans le planning). Récupération et repos comme fitness.
- **Lien avec Dowze** : peut réutiliser des compétences « Corps & mouvement » de l'Atlas (le graphe de
  compétences a déjà cette branche) → cohérence avec la progression Dowze.
- **IA/RAG** : plan d'entraînement (compose) + ingest de séance ; conseils techniques ancrés (anti-invention).

## 3. `alimentations.dowze.ch` — Dowze Alimentation

**But** : une alimentation **régulière et planifiée** — **jamais** de comptage calorique ni de conseil
médical (garde-fou produit strict). Aide à la **régularité des repas** et au **meal-prep**.

- **Schéma `alimentations`** : `meal_plans`, `recipes`, `meal_rituals` (repas récurrents), `prep_sessions`.
- **Scopes** : `profile:read`, `calendar:read`, `calendar:write`, `ai:infer` (optionnel). **Pas de
  `health:write`** (on ne stocke pas de données de santé médicales ; si un jour des allergies/objectifs
  sensibles → consentement Art. 9 comme fitness).
- **Activité récurrente** : `alimentation.meal` (repas réguliers à heures stables), `alimentation.prep`
  (session meal-prep hebdo). Contraintes douces (heures de repas régulières = ancrage).
- **Cadre** : régularité + planification + intentionnalité (AHA) ; **contrôle flexible** (« au moins X repas
  planifiés cette semaine »), **jamais binaire ni culpabilisant**. **Interdit** : cibles caloriques,
  restriction chiffrée, conseil nutritionnel médicalisé individuel.
- **IA/RAG** : propose des idées de repas/menus de la semaine (compose), ancrées sur les préférences
  déclarées ; ingest de ce qui a été fait.

## Points communs aux 3 (hérités du cœur)

- **Auth** : compte unique Dowze (cookie `.dowze.ch`), aucun re-login.
- **Planning** : toutes les activités récurrentes remontent dans **le même calendrier** que l'étude, arbitrées
  par l'orchestrateur (contraintes dures/souples, récupération, non-punitif).
- **XP / progression** : peuvent créditer de l'XP via `xp:write` (régularité récompensée, jamais l'intensité
  seule — cf. la courbe XP anti-idle de Dowze).
- **UI** : design system commun (`packages/ui`), **icônes Lucide only**, épuré, non-punitif.
- **RGPD** : consentement séparé pour toute donnée sensible, cloisonnement par schéma, révocable.
