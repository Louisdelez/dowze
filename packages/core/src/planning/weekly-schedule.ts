/**
 * Générateur d'emploi du temps hebdomadaire — DÉTERMINISTE (le moteur de Dowze « répartit les cours »,
 * comme une école, sans appel LLM : fiable, instantané, gratuit). Recherche 2026 (sourcée) :
 * - Langue quotidienne COURTE et protégée le matin ; révisions (FSRS) courtes quotidiennes.
 * - Bloc = clamp(3,5·âge, 15-50) min ; pauses entre blocs (gaps) ; expéditions espacées ; passion en fin
 *   de journée, plafonnée ; remplissage ≤ 80 % (respiration).
 * - Compression quand le temps manque : passion → expéditions → volume des cours → JAMAIS langue+révisions.
 * - Les jours de repos viennent des jours NON actifs du profil (≥ 1/sem).
 *
 * ORCHESTRATEUR MULTI-SOURCE (P2) : au-delà de l'étude, le moteur intègre les **activités récurrentes**
 * déclarées par les plugins (ex. « sport 3×/sem »). Résolution en couches : (a) l'étude reste le socle
 * (blocs protégés jamais évincés) ; (b) contraintes dures (jours de repos, espacement/récupération, cap
 * hebdo) ; (c) préférences souples (heure, séance modérée AVANT l'étude = boost cognitif, intense en fin
 * de journée jamais avant un bloc exigeant). Non-punitif : une séance qui ne rentre pas un jour est
 * simplement reportée (fréquence best-effort), jamais une pénalité. Cf. docs/12-PLUGINS/02.
 */

export type BlockType = 'langue' | 'revision' | 'cours' | 'expedition' | 'passion' | 'plugin';

export interface ScheduleBlock {
  /** 0 = dimanche … 6 = samedi. */
  dayOfWeek: number;
  startMin: number;
  durationMin: number;
  type: BlockType;
  label: string;
  // ─ Métadonnées portées par les blocs `plugin` (activité récurrente d'une app satellite) ─
  sourceApp?: string;
  entryType?: string;
  color?: string;
  icon?: string;
  appLabel?: string;
  href?: string;
}

/** Projection d'une activité récurrente d'un plugin, prête pour le placement. */
export interface RecurringInput {
  key: string; // 'fitness:workout-1' (identité)
  entryType: string; // 'fitness.workout'
  label: string;
  durationMin: number;
  frequencyPerWeek: number;
  intensity: 'legere' | 'moderee' | 'intense';
  preferredTime?: 'matin' | 'apres-midi' | 'soir';
  cognitiveBoostBeforeStudy?: boolean;
  minRestDaysPerWeek?: number;
  weeklyCapMin?: number;
  // affichage
  sourceApp?: string;
  color?: string;
  icon?: string;
  appLabel?: string;
  href?: string;
}

export interface ScheduleInput {
  age: number | null;
  /** Jours actifs (0-6). Les autres = jours de repos. */
  activeDays: number[];
  dayStartMin: number;
  dayEndMin: number;
  intensity: 'leger' | 'moyen' | 'soutenu';
  /** Un cours secondaire (passion) est-il choisi ? */
  hasSecondary: boolean;
  /** Activités récurrentes des plugins à orchestrer avec l'étude (P2). */
  recurring?: RecurringInput[];
}

function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}

/**
 * Un bloc candidat. `priority` gouverne la SÉLECTION (compression : plus petit = gardé en premier,
 * l'étude protégée d'abord). `position` gouverne le PLACEMENT chronologique dans la journée.
 */
interface Placeable {
  type: BlockType;
  dur: number;
  label: string;
  priority: number;
  position: number;
  routineAnchor?: boolean; // langue : colle la révision juste après
  sourceApp?: string;
  entryType?: string;
  color?: string;
  icon?: string;
  appLabel?: string;
  href?: string;
}

/**
 * Les blocs d'ÉTUDE souhaités d'une journée. On vise PEU de blocs mais GRANDS et LISIBLES : routine du
 * matin (langue+révisions), un cours substantiel, puis 1 période l'après-midi, la passion en fin de journée.
 * Les priorités/positions préservent le comportement historique (étude seule) tout en laissant s'insérer
 * les activités récurrentes des plugins.
 */
function studyPlaceables(
  dayIndex: number,
  langMin: number,
  revMin: number,
  coursMin: number,
  expMin: number,
  passionMin: number,
  intensity: ScheduleInput['intensity'],
  hasSecondary: boolean,
): Placeable[] {
  const blocks: Placeable[] = [
    {
      type: 'langue',
      dur: langMin,
      label: 'Langue',
      priority: 1,
      position: 10,
      routineAnchor: true,
    },
    { type: 'revision', dur: revMin, label: 'Révisions', priority: 2, position: 20 },
    { type: 'cours', dur: coursMin, label: 'Cours principaux', priority: 4, position: 40 },
  ];
  // Une 2e période l'après-midi (moyen/soutenu) : expédition les jours impairs, un cours les jours pairs.
  if (intensity !== 'leger') {
    blocks.push(
      dayIndex % 2 === 1
        ? { type: 'expedition', dur: expMin, label: 'Expédition', priority: 5, position: 55 }
        : {
            type: 'cours',
            dur: Math.max(60, coursMin - 15),
            label: 'Cours principaux',
            priority: 5,
            position: 45,
          },
    );
  }
  // Passion en fin de journée, ~2 jours/semaine (jours pairs), jamais prioritaire.
  if (hasSecondary && intensity !== 'leger' && dayIndex % 2 === 0) {
    blocks.push({
      type: 'passion',
      dur: passionMin,
      label: 'Ma passion',
      priority: 8,
      position: 70,
    });
  }
  return blocks;
}

/** Convertit une activité récurrente assignée à un jour en bloc candidat (priorité/position selon la science). */
function recurringPlaceable(act: RecurringInput): Placeable {
  let priority: number;
  let position: number;
  if (act.intensity === 'intense') {
    // Séance intense : fin de journée, APRÈS l'étude — jamais avant un bloc exigeant.
    priority = 7;
    position = 90;
  } else if (act.cognitiveBoostBeforeStudy) {
    // Séance modérée/légère AVANT l'étude : boost des fonctions exécutives (~2 h).
    priority = 3;
    position = 5;
  } else {
    priority = 6;
    position = act.preferredTime === 'matin' ? 25 : act.preferredTime === 'soir' ? 85 : 60;
  }
  return {
    type: 'plugin',
    dur: act.durationMin,
    label: act.label,
    priority,
    position,
    sourceApp: act.sourceApp,
    entryType: act.entryType,
    color: act.color,
    icon: act.icon,
    appLabel: act.appLabel,
    href: act.href,
  };
}

/**
 * Assigne chaque activité récurrente à des jours ESPACÉS parmi les jours actifs (récupération, cap hebdo,
 * jours de repos). Renvoie une map jour → activités.
 */
function assignRecurringDays(
  recurring: RecurringInput[],
  activeDays: number[],
): Map<number, RecurringInput[]> {
  const map = new Map<number, RecurringInput[]>();
  const len = activeDays.length;
  if (len === 0) return map;

  for (const act of recurring) {
    let freq = act.frequencyPerWeek;
    if (act.weeklyCapMin && act.durationMin > 0) {
      freq = Math.min(freq, Math.floor(act.weeklyCapMin / act.durationMin)); // cap OMS
    }
    // Garantir au moins `minRestDaysPerWeek` jours sans cette activité.
    const maxDaysForRest =
      act.minRestDaysPerWeek != null ? Math.max(0, 7 - act.minRestDaysPerWeek) : 7;
    freq = Math.min(freq, len, maxDaysForRest);
    if (freq <= 0) continue;

    // Jours régulièrement espacés (répartition sur toute la semaine active).
    const chosen = new Set<number>();
    for (let i = 0; i < freq; i++) {
      const idx = freq === 1 ? Math.floor(len / 2) : Math.round((i * (len - 1)) / (freq - 1));
      chosen.add(activeDays[Math.min(len - 1, idx)] as number);
    }
    // Les collisions d'arrondi peuvent réduire le nombre : compléter avec les jours restants.
    for (const d of activeDays) {
      if (chosen.size >= freq) break;
      chosen.add(d);
    }
    for (const dow of chosen) {
      const arr = map.get(dow) ?? [];
      arr.push(act);
      map.set(dow, arr);
    }
  }
  return map;
}

export function weeklySchedule(input: ScheduleInput): ScheduleBlock[] {
  const age = input.age ?? 13;
  // Durées LISIBLES (un bloc trop court est illisible dans un calendrier).
  const langMin = 25;
  const revMin = 25;
  const coursMin = age <= 11 ? 60 : age <= 15 ? 75 : 90;
  const expMin = 60;
  const passionMin = age <= 11 ? 40 : 45;
  const dayStart = clamp(input.dayStartMin, 0, 1439);
  const dayEnd = clamp(input.dayEndMin, dayStart + 30, 1440);
  const windowMin = dayEnd - dayStart;

  const activeDays = [...new Set(input.activeDays)]
    .filter((d) => d >= 0 && d <= 6)
    .sort((a, b) => a - b);
  const assigned = assignRecurringDays(input.recurring ?? [], activeDays);

  const out: ScheduleBlock[] = [];
  activeDays.forEach((dow, dayIndex) => {
    const study = studyPlaceables(
      dayIndex,
      langMin,
      revMin,
      coursMin,
      expMin,
      passionMin,
      input.intensity,
      input.hasSecondary,
    );
    const recurring = (assigned.get(dow) ?? []).map(recurringPlaceable);
    const candidates = [...study, ...recurring];

    // 1) SÉLECTION par priorité (compression) : on garde ce qui tient, l'étude protégée d'abord.
    const byPriority = [...candidates].sort((a, b) => a.priority - b.priority);
    const selected: Placeable[] = [];
    let content = 0;
    for (const b of byPriority) {
      if (content + b.dur + selected.length * 6 <= windowMin) {
        selected.push(b);
        content += b.dur;
      }
    }
    const n = selected.length;
    if (n === 0) return;

    // 2) PLACEMENT par position chronologique : routine du matin collée, reste réparti avec des pauses.
    const ordered = selected.sort((a, b) => a.position - b.position);
    const slack = Math.max(0, windowMin - content);
    const unit = Math.floor(slack / (n + 1)); // n+1 espaces ⇒ ne dépasse jamais la fenêtre
    const bigGap = Math.min(unit, 55);
    let cursor = dayStart + Math.min(unit, 20);
    ordered.forEach((b, i) => {
      out.push({
        dayOfWeek: dow,
        startMin: Math.round(cursor),
        durationMin: b.dur,
        type: b.type,
        label: b.label,
        ...(b.type === 'plugin'
          ? {
              sourceApp: b.sourceApp,
              entryType: b.entryType,
              color: b.color,
              icon: b.icon,
              appLabel: b.appLabel,
              href: b.href,
            }
          : {}),
      });
      const routine = b.routineAnchor === true && ordered[i + 1]?.type === 'revision';
      cursor += b.dur + (routine ? Math.min(unit, 10) : bigGap);
    });
  });
  return out;
}

/** Presets de disponibilité (autonomie encadrée). `activeDays` 0=dim..6=sam. */
export interface SchedulePreset {
  key: string;
  name: string;
  description: string;
  activeDays: number[];
  dayStartMin: number;
  dayEndMin: number;
  intensity: 'leger' | 'moyen' | 'soutenu';
}

export const SCHEDULE_PRESETS: SchedulePreset[] = [
  {
    key: 'plein-temps',
    name: 'Plein temps',
    description: 'Lun–Ven, matin et après-midi',
    activeDays: [1, 2, 3, 4, 5],
    dayStartMin: 8 * 60,
    dayEndMin: 17 * 60,
    intensity: 'soutenu',
  },
  {
    key: 'matinee',
    name: 'Matinée',
    description: 'Lun–Ven, le matin',
    activeDays: [1, 2, 3, 4, 5],
    dayStartMin: 8 * 60,
    dayEndMin: 12 * 60,
    intensity: 'moyen',
  },
  {
    key: 'apres-midi',
    name: 'Après-midi',
    description: 'Lun–Ven, l’après-midi',
    activeDays: [1, 2, 3, 4, 5],
    dayStartMin: 13 * 60,
    dayEndMin: 18 * 60,
    intensity: 'moyen',
  },
  {
    key: 'soir',
    name: 'Cours du soir',
    description: 'Lun–Ven, après le travail',
    activeDays: [1, 2, 3, 4, 5],
    dayStartMin: 19 * 60,
    dayEndMin: 21 * 60 + 30,
    intensity: 'leger',
  },
  {
    key: 'weekend',
    name: 'Week-end',
    description: 'Samedi et dimanche',
    activeDays: [6, 0],
    dayStartMin: 9 * 60,
    dayEndMin: 17 * 60,
    intensity: 'moyen',
  },
  {
    key: 'leger',
    name: 'Léger',
    description: 'À ton rythme, un peu chaque jour',
    activeDays: [1, 2, 3, 4, 5, 6],
    dayStartMin: 9 * 60,
    dayEndMin: 12 * 60,
    intensity: 'leger',
  },
];
