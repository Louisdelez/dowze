import type { Skill } from '@dowze/schemas';

// Rangs UNIVERSELS de Dowze (école mondiale), Fer → Dowzer Suprême. Le rang mesure la PROFONDEUR DE
// MAÎTRISE — pas l'âge d'apparition d'une notion. « (niveau similaire à …) » calé sur ISCED/UNESCO.
export const RANKS = [
  { name: 'Fer', eq: '(niveau similaire à la maternelle)' },
  { name: 'Bronze', eq: '(niveau similaire au primaire)' },
  { name: 'Argent', eq: '(niveau similaire au collège)' },
  { name: 'Or', eq: '(niveau similaire au lycée)' },
  { name: 'Platine', eq: '(niveau similaire à la licence · bac+3)' },
  { name: 'Émeraude', eq: '(niveau similaire au master · bac+5)' },
  { name: 'Diamant', eq: '(niveau similaire au doctorat · bac+8)' },
  { name: 'Master', eq: '(niveau similaire à un chercheur)' },
  { name: 'Grand Master', eq: '(niveau similaire à la recherche de pointe)' },
  { name: 'Dowzer Suprême', eq: '(repousser la frontière du savoir · sans fin)' },
] as const;

export const TOP_RANK = 10;
export const PROMOTE_FRAC = 0.9; // ≥ 90 % du socle maîtrisé (BKT ≥ 0,95) → montée. Jamais 100 % (Simon).

export function meta(r: number) {
  return RANKS[Math.min(Math.max(r, 1), TOP_RANK) - 1] ?? RANKS[0];
}

/** Les disciplines de spécialisation (le « pic » du profil en T). */
export const DISCIPLINES = [
  'Mathématiques',
  'Français & lettres',
  'Physique-chimie',
  'Informatique & IA',
  'Sciences du vivant',
  'Philosophie',
  'Arts & création',
  'Citoyenneté & société',
  'Corps & mouvement',
  'Langues du monde',
  'Métiers & artisanats',
] as const;

/** Préfixe de slug → discipline. Une seule source de vérité (générateur + placement + spé). */
const DISCIPLINE_BY_PREFIX: Record<string, string> = {
  'math-': 'Mathématiques',
  'lettres-': 'Français & lettres',
  'pc-': 'Physique-chimie',
  'info-': 'Informatique & IA',
  'svt-': 'Sciences du vivant',
  'philo-': 'Philosophie',
  'arts-': 'Arts & création',
  'civ-': 'Citoyenneté & société',
  'corps-': 'Corps & mouvement',
  'lang-': 'Langues du monde',
  'metier-': 'Métiers & artisanats',
};

/** Discipline d'une compétence, d'après le préfixe de slug (les Fondations ne sont pas une spécialité). */
export function disciplineOf(slug: string): string {
  for (const [prefix, name] of Object.entries(DISCIPLINE_BY_PREFIX)) {
    if (slug.startsWith(prefix)) return name;
  }
  return 'Fondations';
}

/** Préfixe de slug d'une discipline (inverse de `disciplineOf`), pour la génération. `''` si Fondations. */
export function prefixOfDiscipline(discipline: string): string {
  for (const [prefix, name] of Object.entries(DISCIPLINE_BY_PREFIX)) {
    if (name === discipline) return prefix;
  }
  return '';
}

/**
 * Classe une compétence dans son RANG réel (1→10). Le champ `rank` explicite **prime** (autoritatif,
 * ISCED) ; à défaut seulement, on retombe sur la déduction par regex de la description (hérité).
 */
export function rankOfSkill(s: Skill): number {
  if (typeof s.rank === 'number' && s.rank >= 1 && s.rank <= TOP_RANK) return s.rank;
  const x = `${s.description ?? ''} ${s.title ?? ''}`.toLowerCase();
  if (/frontières|direction de recherche|post-doctorat|redéfin|repouss/.test(x)) return 9;
  if (
    /état de l'art|doctorat et au-delà|recherche.{0,15}pointe|contribution.{0,25}recherche/.test(x)
  )
    return 8;
  if (/doctorat/.test(x)) return 7;
  if (/master|\bm1\b|\bm2\b/.test(x)) return 6;
  if (/licence|\bl1\b|\bl2\b|\bl3\b/.test(x)) return 5;
  if (/lyc[ée]e/.test(x)) return 4;
  if (/coll[èe]ge/.test(x)) return 3;
  if ((s.depth ?? 0) <= 0) return 1;
  return 2;
}
