import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Client Supabase (auth côté navigateur). Créé paresseusement pour ne pas
 * échouer au build si les variables ne sont pas encore définies.
 */
let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!client) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54321';
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'anon-key';
    client = createClient(url, anon, { auth: { persistSession: true } });
  }
  return client;
}
