import { jwtVerify } from 'jose';

/**
 * Vérifie un jeton JWT Supabase (HS256, secret partagé) et renvoie le `sub`
 * (identifiant auth de l'utilisateur). Lève si le jeton est invalide/expiré.
 */
export async function verifySupabaseJwt(token: string, secret: string): Promise<string> {
  const key = new TextEncoder().encode(secret);
  const { payload } = await jwtVerify(token, key);
  return String(payload.sub ?? '');
}
