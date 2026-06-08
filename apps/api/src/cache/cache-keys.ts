/**
 * Clés de cache **versionnées** (PURES) : invalidation = bump de version
 * (zéro purge fragile). cf. docs/10-APP-WEB/14-backend.md §6.
 */
export function versionedKey(namespace: string, version: number, id: string): string {
  return `${namespace}:v${version}:${id}`;
}

export function skillGraphKey(version: number): string {
  return versionedKey('skill-graph', version, 'all');
}

export function skillClosureKey(version: number, skillId: string): string {
  return versionedKey('skill-closure', version, skillId);
}
