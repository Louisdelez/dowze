import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { cookieStorage } from './cookie-storage';

export interface DowzeAuthConfig {
  url?: string;
  anonKey?: string;
}

/**
 * Clé de stockage commune à TOUTES les apps *.dowze.ch. Comme le cookie est
 * posé sur `.dowze.ch` avec cette même clé, academie et les plugins lisent la
 * même session → SSO.
 */
export const AUTH_STORAGE_KEY = 'dowze-auth';

let client: SupabaseClient | null = null;

/**
 * Client Supabase partagé de Dowze. La session est persistée dans un cookie sur
 * `.dowze.ch` (cf. cookie-storage) pour un SSO entre academie et les plugins.
 * Singleton paresseux : sûr à appeler n'importe où, ne casse pas le build si les
 * variables d'environnement ne sont pas encore définies.
 */
export function getSupabase(config: DowzeAuthConfig = {}): SupabaseClient {
  if (client) return client;
  const url = config.url ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54321';
  const anonKey = config.anonKey ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'anon-key';
  client = createClient(url, anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storage: cookieStorage,
      storageKey: AUTH_STORAGE_KEY,
    },
  });
  return client;
}

/**
 * Déconnexion globale : révoque le refresh token côté serveur (scope `global`
 * par défaut de supabase-js) puis purge le cookie de session `.dowze.ch`.
 * Toutes les apps du compte perdent la session au prochain rafraîchissement.
 */
export async function globalLogout(): Promise<void> {
  await getSupabase().auth.signOut(); // scope global : révoque tous les refresh tokens
  cookieStorage.removeItem(AUTH_STORAGE_KEY);
}
