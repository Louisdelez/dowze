import { z } from 'zod';

/**
 * Contribution au planning (P2) — un plugin déclare une **activité récurrente**
 * (ex. « sport 3×/sem ») ou une **entrée ponctuelle** (match, événement) ; le
 * cœur l'orchestre avec l'étude. Modèle « source + projection » : le plugin
 * possède sa séance, le cœur en projette une entrée-référence. Cf. docs/12-PLUGINS/02.
 */

export const activityIntensitySchema = z.enum(['legere', 'moderee', 'intense']);
export type ActivityIntensity = z.infer<typeof activityIntensitySchema>;

/** Déclaration d'une activité récurrente par un plugin (scope `calendar:write`). */
export const recurringActivitySchema = z.object({
  sourceApp: z.string().min(1), // 'fitness'
  sourceRef: z.string().min(1), // id de la ressource côté plugin (ownership)
  type: z.string().min(1), // 'fitness.workout' (déclaré dans contributes)
  title: z.string().min(1), // libellé générique (pas de détail santé)
  frequencyPerWeek: z.number().int().min(1).max(14),
  durationMin: z.number().int().min(5).max(180),
  intensity: activityIntensitySchema,
  hardConstraints: z
    .object({
      minRecoveryHoursSameType: z.number().int().min(0).max(168).optional(), // 24–48
      minRestDaysPerWeek: z.number().int().min(0).max(6).optional(), // ≥ 1
      weeklyCapMin: z.number().int().min(0).max(2000).optional(), // ≤ 300 (OMS)
      notBefore: z.array(z.string()).optional(), // ['examen','revisions-lourdes'] si intense
    })
    .default({}),
  softPreferences: z
    .object({
      preferredTime: z.enum(['matin', 'apres-midi', 'soir']).optional(),
      stackAfter: z.string().optional(), // habit-stacking : 'revision' | 'cours'…
      cognitiveBoostBeforeStudy: z.boolean().optional(), // séance modérée avant un bloc d'étude
    })
    .default({}),
  priority: z.number().int().min(0).max(100).default(50), // l'étude reste le socle
  missPolicy: z
    .object({
      catchUp: z.boolean().default(true),
      windowDays: z.number().int().min(0).max(14).default(3),
    })
    .default({ catchUp: true, windowDays: 3 }),
  adherenceMetric: z.literal('rolling-regularity').default('rolling-regularity'),
});
export type RecurringActivity = z.infer<typeof recurringActivitySchema>;

export const declareRecurringBodySchema = recurringActivitySchema.extend({
  profileId: z.string().uuid(),
});
export type DeclareRecurringBody = z.infer<typeof declareRecurringBodySchema>;

// ─── Entrée ponctuelle (projection stockée : match, événement) ───

export const calendarEntryStatusSchema = z.enum(['confirmed', 'tentative', 'cancelled']);

export const calendarEntrySchema = z.object({
  id: z.string().uuid(),
  profileId: z.string().uuid(),
  sourceApp: z.string(),
  sourceRef: z.string(),
  entryType: z.string(),
  title: z.string(),
  start: z.string(), // ISO 8601
  durationMin: z.number().int().min(1).max(1440),
  scope: z.string(),
  status: calendarEntryStatusSchema,
});
export type CalendarEntry = z.infer<typeof calendarEntrySchema>;

export const createCalendarEntryBodySchema = z.object({
  profileId: z.string().uuid(),
  sourceApp: z.string().min(1),
  sourceRef: z.string().min(1),
  entryType: z.string().min(1),
  title: z.string().min(1),
  start: z.string().datetime({ offset: true }),
  durationMin: z.number().int().min(1).max(1440),
  status: calendarEntryStatusSchema.default('confirmed'),
});
export type CreateCalendarEntryBody = z.infer<typeof createCalendarEntryBodySchema>;
