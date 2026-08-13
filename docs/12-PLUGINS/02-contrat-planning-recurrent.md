# 02 — Contrat : activités récurrentes & orchestration du planning

> Comment un plugin déclare une **activité récurrente** (ex. « sport 3×/semaine »), et comment
> l'orchestrateur de Dowze l'**intègre** dans le planning aux côtés de l'étude, en respectant la science des
> habitudes, de l'activité physique et de l'adhérence. Sourcé (voir §5).

## 1. Ce que dit la science (résumé actionnable)

- **Habitudes** : l'ancrage d'un comportement prend en moyenne **~66 jours** (18–254 selon la personne ;
  Lally 2010) — pas le mythe des « 21 jours ». Le moteur = **répétition dans un contexte constant** (même
  heure/jour/bloc précédent). Les **implémentation-intentions** « quand X, je fais Y » (Gollwitzer, d ≈ 0,65)
  et le **habit-stacking** (« après mon bloc révisions, séance sport ») décuplent la réussite. → **Un
  calendrier déterministe à heures stables est le meilleur support d'ancrage.**
- **Activité physique (OMS 2020)** : adultes **150–300 min/sem** modéré + **renforcement ≥ 2 j/sem** ;
  enfants/ados **~60 min/jour**. Espacer les séances (**≥ 24–48 h** de récup sur un même groupe),
  **≥ 1 jour de repos/sem**. Un exercice **modéré** améliore les fonctions exécutives **jusqu'à ~2 h** →
  bon **avant** un bloc d'étude ; une séance **intense** fatigue → **jamais** juste avant un bloc exigeant.
- **Orchestration** : distinguer **contraintes dures** (sommeil, cours, récupération, repos — jamais
  violées) et **préférences souples** (heure idéale, enchaînement — optimisées) ; c'est de la satisfaction
  de contraintes (CSP), ce que fait déjà le moteur déterministe de Dowze. Garder une **marge tampon** et
  **replanifier** quand la journée dérape (Newport, time-blocking).
- **Adhérence / non-punitif** : **une séance manquée ne casse pas l'habitude** (Lally). La **culpabilité tue
  la motivation** ; l'**auto-compassion la relance** (Breines & Chen 2012). → Replanifier automatiquement,
  ton bienveillant, indicateur **tolérant** (régularité glissante 7/30 j, jours de grâce), **pas de streak
  zéro-remise-à-zéro**.
- **Alimentation** : le principe fondé et sûr est la **régularité des repas + planification** (AHA/St-Onge
  2017), pas le comptage. Le **contrôle flexible** corrèle à moins de suralimentation et IMC plus bas ; le
  **contrôle rigide / comptage calorique** à l'inverse (Smith 1999). → **Rituels récurrents (meal-prep,
  repas réguliers), jamais de cibles caloriques ni de conseil médical.**

## 2. Déclaration d'une activité récurrente (par le plugin)

Un plugin déclare ses activités via `POST /v1/calendar/recurring` (scope `calendar:write`). Schéma :

```ts
interface RecurringActivity {
  sourceApp: string;                 // 'fitness'
  sourceRef: string;                 // id de la ressource côté plugin (ownership)
  type: string;                      // 'fitness.workout' (déclaré dans contributes)
  title: string;                     // libellé affiché (générique — pas de détail santé)
  frequencyPerWeek: number;          // 3
  durationMin: number;               // 50
  intensity: 'legere' | 'moderee' | 'intense';
  hardConstraints: {
    minRecoveryHoursSameType?: number;  // 24–48
    minRestDaysPerWeek?: number;        // ≥ 1
    weeklyCapMin?: number;              // ≤ 300 (OMS)
    notBefore?: string[];               // ['examen','revisions-lourdes'] si intense
  };
  softPreferences: {
    preferredTime?: 'matin' | 'apres-midi' | 'soir';
    stackAfter?: string;                // habit-stacking : 'revision' | 'cours' …
    cognitiveBoostBeforeStudy?: boolean; // séance modérée placée avant un bloc d'étude
  };
  priority: number;                   // l'étude reste le socle ; sport/repas s'insèrent autour
  missPolicy: { catchUp: boolean; windowDays: number };   // rattrapable, non-punitif
  adherenceMetric: 'rolling-regularity';                   // tolérant, pas de streak zéro-reset
}
```

## 3. Intégration par l'orchestrateur (déterministe + IA)

Le moteur `@dowze/core weeklySchedule` est étendu en un orchestrateur **multi-source** :

1. **Résolution par couches (CSP)** : (a) poser les **contraintes dures** (sommeil, cours, récupération,
   repos) ; (b) placer les engagements par **priorité** — **l'étude d'abord** (socle), puis les activités
   récurrentes des plugins ; (c) **optimiser les préférences souples**.
2. **Ancrage** : **heures stables** semaine après semaine + habit-stacking (`stackAfter`) → chaque créneau
   devient un indice contextuel constant. Formuler chaque activité en implémentation-intention (« après ton
   bloc révisions du mardi, séance sport »). Afficher un **horizon ~66 j / 10 sem** comme repère.
3. **Règles physiologiques/cognitives** : espacer les séances du même type (`minRecoveryHoursSameType`),
   réserver la **récupération** comme un bloc de premier ordre, placer une séance **modérée** avant un bloc
   d'étude si `cognitiveBoostBeforeStudy`, **interdire** l'intense avant un bloc listé dans `notBefore`,
   respecter `weeklyCapMin` et `minRestDaysPerWeek`.
4. **Marge & replanification** : garder un **tampon** ; en cas de séance **manquée**, **replanifier
   automatiquement** dans la `windowDays` du `missPolicy`, **sans pénalité ni ton culpabilisant**.
5. **Rôle de l'IA/RAG** : le placement reste **déterministe** (fiable, gratuit) ; l'**IA de Dowze** intervient
   pour (a) **expliquer/adapter** en langage naturel (« j'ai mis ta séance avant ton étude, ça te réveille le
   cerveau »), (b) **arbitrer les cas ambigus** (proposer un compromis quand tout ne rentre pas), (c)
   **ingérer** ce que l'utilisateur a réellement fait (le plugin envoie un résumé → l'IA structure → le
   planning s'ajuste), fidèle au modèle *compose/ingest* de Dowze — **jamais l'IA ne coache à la place de
   l'humain**.

## 4. Ce que le cœur expose vs ce que le plugin garde

| Le CŒUR (planning) détient | Le PLUGIN détient (son schéma) |
|---|---|
| une **entrée-référence** (`source_app`, `source_ref`, type, titre générique, start, durée, scope) | la **séance complète** (exercices, séries, charges, données santé) |
| les **invariants** (conflits, récupération, repos, cap OMS) | la **logique métier** (progression, programme) |
| l'**événement** `calendar.entry.created` | la réaction à l'événement (marquer fait, replanifier) |

## 5. Sources

Lally et al. 2010 ; Gardner, Lally & Wardle 2012 ; Gollwitzer & Sheeran 2006 (implementation intentions) ;
OMS 2020 (activité physique) ; effets aigus de l'exercice sur la cognition ; Cal Newport (time-blocking) ;
Breines & Chen 2012 (auto-compassion) ; AHA/St-Onge 2017 (régularité des repas) ; Smith et al. 1999
(contrôle flexible vs rigide). URLs complètes dans le rapport de recherche « habitudes récurrentes &
planning orchestré ».
