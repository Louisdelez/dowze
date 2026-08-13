import { z } from 'zod';

/**
 * Niveau & XP (engagement/assiduité) — PERSONNEL, monotone, non pédagogique (distinct des rangs
 * Fer→Dowzer Suprême). Courbe quadratique (jamais de mur). Auto-référencé, aucun classement.
 */
export const xpViewSchema = z.object({
  level: z.number().int(),
  xp: z.number().int(),
  /** XP acquis dans le niveau courant. */
  xpIntoLevel: z.number().int(),
  /** XP total requis pour passer au niveau suivant. */
  xpForNext: z.number().int(),
  progressPct: z.number(),
  streak: z.number().int(),
  /** XP gagné aujourd'hui (plafonné). */
  xpToday: z.number().int(),
});
export type XpView = z.infer<typeof xpViewSchema>;
