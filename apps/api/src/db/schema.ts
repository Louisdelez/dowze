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

export const rubrics = pgTable('rubrics', {
  skillId: uuid('skill_id').primaryKey(),
});

export const rubricCriteria = pgTable(
  'rubric_criteria',
  {
    skillId: uuid('skill_id').notNull(),
    id: text('id').notNull(),
    label: text('label').notNull(),
    description: text('description').notNull().default(''),
    required: boolean('required').notNull().default(true),
  },
  (t) => ({ pk: primaryKey({ columns: [t.skillId, t.id] }) }),
);

export const validations = pgTable('validations', {
  id: uuid('id').primaryKey().defaultRandom(),
  skillId: uuid('skill_id').notNull(),
  learnerId: uuid('learner_id').notNull(),
  tier: text('tier').notNull(),
  reviewerId: uuid('reviewer_id'),
  passed: boolean('passed').notNull(),
  evidenceUrl: text('evidence_url'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const validationVerdicts = pgTable(
  'validation_verdicts',
  {
    validationId: uuid('validation_id').notNull(),
    criterionId: text('criterion_id').notNull(),
    met: boolean('met').notNull(),
    comment: text('comment').notNull().default(''),
  },
  (t) => ({ pk: primaryKey({ columns: [t.validationId, t.criterionId] }) }),
);

export const peerReviewQueue = pgTable('peer_review_queue', {
  id: uuid('id').primaryKey().defaultRandom(),
  skillId: uuid('skill_id').notNull(),
  learnerId: uuid('learner_id').notNull(),
  evidenceUrl: text('evidence_url'),
  claimedBy: uuid('claimed_by'),
  resolved: boolean('resolved').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const classes = pgTable('classes', {
  id: uuid('id').primaryKey().defaultRandom(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  locale: text('locale').notNull(),
  timezone: text('timezone').notNull(),
  type: text('type').notNull(),
  cycle: text('cycle').notNull().default('trimestre'),
  status: text('status').notNull().default('active'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const memberships = pgTable(
  'memberships',
  {
    classeId: uuid('classe_id').notNull(),
    profileId: uuid('profile_id').notNull(),
    role: text('role').notNull().default('membre'),
    joinedAt: timestamp('joined_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({ pk: primaryKey({ columns: [t.classeId, t.profileId] }) }),
);

export const channels = pgTable('channels', {
  id: uuid('id').primaryKey().defaultRandom(),
  kind: text('kind').notNull(),
  classeId: uuid('classe_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const messages = pgTable('messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  channelId: uuid('channel_id').notNull(),
  authorId: uuid('author_id').notNull(),
  body: text('body').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const expeditions = pgTable('expeditions', {
  id: uuid('id').primaryKey().defaultRandom(),
  slug: text('slug').notNull().unique(),
  title: text('title').notNull(),
  grandeQuestion: text('grande_question').notNull(),
  durationWeeks: smallint('duration_weeks').notNull().default(3),
  phase: text('phase').notNull().default('etincelle'),
  status: text('status').notNull().default('proposee'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const expeditionSkills = pgTable(
  'expedition_skills',
  {
    expeditionId: uuid('expedition_id').notNull(),
    skillId: uuid('skill_id').notNull(),
  },
  (t) => ({ pk: primaryKey({ columns: [t.expeditionId, t.skillId] }) }),
);

export const guardians = pgTable('guardians', {
  id: uuid('id').primaryKey().defaultRandom(),
  minorAccountId: uuid('minor_account_id').notNull(),
  email: text('email').notNull(),
  consentStatus: text('consent_status').notNull().default('en-attente'),
  consentAt: timestamp('consent_at', { withTimezone: true }),
  hasDashboardAccount: boolean('has_dashboard_account').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const moderationIncidents = pgTable('moderation_incidents', {
  id: uuid('id').primaryKey().defaultRandom(),
  source: text('source').notNull(),
  severity: text('severity').notNull(),
  contentRef: text('content_ref').notNull(),
  authorId: uuid('author_id'),
  victimId: uuid('victim_id'),
  status: text('status').notNull().default('ouvert'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const moderationActions = pgTable('moderation_actions', {
  id: uuid('id').primaryKey().defaultRandom(),
  incidentId: uuid('incident_id').notNull(),
  actorId: uuid('actor_id').notNull(),
  kind: text('kind').notNull(),
  reason: text('reason').notNull().default(''),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const parentalAlerts = pgTable('parental_alerts', {
  id: uuid('id').primaryKey().defaultRandom(),
  minorAccountId: uuid('minor_account_id').notNull(),
  guardianEmail: text('guardian_email').notNull(),
  incidentId: uuid('incident_id'),
  severity: text('severity').notNull(),
  reason: text('reason').notNull(),
  humanValidated: boolean('human_validated').notNull().default(false),
  sentAt: timestamp('sent_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
