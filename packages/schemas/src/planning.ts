import { z } from 'zod';
import { uuidSchema, isoDateTimeSchema } from './common';

/**
 * Planning, présence et minuteur — tenir un rythme **sainement**
 * (cf. docs/10-APP-WEB/11-planning-regularite.md). L'intra calcule le « quand »
 * de façon déterministe ; l'IA génère le « quoi ». Jamais punitif.
 */

/** Un créneau de disponibilité hebdomadaire. */
export const slotSchema = z.object({
  /** Jour de la semaine : 0 = dimanche … 6 = samedi. */
  dayOfWeek: z.number().int().min(0).max(6),
  /** Minute de début dans la journée (0 = 00:00 … 1439 = 23:59). */
  startMinute: z.number().int().min(0).max(1439),
  durationMin: z.number().int().min(5).max(600),
});
export type Slot = z.infer<typeof slotSchema>;

export const weeklyAvailabilitySchema = z.object({
  profileId: uuidSchema,
  slots: z.array(slotSchema).default([]),
});
export type WeeklyAvailability = z.infer<typeof weeklyAvailabilitySchema>;

/** Nature d'une entrée de planning. */
export const planningEntryKindSchema = z.enum([
  'apprentissage',
  'revision',
  'expedition',
  'pause',
]);
export type PlanningEntryKind = z.infer<typeof planningEntryKindSchema>;

/** Statut d'une entrée — neutre, jamais culpabilisant. */
export const presenceStatusSchema = z.enum(['prevu', 'realise', 'partiel', 'non-realise']);
export type PresenceStatus = z.infer<typeof presenceStatusSchema>;

/** Une entrée de planning (un bloc de travail prévu un jour donné). */
export const planningEntrySchema = z.object({
  id: uuidSchema,
  profileId: uuidSchema,
  dateIso: isoDateTimeSchema,
  kind: planningEntryKindSchema,
  /** Cible : compétence ou expédition (selon le type). */
  skillId: uuidSchema.nullable().default(null),
  expeditionId: uuidSchema.nullable().default(null),
  durationMin: z.number().int().min(5).max(600),
  status: presenceStatusSchema.default('prevu'),
});
export type PlanningEntry = z.infer<typeof planningEntrySchema>;

/**
 * Bilan de présence d'une journée — miroir bienveillant (auto-référencé, jamais
 * de comparaison sociale). L'absence est une donnée qui ajuste le planning.
 */
export const attendanceRecordSchema = z.object({
  profileId: uuidSchema,
  dateIso: isoDateTimeSchema,
  entriesPlanned: z.number().int().nonnegative(),
  entriesDone: z.number().int().nonnegative(),
  status: presenceStatusSchema,
});
export type AttendanceRecord = z.infer<typeof attendanceRecordSchema>;

/** Configuration du minuteur synchronisé au planning. */
export const timerConfigSchema = z.object({
  focusMin: z.number().int().min(5).max(180).default(25),
  breakMin: z.number().int().min(1).max(60).default(5),
  /** Sonnerie douce à résonance décroissante (cloche pleine conscience). */
  bellEnabled: z.boolean().default(true),
  bellVolume: z.number().min(0).max(1).default(0.4),
  /** Disque visuel qui se vide (peut être masqué si anxiogène). */
  visualDisc: z.boolean().default(true),
});
export type TimerConfig = z.infer<typeof timerConfigSchema>;
