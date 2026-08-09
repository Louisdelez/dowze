import { z } from 'zod';
import { chatMessageSchema } from './social';

/**
 * Système ÉCHANGER — Phase D : protections (blocage, signalement, espace modo,
 * Remise à 0, mode supervisé). Voir docs/10-APP-WEB/26-…md §7.
 */

// ---------- Blocage & signalement ----------
export const reportInputSchema = z.object({
  reportedProfileId: z.string().uuid(),
  reason: z.string().min(3).max(2000),
  conversationId: z.string().uuid().nullable().default(null),
});
export type ReportInput = z.infer<typeof reportInputSchema>;

// ---------- Espace modérateur ----------
export const moderationReportSchema = z.object({
  id: z.string().uuid(),
  reporterName: z.string(),
  reportedName: z.string(),
  reason: z.string(),
  status: z.enum(['open', 'reviewing', 'resolved']),
  createdAtIso: z.string(),
  // Fenêtre contextuelle : les derniers messages de la conversation signalée (accès just-in-time).
  context: z.array(chatMessageSchema),
});
export type ModerationReport = z.infer<typeof moderationReportSchema>;

export const resetRequestSchema = z.object({
  id: z.string().uuid(),
  childName: z.string(),
  scope: z.enum(['messages', 'account']),
  requestedBy: z.enum(['self', 'parent']),
  status: z.enum(['pending_parent', 'pending_moderator', 'approved', 'rejected']),
  createdAtIso: z.string(),
});
export type ResetRequest = z.infer<typeof resetRequestSchema>;

// Signalement de l'IA de modération (détecte, suspecte — ne bannit jamais).
export const aiModerationFlagSchema = z.object({
  id: z.string().uuid(),
  authorName: z.string(),
  category: z.string(), // insulte | menace | harcelement | inapproprie
  reason: z.string(),
  severity: z.string(), // moyen | grave | critique
  messageBody: z.string(),
  createdAtIso: z.string(),
});
export type AiModerationFlag = z.infer<typeof aiModerationFlagSchema>;

export const moderatorQueueSchema = z.object({
  isModerator: z.boolean(),
  reports: z.array(moderationReportSchema),
  resetRequests: z.array(resetRequestSchema),
  aiFlags: z.array(aiModerationFlagSchema),
});
export type ModeratorQueue = z.infer<typeof moderatorQueueSchema>;

// ---------- Mode supervisé (validation parentale) ----------
export const supervisionItemViewSchema = z.object({
  id: z.string().uuid(),
  direction: z.enum(['in', 'out']),
  kind: z.enum(['message', 'friend_request']),
  otherName: z.string(), // l'expéditeur (in) ou le destinataire (out)
  preview: z.string(), // contenu du message, ou « Demande d'ami »
  createdAtIso: z.string(),
});
export type SupervisionItemView = z.infer<typeof supervisionItemViewSchema>;

// Alerte de l'IA de modération envoyée immédiatement au parent.
export const aiAlertSchema = z.object({
  id: z.string().uuid(),
  reason: z.string(),
  severity: z.string(),
  createdAtIso: z.string(),
});
export type AiAlert = z.infer<typeof aiAlertSchema>;

// Vue de l'Espace responsable pour un enfant (contrôles parentaux).
export const guardianControlsSchema = z.object({
  guardianId: z.string().uuid().nullable(),
  childAccountId: z.string().uuid(),
  childName: z.string(),
  supervised: z.boolean(),
  queue: z.array(supervisionItemViewSchema),
  // Demandes de remise à 0 émises par l'enfant, en attente de l'accord du parent.
  pendingChildResets: z.array(resetRequestSchema),
  // Alertes de l'IA de modération (immédiates).
  aiAlerts: z.array(aiAlertSchema),
});
export type GuardianControls = z.infer<typeof guardianControlsSchema>;
