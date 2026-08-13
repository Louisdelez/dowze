import { jwtVerify, createRemoteJWKSet } from 'jose';

/**
 * Vérifie un jeton JWT Supabase et renvoie le `sub` (identifiant auth).
 * Supabase self-host récent signe en ASYMÉTRIQUE (ES256) → on vérifie via le
 * JWKS public exposé par GoTrue. Repli HS256 (secret partagé) pour les jetons
 * legacy / la clé anon. Lève si le jeton est invalide/expiré.
 */
let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;
function getJwks(): ReturnType<typeof createRemoteJWKSet> {
  if (!jwks) {
    const base = process.env.SUPABASE_URL ?? 'http://supabase-kong:8000';
    jwks = createRemoteJWKSet(new URL(`${base}/auth/v1/.well-known/jwks.json`));
  }
  return jwks;
}

export async function verifySupabaseJwt(token: string, secret: string): Promise<string> {
  try {
    const { payload } = await jwtVerify(token, getJwks());
    return String(payload.sub ?? '');
  } catch {
    const key = new TextEncoder().encode(secret);
    const { payload } = await jwtVerify(token, key);
    return String(payload.sub ?? '');
  }
}
