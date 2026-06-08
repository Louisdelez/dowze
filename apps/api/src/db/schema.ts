import {
  pgTable,
  uuid,
  text,
  integer,
  smallint,
  boolean,
  doublePrecision,
  timestamp,
  primaryKey,
} from 'drizzle-orm/pg-core';

/**
 * Schéma Drizzle — miroir typé d'un sous-ensemble des tables Postgres
 * (cf. supabase/migrations). Source de vérité SQL = les migrations ; ici on
 * décrit ce que le backend lit/écrit.
 */

export const accounts = pgTable('accounts', {
  id: uuid('id').primaryKey().defaultRandom(),
  authUserId: uuid('auth_user_id').unique(),
  email: text('email').notNull().unique(),
  role: text('role').notNull().default('eleve'),
  isMinor: boolean('is_minor').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const profiles = pgTable('profiles', {
  id: uuid('id').primaryKey().defaultRandom(),
  accountId: uuid('account_id').notNull(),
  displayName: text('display_name').notNull(),
  locale: text('locale').notNull(),
  timezone: text('timezone').notNull(),
  phase: text('phase').notNull().default('tronc-commun'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const skills = pgTable('skills', {
  id: uuid('id').primaryKey().defaultRandom(),
  slug: text('slug').notNull().unique(),
  title: text('title').notNull(),
  description: text('description').notNull().default(''),
  kind: text('kind').notNull(),
  depth: integer('depth').notNull(),
  isRoot: boolean('is_root').notNull().default(false),
  epistemicStatus: text('epistemic_status').notNull().default('etabli'),
  halfLifeYears: doublePrecision('half_life_years'),
  masteryThreshold: doublePrecision('mastery_threshold').notNull().default(0.95),
  sources: text('sources').array().notNull().default([]),
});

export const prerequisites = pgTable(
  'prerequisites',
  {
    skillId: uuid('skill_id').notNull(),
    prerequisiteId: uuid('prerequisite_id').notNull(),
  },
  (t) => ({ pk: primaryKey({ columns: [t.skillId, t.prerequisiteId] }) }),
);

export const masteryStates = pgTable(
  'mastery_states',
  {
    profileId: uuid('profile_id').notNull(),
    skillId: uuid('skill_id').notNull(),
    pMastery: doublePrecision('p_mastery').notNull().default(0.1),
    attempts: integer('attempts').notNull().default(0),
    correct: integer('correct').notNull().default(0),
    lastUpdated: timestamp('last_updated', { withTimezone: true }),
  },
  (t) => ({ pk: primaryKey({ columns: [t.profileId, t.skillId] }) }),
);

export const sm2Cards = pgTable(
  'sm2_cards',
  {
    profileId: uuid('profile_id').notNull(),
    skillId: uuid('skill_id').notNull(),
    repetitions: integer('repetitions').notNull().default(0),
    easeFactor: doublePrecision('ease_factor').notNull().default(2.5),
    intervalDays: integer('interval_days').notNull().default(0),
    dueDate: timestamp('due_date', { withTimezone: true }),
    lastReviewed: timestamp('last_reviewed', { withTimezone: true }),
  },
  (t) => ({ pk: primaryKey({ columns: [t.profileId, t.skillId] }) }),
);

export const availabilitySlots = pgTable('availability_slots', {
  id: uuid('id').primaryKey().defaultRandom(),
  profileId: uuid('profile_id').notNull(),
  dayOfWeek: smallint('day_of_week').notNull(),
  startMinute: smallint('start_minute').notNull(),
  durationMin: smallint('duration_min').notNull(),
});

export const planningEntries = pgTable('planning_entries', {
  id: uuid('id').primaryKey().defaultRandom(),
  profileId: uuid('profile_id').notNull(),
  date: timestamp('date', { withTimezone: true }).notNull(),
  kind: text('kind').notNull(),
  skillId: uuid('skill_id'),
  expeditionId: uuid('expedition_id'),
  durationMin: smallint('duration_min').notNull(),
  status: text('status').notNull().default('prevu'),
});
