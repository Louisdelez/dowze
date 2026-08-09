import { z } from 'zod';

/**
 * Système ÉCHANGER — Phase A : amis + messagerie (MP, groupes).
 * Câblé sur les tables friendships / conversations / conversation_participants / messages.
 * Noms distincts de community.ts (qui contient des schémas « design » non câblés).
 * Voir docs/10-APP-WEB/26-social-classes-moderation-traduction.md
 */

// ---------- Amis ----------
export const friendStatusSchema = z.enum(['friends', 'incoming', 'outgoing', 'blocked', 'none']);
export type FriendStatus = z.infer<typeof friendStatusSchema>;

export const friendSchema = z.object({
  profileId: z.string().uuid(),
  name: z.string(),
  tag: z.string().nullable(), // discriminateur : pseudo affiché = name#tag
  level: z.number().int().nonnegative(),
  status: friendStatusSchema,
});
export type Friend = z.infer<typeof friendSchema>;

export const socialOverviewSchema = z.object({
  meProfileId: z.string().uuid(),
  meName: z.string(),
  meTag: z.string().nullable(), // mon propre code ami à partager (Nom#tag)
  friends: z.array(friendSchema),
  incoming: z.array(friendSchema), // demandes reçues (à accepter)
  outgoing: z.array(friendSchema), // demandes envoyées (en attente)
});
export type SocialOverview = z.infer<typeof socialOverviewSchema>;

export const friendActionInputSchema = z.object({
  targetProfileId: z.string().uuid(),
});
export type FriendActionInput = z.infer<typeof friendActionInputSchema>;

// ---------- Conversations ----------
export const conversationTypeSchema = z.enum(['direct', 'group', 'class_channel']);
export type ConversationType = z.infer<typeof conversationTypeSchema>;

export const conversationSummarySchema = z.object({
  id: z.string().uuid(),
  type: conversationTypeSchema,
  title: z.string(), // nom du groupe, ou pseudo de l'autre pour un MP
  lastBody: z.string().nullable(),
  lastMessageAt: z.string().nullable(),
  unread: z.boolean(),
});
export type ConversationSummary = z.infer<typeof conversationSummarySchema>;

// ---------- Messages ----------
export const chatMessageKindSchema = z.enum(['text', 'image', 'file', 'subject_share']);
export type ChatMessageKind = z.infer<typeof chatMessageKindSchema>;

export const chatMessageSchema = z.object({
  id: z.string().uuid(),
  senderId: z.string().uuid(),
  senderName: z.string(),
  body: z.string(),
  kind: chatMessageKindSchema,
  meta: z.record(z.unknown()).nullable(),
  mine: z.boolean(),
  status: z.enum(['active', 'anonymized']),
  held: z.boolean().default(false), // mode supervisé : mon message est en attente de validation parentale
  createdAt: z.string(),
});
export type ChatMessage = z.infer<typeof chatMessageSchema>;

export const conversationViewSchema = z.object({
  id: z.string().uuid(),
  type: conversationTypeSchema,
  title: z.string(),
  otherId: z.string().uuid().nullable(), // l'autre participant (MP) — pour bloquer/signaler
  messages: z.array(chatMessageSchema),
});
export type ConversationView = z.infer<typeof conversationViewSchema>;

export const sendMessageInputSchema = z.object({
  body: z.string().min(1).max(4000),
  kind: chatMessageKindSchema.default('text'),
  meta: z.record(z.unknown()).nullable().default(null),
});
export type SendMessageInput = z.infer<typeof sendMessageInputSchema>;

// Démarrer un MP avec un ami (renvoie la conversation existante ou la crée).
export const startDirectInputSchema = z.object({
  friendProfileId: z.string().uuid(),
});
export type StartDirectInput = z.infer<typeof startDirectInputSchema>;

// Partager un sujet de validation in-app (option 3) vers une conversation.
export const shareSubjectInputSchema = z.object({
  conversationId: z.string().uuid(),
  subjectId: z.string().uuid(),
});
export type ShareSubjectInput = z.infer<typeof shareSubjectInputSchema>;
