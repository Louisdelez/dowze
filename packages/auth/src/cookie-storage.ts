/**
 * Stockage de session Supabase basé sur des cookies, partagé sur tout *.dowze.ch.
 *
 * Pourquoi : la session par défaut de supabase-js vit dans `localStorage`, qui
 * est cloisonné par origine — `fitness.dowze.ch` ne verrait jamais la session
 * d'`academie.dowze.ch`. En écrivant la session dans un cookie sur le domaine
 * parent `.dowze.ch`, toutes les apps du même compte partagent la connexion
 * (SSO), sans re-login. En local (localhost / IP), on retombe automatiquement
 * sur un cookie d'hôte — le partage inter-sous-domaines ne concerne que la prod.
 *
 * La valeur de session peut dépasser la limite ~4 Ko d'un cookie ; on la
 * découpe donc en fragments `<clé>.0`, `<clé>.1`, … (même principe que
 * @supabase/ssr) et on les réassemble à la lecture.
 */

const CHUNK_SIZE = 3180; // marge sous la limite ~4096 (nom + attributs du cookie)
const MAX_CHUNKS = 16; // garde-fou (~50 Ko de session — bien au-delà du réel ~2-3 Ko)
const MAX_AGE = 60 * 60 * 24 * 365; // 1 an ; l'expiration réelle est gérée par le refresh token

function isBrowser(): boolean {
  return typeof document !== 'undefined';
}

/** Attribut Domain : `.dowze.ch` en prod (partage inter-sous-domaines), rien en local. */
function domainAttr(): string {
  if (!isBrowser()) return '';
  const host = window.location.hostname;
  if (host === 'dowze.ch' || host.endsWith('.dowze.ch')) return '; Domain=.dowze.ch';
  return '';
}

/** `Secure` seulement en HTTPS (sinon le cookie serait rejeté en dev http). */
function secureAttr(): string {
  if (!isBrowser()) return '';
  return window.location.protocol === 'https:' ? '; Secure' : '';
}

function writeCookie(name: string, value: string, maxAge: number): void {
  document.cookie =
    `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAge}` +
    `; SameSite=Lax${domainAttr()}${secureAttr()}`;
}

function deleteCookie(name: string): void {
  document.cookie = `${name}=; Path=/; Max-Age=0; SameSite=Lax${domainAttr()}${secureAttr()}`;
}

function readCookie(name: string): string | null {
  const prefix = `${name}=`;
  const parts = document.cookie ? document.cookie.split('; ') : [];
  for (const part of parts) {
    if (part.startsWith(prefix)) return decodeURIComponent(part.slice(prefix.length));
  }
  return null;
}

/**
 * Implémente l'interface `storage` de supabase-js (getItem/setItem/removeItem,
 * synchrone). Gère la fragmentation transparente des valeurs volumineuses.
 */
export const cookieStorage = {
  getItem(key: string): string | null {
    if (!isBrowser()) return null;
    const first = readCookie(`${key}.0`);
    if (first === null) {
      // Compat : valeur non fragmentée éventuelle (anciens cookies).
      return readCookie(key);
    }
    let out = first;
    for (let i = 1; i < MAX_CHUNKS; i++) {
      const chunk = readCookie(`${key}.${i}`);
      if (chunk === null) break;
      out += chunk;
    }
    return out;
  },

  setItem(key: string, value: string): void {
    if (!isBrowser()) return;
    const chunks: string[] = [];
    for (let i = 0; i < value.length; i += CHUNK_SIZE) {
      chunks.push(value.slice(i, i + CHUNK_SIZE));
    }
    if (chunks.length > MAX_CHUNKS) chunks.length = MAX_CHUNKS; // garde-fou (ne devrait jamais arriver)
    chunks.forEach((chunk, i) => writeCookie(`${key}.${i}`, chunk, MAX_AGE));
    // Purge d'anciens fragments plus longs + l'éventuel cookie non fragmenté.
    for (let i = chunks.length; i < MAX_CHUNKS; i++) deleteCookie(`${key}.${i}`);
    deleteCookie(key);
  },

  removeItem(key: string): void {
    if (!isBrowser()) return;
    for (let i = 0; i < MAX_CHUNKS; i++) deleteCookie(`${key}.${i}`);
    deleteCookie(key);
  },
};
