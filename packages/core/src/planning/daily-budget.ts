/**
 * Répartition quotidienne du temps d'apprentissage ACTIF, par tranche d'âge.
 * Recherche 2026 (sourcée) : effet d'espacement (Cepeda) → langue en micro-séance quotidienne
 * PROTÉGÉE, tôt ; révision espacée BORNÉE (10-20 min) ; cœur académique (cours + expéditions)
 * ≈ 60-70 % ; passion PLAFONNÉE ~20 % (bloc-tampon, réduit en premier). Durées calées sur la
 * durée d'attention par âge. Chiffres = recommandations raisonnées à calibrer, pas des optima mesurés.
 */

export type BudgetBlockKey = 'language' | 'review' | 'courses' | 'expeditions' | 'secondary';

export interface BudgetBlock {
  key: BudgetBlockKey;
  label: string;
  minutes: number;
  pct: number;
  /** Bloc protégé (jamais sauté — ex. la langue, le matin). */
  protectedBlock: boolean;
  /** Bloc plafonné (réduit en premier les jours chargés — ex. la passion). */
  capped: boolean;
}

export interface DailyBudget {
  ageBand: string;
  totalMinutes: number;
  blocks: BudgetBlock[];
  note: string;
}

/** Minutes brutes par bloc selon l'âge (cf. grilles de la recherche). */
function rawMinutes(age: number | null): { band: string; m: Record<BudgetBlockKey, number> } {
  const a = age ?? 13;
  if (a <= 11)
    return { band: 'enfant', m: { language: 15, review: 10, courses: 60, expeditions: 40, secondary: 30 } };
  if (a <= 15)
    return { band: 'ado', m: { language: 20, review: 15, courses: 105, expeditions: 60, secondary: 40 } };
  return { band: 'ado+/adulte', m: { language: 28, review: 20, courses: 135, expeditions: 75, secondary: 50 } };
}

const LABELS: Record<BudgetBlockKey, string> = {
  language: 'Langue (le matin)',
  review: 'Révisions',
  courses: 'Cours principaux',
  expeditions: 'Expéditions',
  secondary: 'Ma passion',
};

/**
 * Calcule le budget quotidien. `hasSecondary` retire le bloc passion (optionnel) s'il n'est pas choisi.
 */
export function dailyBudget(age: number | null, hasSecondary = true): DailyBudget {
  const { band, m } = rawMinutes(age);
  const keys: BudgetBlockKey[] = ['language', 'review', 'courses', 'expeditions', 'secondary'];
  const active = keys.filter((k) => k !== 'secondary' || hasSecondary);
  const total = active.reduce((s, k) => s + m[k], 0);
  const blocks: BudgetBlock[] = active.map((k) => ({
    key: k,
    label: LABELS[k],
    minutes: m[k],
    pct: Math.round((m[k] / total) * 100),
    protectedBlock: k === 'language',
    capped: k === 'secondary',
  }));
  return {
    ageBand: band,
    totalMinutes: total,
    blocks,
    note: 'La langue est le bloc protégé (courte, quotidienne, tôt). La passion est le bloc-tampon (plafonné).',
  };
}
