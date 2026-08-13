// Liens de partage : jeton signé HMAC-SHA256 `{ u, p, exp }` (utilisateur, chemin relatif, expiration unix).
// Réutilise les primitives de session.ts. Aucune donnée sensible dans le jeton (juste un chemin + une date).

import { hmac, b64url, b64urlDecode, timingSafeEqual } from './session';

export const SHARE_TTL_MIN = 60 * 60; // 1 h (minimum)
export const SHARE_TTL_MAX = 60 * 60 * 24; // 24 h (maximum)

export interface SharePayload {
  u: string; // propriétaire (racine de stockage)
  p: string; // chemin relatif du fichier/dossier
  exp: number; // expiration (unix secondes)
}

/** Borne la durée demandée entre 1 h et 24 h. */
export function clampTtl(seconds: number): number {
  if (!Number.isFinite(seconds)) return SHARE_TTL_MIN;
  return Math.max(SHARE_TTL_MIN, Math.min(SHARE_TTL_MAX, Math.floor(seconds)));
}

/** Crée un jeton de partage signé, valable `ttlSeconds` (borné 1h–24h). */
export async function signShare(
  u: string,
  p: string,
  ttlSeconds: number,
): Promise<{ token: string; exp: number }> {
  const exp = Math.floor(Date.now() / 1000) + clampTtl(ttlSeconds);
  const body = b64url(JSON.stringify({ u, p, exp } satisfies SharePayload));
  const sig = await hmac(body);
  return { token: `${body}.${sig}`, exp };
}

/** Vérifie un jeton de partage : renvoie la charge utile si valide et non expiré, sinon null. */
export async function verifyShare(token: string | undefined | null): Promise<SharePayload | null> {
  if (!token) return null;
  const dot = token.indexOf('.');
  if (dot <= 0) return null;
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  if (!timingSafeEqual(sig, await hmac(body))) return null;
  try {
    const payload = JSON.parse(b64urlDecode(body)) as SharePayload;
    if (!payload.u || !payload.p || !payload.exp) return null;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null; // expiré
    return payload;
  } catch {
    return null;
  }
}
