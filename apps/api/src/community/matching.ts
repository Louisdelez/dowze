/**
 * Formation des Classes (PURE, testable).
 * Contraintes DURES (mêmes valeurs) : langue + fuseau + type.
 * Objectif SOUPLE : niveaux **hétérogènes DANS** la classe (entraide),
 * homogènes ENTRE classes — obtenu par distribution round-robin sur les niveaux triés.
 * (cf. docs/10-APP-WEB/05-systeme-communautaire/05-classes-et-communication.md)
 */
export interface Candidate {
  profileId: string;
  locale: string;
  timezone: string;
  type: string;
  level: number;
}

export interface FormedClasse {
  /** Clé de regroupement (langue|fuseau|type) + index de classe. */
  key: string;
  locale: string;
  timezone: string;
  type: string;
  memberIds: string[];
}

function hardKey(c: Candidate): string {
  return `${c.locale}|${c.timezone}|${c.type}`;
}

export function formClasses(
  candidates: readonly Candidate[],
  targetSize = 24,
): FormedClasse[] {
  const groups = new Map<string, Candidate[]>();
  for (const c of candidates) {
    const k = hardKey(c);
    const arr = groups.get(k);
    if (arr) arr.push(c);
    else groups.set(k, [c]);
  }

  const result: FormedClasse[] = [];
  for (const [key, members] of groups) {
    const nClasses = Math.max(1, Math.ceil(members.length / targetSize));
    // Tri par niveau, puis distribution round-robin → hétérogénéité intra-classe.
    const sorted = [...members].sort((a, b) => a.level - b.level);
    const buckets: Candidate[][] = Array.from({ length: nClasses }, () => []);
    sorted.forEach((c, i) => {
      (buckets[i % nClasses] as Candidate[]).push(c);
    });
    const [locale, timezone, type] = key.split('|') as [string, string, string];
    buckets.forEach((bucket, idx) => {
      result.push({
        key: `${key}#${idx}`,
        locale,
        timezone,
        type,
        memberIds: bucket.map((c) => c.profileId),
      });
    });
  }
  return result;
}
