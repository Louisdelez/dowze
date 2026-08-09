import type { BlockType } from '@dowze/schemas';

/** Ordre d'affichage des colonnes (semaine commençant lundi) : lun→dim. */
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];
export const DAY_SHORT = ['dim', 'lun', 'mar', 'mer', 'jeu', 'ven', 'sam'];
export const DAY_FULL = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
export const MONTH_FULL = [
  'janvier',
  'février',
  'mars',
  'avril',
  'mai',
  'juin',
  'juillet',
  'août',
  'septembre',
  'octobre',
  'novembre',
  'décembre',
];
export const MONTH_SHORT = [
  'jan',
  'fév',
  'mar',
  'avr',
  'mai',
  'juin',
  'juil',
  'août',
  'sep',
  'oct',
  'nov',
  'déc',
];

export interface BlockStyle {
  fill: string;
  text: string;
  sub: string;
  bar: string;
  dot: string;
}

/**
 * Style par type de bloc d'ÉTUDE, façon Apple Calendar : événement PLAT (pas d'ombre), fond tinté clair,
 * barre de couleur à gauche, texte de la couleur (≥ 4.5:1). Couleur = accent, jamais seul signal (icône+label).
 */
export const BLOCK_STYLE: Record<Exclude<BlockType, 'plugin'>, BlockStyle> = {
  langue: {
    fill: 'bg-blue-500/10',
    text: 'text-blue-700',
    sub: 'text-blue-600/70',
    bar: 'bg-blue-500',
    dot: 'bg-blue-500',
  },
  revision: {
    fill: 'bg-orange-500/10',
    text: 'text-orange-700',
    sub: 'text-orange-600/70',
    bar: 'bg-orange-500',
    dot: 'bg-orange-500',
  },
  cours: {
    fill: 'bg-violet-500/10',
    text: 'text-violet-700',
    sub: 'text-violet-600/70',
    bar: 'bg-violet-500',
    dot: 'bg-violet-500',
  },
  expedition: {
    fill: 'bg-emerald-500/10',
    text: 'text-emerald-700',
    sub: 'text-emerald-600/70',
    bar: 'bg-emerald-500',
    dot: 'bg-emerald-500',
  },
  passion: {
    fill: 'bg-pink-500/10',
    text: 'text-pink-700',
    sub: 'text-pink-600/70',
    bar: 'bg-pink-500',
    dot: 'bg-pink-500',
  },
};

/**
 * Palette safelistée pour les blocs `plugin` (activités récurrentes des apps satellites). Les classes sont
 * écrites en toutes lettres pour que Tailwind les inclue au build. La couleur vient du manifeste du plugin.
 */
export const PLUGIN_COLOR_STYLE: Record<string, BlockStyle> = {
  emerald: {
    fill: 'bg-emerald-500/10',
    text: 'text-emerald-700',
    sub: 'text-emerald-600/70',
    bar: 'bg-emerald-500',
    dot: 'bg-emerald-500',
  },
  sky: {
    fill: 'bg-sky-500/10',
    text: 'text-sky-700',
    sub: 'text-sky-600/70',
    bar: 'bg-sky-500',
    dot: 'bg-sky-500',
  },
  teal: {
    fill: 'bg-teal-500/10',
    text: 'text-teal-700',
    sub: 'text-teal-600/70',
    bar: 'bg-teal-500',
    dot: 'bg-teal-500',
  },
  rose: {
    fill: 'bg-rose-500/10',
    text: 'text-rose-700',
    sub: 'text-rose-600/70',
    bar: 'bg-rose-500',
    dot: 'bg-rose-500',
  },
  amber: {
    fill: 'bg-amber-500/10',
    text: 'text-amber-700',
    sub: 'text-amber-600/70',
    bar: 'bg-amber-500',
    dot: 'bg-amber-500',
  },
  lime: {
    fill: 'bg-lime-500/10',
    text: 'text-lime-700',
    sub: 'text-lime-600/70',
    bar: 'bg-lime-500',
    dot: 'bg-lime-500',
  },
  cyan: {
    fill: 'bg-cyan-500/10',
    text: 'text-cyan-700',
    sub: 'text-cyan-600/70',
    bar: 'bg-cyan-500',
    dot: 'bg-cyan-500',
  },
  indigo: {
    fill: 'bg-indigo-500/10',
    text: 'text-indigo-700',
    sub: 'text-indigo-600/70',
    bar: 'bg-indigo-500',
    dot: 'bg-indigo-500',
  },
};

/** Style d'un bloc : type d'étude connu, ou couleur portée par un bloc plugin (fallback emerald). */
export function blockStyle(b: { type: BlockType; color?: string }): BlockStyle {
  if (b.type === 'plugin')
    return PLUGIN_COLOR_STYLE[b.color ?? 'emerald'] ?? PLUGIN_COLOR_STYLE.emerald!;
  return BLOCK_STYLE[b.type];
}

export function startOfWeek(d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = x.getDay() === 0 ? 7 : x.getDay(); // lun=1..dim=7
  x.setDate(x.getDate() - (day - 1));
  return x;
}
export function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
export function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}
export function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}
export function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export function fmtHour(min: number): string {
  return `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
}
/** Grille du mois : 6 semaines × 7 jours, commençant au lundi de la 1re semaine. */
export function monthGrid(anchor: Date): Date[] {
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const start = startOfWeek(first);
  return Array.from({ length: 42 }, (_, i) => addDays(start, i));
}
