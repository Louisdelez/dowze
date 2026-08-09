// Auth minimale et autonome (aucune dépendance) : comptes gérés par l'admin via une variable d'env,
// pas d'inscription publique. Session = cookie signé HMAC-SHA256 (Web Crypto → OK middleware ET route handlers).

export const SESSION_COOKIE = 'dev_session';
const MAX_AGE_S = 60 * 60 * 24 * 7; // 7 jours

function secret(): string {
  const s = process.env.DEV_AUTH_SECRET;
  // En PRODUCTION, on refuse le secret par défaut (sinon sessions ET jetons de partage seraient forgeables).
  if (process.env.NODE_ENV === 'production' && (!s || s.length < 16)) {
    throw new Error(
      'DEV_AUTH_SECRET manquant ou trop court : refus de démarrer avec un secret par défaut.',
    );
  }
  return s || 'dev-insecure-secret-change-me';
}

/**
 * Comptes autorisés. Format env `DEV_ACCOUNTS` : "user1:motdepasse1,user2:motdepasse2".
 * L'admin ajoute/retire un compte en éditant cette variable (fichier .env, chmod 600) — pas d'inscription.
 */
function accounts(): Record<string, string> {
  const raw = process.env.DEV_ACCOUNTS || '';
  const out: Record<string, string> = {};
  for (const pair of raw.split(',')) {
    const i = pair.indexOf(':');
    if (i <= 0) continue;
    const u = pair.slice(0, i).trim();
    const p = pair.slice(i + 1); // le mot de passe peut contenir ':'
    if (u) out[u] = p;
  }
  return out;
}

const enc = new TextEncoder();

function b64urlFromBytes(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
/** Encode une chaîne UTF-8 en base64url. Réutilisable (jetons de partage). */
export function b64url(str: string): string {
  return b64urlFromBytes(enc.encode(str));
}
/** Décode une base64url en chaîne UTF-8. */
export function b64urlDecode(s: string): string {
  return atob(s.replace(/-/g, '+').replace(/_/g, '/'));
}

/** Signe une donnée en HMAC-SHA256 (base64url). Réutilisable (jetons de partage). */
export async function hmac(data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret()),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(data));
  return b64urlFromBytes(new Uint8Array(sig));
}

/** Comparaison à temps constant (anti timing-attack). */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Vérifie identifiant + mot de passe contre la liste admin. */
export function verifyCredentials(username: string, password: string): boolean {
  const acc = accounts();
  const expected = acc[username];
  if (expected === undefined) return false;
  return timingSafeEqual(password, expected) && password.length > 0;
}

/** Crée un jeton de session signé pour l'utilisateur. */
export async function signSession(username: string): Promise<string> {
  const payload = { u: username, exp: Math.floor(Date.now() / 1000) + MAX_AGE_S };
  const body = b64url(JSON.stringify(payload));
  const sig = await hmac(body);
  return `${body}.${sig}`;
}

/** Vérifie un jeton et renvoie l'utilisateur, ou null. */
export async function verifySession(token: string | undefined | null): Promise<string | null> {
  if (!token) return null;
  const dot = token.indexOf('.');
  if (dot <= 0) return null;
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = await hmac(body);
  if (!timingSafeEqual(sig, expected)) return null;
  try {
    const json = atob(body.replace(/-/g, '+').replace(/_/g, '/'));
    const payload = JSON.parse(json) as { u?: string; exp?: number };
    if (!payload.u || !payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload.u;
  } catch {
    return null;
  }
}

export const SESSION_MAX_AGE = MAX_AGE_S;
