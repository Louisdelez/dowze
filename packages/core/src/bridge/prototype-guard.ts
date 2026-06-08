/**
 * Garde-fou contre la « prototype pollution ».
 * `JSON.parse` crée `__proto__` comme propriété propre — inoffensif tant qu'on
 * ne fusionne pas l'objet, mais on rejette par principe toute clé dangereuse.
 */

const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

/** Vrai si une clé interdite apparaît n'importe où dans la structure. */
export function hasForbiddenKeys(value: unknown): boolean {
  const stack: unknown[] = [value];
  while (stack.length > 0) {
    const cur = stack.pop();
    if (cur === null || typeof cur !== 'object') continue;
    for (const key of Object.keys(cur as Record<string, unknown>)) {
      if (FORBIDDEN_KEYS.has(key)) return true;
      stack.push((cur as Record<string, unknown>)[key]);
    }
  }
  return false;
}
