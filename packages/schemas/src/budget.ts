import { z } from 'zod';

/** Répartition quotidienne du temps (cf. @dowze/core `dailyBudget`). Affichée sur « Aujourd'hui ». */
export const budgetBlockSchema = z.object({
  key: z.enum(['language', 'review', 'courses', 'expeditions', 'secondary']),
  label: z.string(),
  minutes: z.number().int(),
  pct: z.number().int(),
  protectedBlock: z.boolean(),
  capped: z.boolean(),
});
export type BudgetBlock = z.infer<typeof budgetBlockSchema>;

export const dailyBudgetSchema = z.object({
  ageBand: z.string(),
  totalMinutes: z.number().int(),
  blocks: z.array(budgetBlockSchema),
  note: z.string(),
});
export type DailyBudgetView = z.infer<typeof dailyBudgetSchema>;
