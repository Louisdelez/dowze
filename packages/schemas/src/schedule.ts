import { z } from 'zod';

/**
 * Planning refait : profil de disponibilité (preset) + emploi du temps hebdomadaire GÉNÉRÉ par le moteur
 * déterministe de Dowze, affiché dans un calendrier (année/mois/semaine/jour). Cf. recherche 2026.
 */

export const blockTypeSchema = z.enum(['langue', 'revision', 'cours', 'expedition', 'passion', 'plugin']);
export type BlockType = z.infer<typeof blockTypeSchema>;

/** Un bloc de l'emploi du temps hebdomadaire (récurrent). */
export const scheduleBlockSchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  startMin: z.number().int().min(0).max(1439),
  durationMin: z.number().int().min(5).max(600),
  type: blockTypeSchema,
  label: z.string(),
  /** Page vers laquelle mène le bloc (séance, langues, tests…) ou deep-link plugin. */
  href: z.string().optional(),
  // ─ Métadonnées portées par les blocs de type `plugin` (activité récurrente d'une app satellite) ─
  /** App source ('fitness') — pour les blocs plugin. */
  sourceApp: z.string().optional(),
  /** Type d'entrée déclaré par le plugin ('fitness.workout'). */
  entryType: z.string().optional(),
  /** Couleur (palette safelistée : emerald, sky, teal, rose, amber, lime…). */
  color: z.string().optional(),
  /** Nom d'icône Lucide. */
  icon: z.string().optional(),
  /** Nom lisible de l'app (bouton « Ouvrir dans … »). */
  appLabel: z.string().optional(),
});
export type ScheduleBlock = z.infer<typeof scheduleBlockSchema>;

export const intensitySchema = z.enum(['leger', 'moyen', 'soutenu']);
export type Intensity = z.infer<typeof intensitySchema>;

/** La configuration de disponibilité choisie. */
export const scheduleConfigSchema = z.object({
  preset: z.string(),
  activeDays: z.array(z.number().int().min(0).max(6)),
  dayStartMin: z.number().int().min(0).max(1439),
  dayEndMin: z.number().int().min(1).max(1440),
  intensity: intensitySchema,
});
export type ScheduleConfig = z.infer<typeof scheduleConfigSchema>;

/** Un preset proposé (autonomie encadrée). */
export const schedulePresetSchema = z.object({
  key: z.string(),
  name: z.string(),
  description: z.string(),
  activeDays: z.array(z.number().int()),
  dayStartMin: z.number().int(),
  dayEndMin: z.number().int(),
  intensity: intensitySchema,
});
export type SchedulePreset = z.infer<typeof schedulePresetSchema>;

/** Une période de vacances / pause longue. */
export const vacationSchema = z.object({
  id: z.string(),
  startDate: z.string(), // YYYY-MM-DD
  endDate: z.string(),
  label: z.string(),
});
export type Vacation = z.infer<typeof vacationSchema>;

/** Vue complète de la page Planning (calendrier). */
export const scheduleViewSchema = z.object({
  config: scheduleConfigSchema,
  /** Emploi du temps hebdomadaire généré (blocs récurrents). */
  blocks: z.array(scheduleBlockSchema),
  /** Presets proposés. */
  presets: z.array(schedulePresetSchema),
  /** Périodes de vacances. */
  vacations: z.array(vacationSchema),
  /** Est-on en vacances aujourd'hui (mode maintenance) ? */
  onVacation: z.boolean(),
});
export type ScheduleView = z.infer<typeof scheduleViewSchema>;
