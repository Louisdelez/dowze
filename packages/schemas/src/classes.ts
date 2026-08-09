import { z } from 'zod';

/**
 * Système ÉCHANGER — Phase B : « Ma Classe » (classes assignées). Voir doc 26 §3.
 */

export const classMemberSchema = z.object({
  profileId: z.string().uuid(),
  name: z.string(),
  level: z.number().int(),
});
export type ClassMember = z.infer<typeof classMemberSchema>;

export const myClassViewSchema = z.object({
  hasClass: z.boolean(),
  id: z.string().uuid().nullable(),
  name: z.string(),
  level: z.number().int(),
  lang: z.string(),
  isMultilingual: z.boolean(),
  channelId: z.string().uuid().nullable(), // conversation du canal de classe (messagerie Phase A)
  members: z.array(classMemberSchema),
  assignmentReason: z.string(),
});
export type MyClassView = z.infer<typeof myClassViewSchema>;

export const assignResultClassSchema = z.object({
  name: z.string(),
  level: z.number().int(),
  lang: z.string(),
  isMultilingual: z.boolean(),
  size: z.number().int(),
  reason: z.enum(['mono-age', 'same-lang', 'multilingual', 'multi-level']),
});
export type AssignResultClass = z.infer<typeof assignResultClassSchema>;

export const assignResultSchema = z.object({
  created: z.number().int(),
  totalLearners: z.number().int(),
  classes: z.array(assignResultClassSchema),
});
export type AssignResult = z.infer<typeof assignResultSchema>;
