export interface CompanionDeviceApp {
  id: string;
  label: string;
  shortLabel: string;
  href: string;
  color: string;
  glyph: string;
  group: 'academie' | 'dowze';
}

/**
 * Catalogue unique des applications embarquées dans les appareils du compagnon.
 * Les routes restent les interfaces réelles de Dowze : aucun écran métier parallèle à maintenir.
 */
export const COMPANION_DEVICE_APPS: CompanionDeviceApp[] = [
  {
    id: 'academie',
    label: 'Dowze Académie',
    shortLabel: 'Académie',
    href: '/dashboard',
    color: '#2563eb',
    glyph: 'A',
    group: 'academie',
  },
  {
    id: 'seance',
    label: 'Ma séance',
    shortLabel: 'Séance',
    href: '/seance',
    color: '#7c3aed',
    glyph: '✦',
    group: 'academie',
  },
  {
    id: 'langues',
    label: 'Cours de langue',
    shortLabel: 'Langues',
    href: '/langues',
    color: '#0891b2',
    glyph: '文',
    group: 'academie',
  },
  {
    id: 'expeditions',
    label: 'Expéditions',
    shortLabel: 'Expéditions',
    href: '/expeditions',
    color: '#059669',
    glyph: '⌁',
    group: 'academie',
  },
  {
    id: 'tests',
    label: 'Tests',
    shortLabel: 'Tests',
    href: '/tests',
    color: '#ea580c',
    glyph: '✓',
    group: 'academie',
  },
  {
    id: 'resultats',
    label: 'Mes résultats',
    shortLabel: 'Résultats',
    href: '/resultats',
    color: '#db2777',
    glyph: '↗',
    group: 'academie',
  },
  {
    id: 'planning',
    label: 'Planning',
    shortLabel: 'Planning',
    href: '/planning',
    color: '#4f46e5',
    glyph: '31',
    group: 'academie',
  },
  {
    id: 'classe',
    label: 'Ma classe',
    shortLabel: 'Classe',
    href: '/communaute',
    color: '#0f766e',
    glyph: '◎',
    group: 'academie',
  },
  {
    id: 'carnet',
    label: 'Carnet de bord',
    shortLabel: 'Carnet',
    href: '/carnet',
    color: '#92400e',
    glyph: 'N',
    group: 'academie',
  },
  {
    id: 'validation',
    label: 'Validation',
    shortLabel: 'Validation',
    href: '/validation',
    color: '#16a34a',
    glyph: 'V',
    group: 'academie',
  },
  {
    id: 'store',
    label: 'Applications Dowze',
    shortLabel: 'Apps',
    href: '/store',
    color: '#111827',
    glyph: 'D',
    group: 'dowze',
  },
];

export function getCompanionDeviceApp(id: string): CompanionDeviceApp | undefined {
  return COMPANION_DEVICE_APPS.find((app) => app.id === id);
}
