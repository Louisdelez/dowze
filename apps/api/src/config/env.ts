import { z } from 'zod';

/**
 * Variables d'environnement validées (échoue tôt si une variable manque).
 * Source de vérité unique de la configuration runtime.
 */
export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_PORT: z.coerce.number().int().positive().default(3001),
  DATABASE_URL: z.string().min(1),
  SUPABASE_URL: z.string().url().optional(),
  /** Secret JWT Supabase (vérification des jetons). Optionnel en dev/test. */
  SUPABASE_JWT_SECRET: z.string().optional(),
  REDIS_URL: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  return envSchema.parse(source);
}
