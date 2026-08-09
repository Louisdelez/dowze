/**
 * Assignation en classes (PURE, testable) — modèle doc 26 §3.2.
 * Priorité lexicographique : NIVEAU (dur, jamais mélangé) > LANGUE (quasi-dur) > ÂGE (souple).
 * Cascade : mono-âge → même-langue tous âges → multilingue (+traduction) → multi-niveau adjacent.
 * L'âge n'exclut JAMAIS. Tailles : cible 20, min 12, max 25.
 */
export interface Candidate {
  profileId: string;
  level: number; // rang (learner_rank.rank)
  lang: string; // langue maternelle (locale)
  age: number | null; // années, ou null si inconnu
}

export interface AssignedClass {
  level: number;
  lang: string; // langue principale (celle de la majorité)
  isMultilingual: boolean;
  memberIds: string[];
  reason: 'mono-age' | 'same-lang' | 'multilingual' | 'multi-level';
}

export const TARGET_SIZE = 20;
export const MIN_SIZE = 12;
export const MAX_SIZE = 25;
export const MIN_TRANCHE_AGE = 12;
// Bornes de tranches d'âge (l'âge n'exclut jamais ; sert juste à regrouper quand il y a assez de monde).
const AGE_TRANCHES: Array<[number, number]> = [
  [0, 12],
  [13, 15],
  [16, 17],
  [18, 24],
  [25, 200],
];

function trancheOf(age: number | null): number {
  if (age == null) return -1;
  return AGE_TRANCHES.findIndex(([lo, hi]) => age >= lo && age <= hi);
}

/** Répartit n en k tailles équilibrées (diffèrent d'au plus 1). */
export function balancedSizes(n: number, k: number): number[] {
  const base = Math.floor(n / k);
  const extra = n % k;
  return Array.from({ length: k }, (_, i) => base + (i < extra ? 1 : 0));
}

/** Nombre de classes pour n apprenants, en respectant min/max autant que possible. */
function classCount(n: number): number {
  let k = Math.max(1, Math.round(n / TARGET_SIZE));
  while (n / k > MAX_SIZE) k++;
  while (k > 1 && n / k < MIN_SIZE) k--;
  return k;
}

/** Découpe une liste (déjà triée) en classes équilibrées. */
function splitInto(
  members: Candidate[],
  reason: AssignedClass['reason'],
  isMultilingual: boolean,
): AssignedClass[] {
  if (members.length === 0) return [];
  const k = classCount(members.length);
  const sizes = balancedSizes(members.length, k);
  const out: AssignedClass[] = [];
  let i = 0;
  for (const size of sizes) {
    const slice = members.slice(i, i + size);
    i += size;
    out.push({
      level: slice[0]?.level ?? 1,
      lang: dominantLang(slice),
      isMultilingual,
      memberIds: slice.map((c) => c.profileId),
      reason,
    });
  }
  return out;
}

function dominantLang(members: Candidate[]): string {
  const counts = new Map<string, number>();
  for (const m of members) counts.set(m.lang, (counts.get(m.lang) ?? 0) + 1);
  let best = members[0]?.lang ?? 'fr';
  let bestN = 0;
  for (const [lang, n] of counts)
    if (n > bestN) {
      best = lang;
      bestN = n;
    }
  return best;
}

function groupBy<T>(items: T[], key: (t: T) => string): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const it of items) {
    const k = key(it);
    const arr = m.get(k);
    if (arr) arr.push(it);
    else m.set(k, [it]);
  }
  return m;
}

export function assignClasses(candidates: readonly Candidate[]): AssignedClass[] {
  const classes: AssignedClass[] = [];
  const restLangInsufficient: Candidate[] = []; // (niveau,langue) trop petit → fusion multilingue

  // Étape 1 : bucket (niveau × langue) — critères durs.
  const buckets = groupBy([...candidates], (c) => `${c.level}|${c.lang}`);

  for (const [key, members] of buckets) {
    const level = Number(key.split('|')[0]);
    const rest: Candidate[] = [];

    // Étape 2 : découpe par tranche d'âge si assez de monde d'une même tranche.
    const byTranche = groupBy(members, (c) => String(trancheOf(c.age)));
    for (const [, group] of byTranche) {
      if (group.length >= MIN_TRANCHE_AGE) {
        const sorted = [...group].sort((a, b) => (a.age ?? 0) - (b.age ?? 0));
        classes.push(...splitInto(sorted, 'mono-age', false));
      } else {
        rest.push(...group);
      }
    }

    // Étape 3 : reste d'un même (niveau,langue), âges mélangés, trié par âge → classes âge-contiguës.
    if (rest.length >= MIN_SIZE) {
      const sorted = rest.sort((a, b) => (a.age ?? 0) - (b.age ?? 0));
      classes.push(...splitInto(sorted, 'same-lang', false));
    } else {
      restLangInsufficient.push(...rest.map((c) => ({ ...c, level }))); // level normalisé
    }
  }

  // Étape 4 : fusion multilingue (même niveau, langues différentes) → classe multilingue + traduction.
  const stillUnplaced: Candidate[] = [];
  const byLevel = groupBy(restLangInsufficient, (c) => String(c.level));
  for (const [, group] of byLevel) {
    if (group.length >= MIN_SIZE) {
      const sorted = group.sort((a, b) =>
        a.lang < b.lang ? -1 : a.lang > b.lang ? 1 : (a.age ?? 0) - (b.age ?? 0),
      );
      classes.push(...splitInto(sorted, 'multilingual', true));
    } else {
      stillUnplaced.push(...group);
    }
  }

  // Étape 5 : dernier recours — multi-niveau adjacent (personne n'est jamais laissé isolé).
  if (stillUnplaced.length > 0) {
    const sorted = stillUnplaced.sort((a, b) => a.level - b.level || (a.lang < b.lang ? -1 : 1));
    const multilingual = new Set(sorted.map((c) => c.lang)).size > 1;
    classes.push(...splitInto(sorted, 'multi-level', multilingual));
  }

  return classes;
}
