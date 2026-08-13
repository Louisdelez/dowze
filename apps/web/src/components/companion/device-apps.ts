export interface CompanionDeviceApp {
  id: string;
  label: string;
  shortLabel: string;
  href: string;
  color: string;
  glyph: string;
  group: 'dowze';
}

/**
 * Les véritables produits Dowze disponibles sur un appareil.
 *
 * Une fonctionnalité interne (séance, planning, résultats, mémoire…) n'est pas
 * une application. Elle reste dans la navigation du produit auquel elle
 * appartient. Ce catalogue ne doit donc contenir que des applications Dowze
 * autonomes, avec leur propre périmètre et leur propre interface.
 */
export const COMPANION_DEVICE_APPS: CompanionDeviceApp[] = [
  {
    id: 'academie',
    label: 'Dowze Académie',
    shortLabel: 'Académie',
    href: 'https://academie.dowze.ch',
    color: '#2563eb',
    glyph: 'A',
    group: 'dowze',
  },
  {
    id: 'fitness',
    label: 'Dowze Fitness',
    shortLabel: 'Fitness',
    href: 'https://fitness.dowze.ch',
    color: '#059669',
    glyph: 'F',
    group: 'dowze',
  },
  {
    id: 'sports',
    label: 'Dowze Sports',
    shortLabel: 'Sports',
    href: 'https://sports.dowze.ch',
    color: '#0284c7',
    glyph: 'S',
    group: 'dowze',
  },
  {
    id: 'alimentation',
    label: 'Dowze Alimentation',
    shortLabel: 'Alimentation',
    href: 'https://alimentations.dowze.ch',
    color: '#d97706',
    glyph: 'N',
    group: 'dowze',
  },
];

export function getCompanionDeviceApp(id: string): CompanionDeviceApp | undefined {
  return COMPANION_DEVICE_APPS.find((app) => app.id === id);
}
