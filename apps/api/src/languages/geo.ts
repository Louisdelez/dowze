/**
 * Proposition GÉOGRAPHIQUE de langues (pure, testable). Croise : langues nationales de la région,
 * langue des voisins frontaliers, anglais (utilité pro quasi universelle), et — pour les pays
 * plurilingues (Suisse, Belgique) — les AUTRES langues nationales. Le « pourquoi » est projectif +
 * autonome + concret (jamais « tu dois »), cf. Dörnyei (ideal L2 self r=0,61) et Grin (primes salariales).
 * Recherche : Power Language Index (Chan/INSEAD), British Council, OFS, Ethnologue.
 */

/** Noms français des langues (code court → nom). */
export const LANG_NAMES: Record<string, string> = {
  en: 'anglais',
  de: 'allemand',
  fr: 'français',
  it: 'italien',
  es: 'espagnol',
  pt: 'portugais',
  nl: 'néerlandais',
  ar: 'arabe',
  zh: 'mandarin',
  ru: 'russe',
  ja: 'japonais',
  ko: 'coréen',
  ro: 'roumain',
  pl: 'polonais',
};

/** Catalogue complet proposé au choix libre. */
export const CATALOGUE: string[] = ['en', 'es', 'de', 'fr', 'it', 'pt', 'nl', 'zh', 'ar', 'ja', 'ko', 'ru'];

interface Proposal {
  lang: string;
  pitch: string;
}

/** Propositions ordonnées par pays (les plus pertinentes d'abord). */
const BY_COUNTRY: Record<string, Proposal[]> = {
  CH: [
    { lang: 'de', pitch: "Parle avec 63 % de la Suisse dans sa langue — et jusqu'à +20 % de salaire selon les études (Grin)." },
    { lang: 'en', pitch: "La langue passe-partout du travail et du web : elle t'ouvre le monde entier." },
    { lang: 'it', pitch: "Une langue nationale suisse : voyage et travaille des deux côtés de la frontière comme chez toi." },
  ],
  BE: [
    { lang: 'nl', pitch: "Deviens vraiment bilingue de ton pays : la Flandre et Bruxelles s'ouvrent à toi." },
    { lang: 'en', pitch: "La langue passe-partout du travail international et du web." },
    { lang: 'de', pitch: "Troisième langue officielle de Belgique et langue du voisin le plus fort d'Europe." },
  ],
  FR: [
    { lang: 'en', pitch: "La langue passe-partout du travail et du web : le meilleur premier investissement." },
    { lang: 'es', pitch: "Deuxième langue la plus parlée au monde par ses natifs — voyage et travail à ta portée." },
    { lang: 'de', pitch: "La langue du premier partenaire économique de la France, juste de l'autre côté du Rhin." },
    { lang: 'it', pitch: "La langue du voisin du sud : culture, cuisine et travail transfrontalier." },
  ],
  DE: [
    { lang: 'en', pitch: "La langue passe-partout du travail et du web." },
    { lang: 'fr', pitch: "La langue du grand voisin de l'ouest et un atout pro en Europe." },
    { lang: 'es', pitch: "Une langue mondiale pour voyager et travailler bien au-delà de l'Europe." },
  ],
  AT: [
    { lang: 'en', pitch: "La langue passe-partout du travail et du web." },
    { lang: 'it', pitch: "La langue du voisin du sud, pour voyager et travailler des deux côtés des Alpes." },
    { lang: 'fr', pitch: "Un atout pro reconnu partout en Europe." },
  ],
  IT: [
    { lang: 'en', pitch: "La langue passe-partout du travail et du web." },
    { lang: 'de', pitch: "La langue du grand voisin du nord et un vrai atout pour le travail." },
    { lang: 'fr', pitch: "La langue du voisin de l'ouest, proche de l'italien : tu progresseras vite." },
  ],
  ES: [
    { lang: 'en', pitch: "La langue passe-partout du travail et du web." },
    { lang: 'fr', pitch: "La langue du voisin du nord, proche de l'espagnol : montée rapide." },
    { lang: 'pt', pitch: "Très proche de l'espagnol — tu ouvres tout le Brésil et le Portugal presque gratuitement." },
  ],
  LU: [
    { lang: 'de', pitch: "L'une des langues du pays et du grand voisin : un socle pour le travail." },
    { lang: 'en', pitch: "La langue passe-partout du travail international." },
    { lang: 'fr', pitch: "Langue administrative du Luxembourg et atout transfrontalier." },
  ],
  CA: [
    { lang: 'en', pitch: "L'autre grande langue officielle du Canada : indispensable au travail." },
    { lang: 'es', pitch: "Une langue des Amériques pour voyager et travailler très largement." },
    { lang: 'fr', pitch: "L'autre langue officielle du Canada, un atout partout au pays." },
  ],
};

/** Repli générique (pas de pays connu) : les langues les plus utiles au monde. */
const FALLBACK: Proposal[] = [
  { lang: 'en', pitch: "La langue passe-partout du travail et du web : le meilleur premier choix." },
  { lang: 'es', pitch: "L'une des langues les plus parlées au monde — voyage et travail à grande échelle." },
  { lang: 'de', pitch: "Une grande langue économique européenne, très demandée dans le travail." },
];

/**
 * Propose jusqu'à `max` langues, en excluant la langue maternelle et celles déjà choisies.
 * @param country code ISO pays (CH, FR…) dérivé de la locale (`fr-CH`) — insensible à la casse.
 * @param l1 langue maternelle (code court) à exclure.
 * @param already langues déjà apprises (à exclure).
 */
export function proposeLanguages(
  country: string | null,
  l1: string,
  already: string[],
  max = 4,
): Array<{ lang: string; name: string; pitch: string }> {
  const exclude = new Set([l1, ...already].map((x) => x.toLowerCase()));
  const list = (country && BY_COUNTRY[country.toUpperCase()]) || FALLBACK;
  // On complète avec le repli si le pays propose peu, sans doublon.
  const seen = new Set<string>();
  const merged: Proposal[] = [];
  for (const p of [...list, ...FALLBACK]) {
    if (seen.has(p.lang) || exclude.has(p.lang)) continue;
    seen.add(p.lang);
    merged.push(p);
  }
  return merged.slice(0, max).map((p) => ({ lang: p.lang, name: LANG_NAMES[p.lang] ?? p.lang, pitch: p.pitch }));
}

/** Dérive le pays depuis une locale type `fr-CH` (→ CH). Null si absent. */
export function countryFromLocale(locale: string | null | undefined): string | null {
  if (!locale) return null;
  const parts = locale.split('-');
  return parts.length > 1 ? (parts[1] ?? null) : null;
}
