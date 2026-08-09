/**
 * Correction PURE des exercices à saisie (réponse courte, cloze). Tolérante :
 * insensible à la casse, aux accents, aux espaces et à la ponctuation, et
 * accepte les synonymes déclarés (scoring sémantique > mot exact).
 * (cf. docs/10-APP-WEB/18-tests-et-examens.md)
 */

/** Normalise une réponse pour comparaison indulgente. */
export function normalizeAnswer(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // retire les accents
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ') // ponctuation → espace
    .replace(/\s+/g, ' ')
    .trim();
}

/** Vrai si `answer` correspond à l'une des réponses acceptées (après normalisation). */
export function matchesAccepted(answer: string, accepted: readonly string[]): boolean {
  const a = normalizeAnswer(answer);
  if (a.length === 0) return false;
  return accepted.some((acc) => normalizeAnswer(acc) === a);
}

/** Corrige un cloze : un booléen par trou + score global. */
export function gradeCloze(
  userAnswers: readonly string[],
  gaps: readonly { acceptedAnswers: readonly string[] }[],
): { perGap: boolean[]; correct: number; total: number } {
  const perGap = gaps.map((g, i) => matchesAccepted(userAnswers[i] ?? '', g.acceptedAnswers));
  const correct = perGap.filter(Boolean).length;
  return { perGap, correct, total: gaps.length };
}
