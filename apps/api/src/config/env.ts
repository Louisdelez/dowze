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

  // --- Copilote (IA interne orchestratrice). Toutes optionnelles : chaque clé
  // absente désactive simplement le fournisseur correspondant en mode « crédits »
  // (le mode BYOK utilise la clé de l'élève et ne dépend d'aucune de ces variables). ---
  OPENAI_API_KEY: z.string().optional(),
  GOOGLE_GENERATIVE_AI_API_KEY: z.string().optional(),
  MISTRAL_API_KEY: z.string().optional(),
  DEEPSEEK_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  /** Clé de chiffrement des clés BYOK au repos (AES-256-GCM) : 32 octets en base64 ou hex. */
  COPILOTE_SECRET_KEY: z.string().optional(),
  /** Clé AES-256-GCM dédiée au coffre de la Ruche. En dev, COPILOTE_SECRET_KEY sert de repli. */
  HIVE_VAULT_SECRET_KEY: z.string().optional(),
  /** Jeton d'administration pour créditer un solde (en attendant le webhook Stripe). */
  COPILOTE_ADMIN_TOKEN: z.string().optional(),

  // --- IA de modération dédiée (système géré par Dowze, token propre). Si les trois sont
  // présents, la modération utilise le LLM ; sinon elle retombe sur le classifieur règle-based. ---
  MODERATION_PROVIDER: z.enum(['openai', 'google', 'mistral', 'deepseek', 'anthropic']).optional(),
  MODERATION_MODEL: z.string().optional(),
  MODERATION_API_KEY: z.string().optional(),

  // --- Serveur mail dédié Dowze (docker-mailserver sur prod). Envoi transactionnel via SMTP.
  // Sans SMTP_HOST, l'envoi est désactivé (les emails sont seulement journalisés). ---
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().optional(),
  SMTP_FROM: z.string().optional(), // ex. "Dowze <noreply@dowze.ch>"
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  return envSchema.parse(source);
}
