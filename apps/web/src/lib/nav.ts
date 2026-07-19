import type { ComponentType, SVGProps } from 'react';
import {
  IconToday,
  IconSparkles,
  IconCompass,
  IconChart,
  IconCalendar,
  IconUsers,
  IconNotebook,
  IconBadgeCheck,
  IconPlug,
  IconHeart,
  IconRobot,
} from '@/components/ui/icons';

export interface NavItem {
  href: string;
  label: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
}

export interface NavGroup {
  title: string;
  items: NavItem[];
}

/**
 * Architecture d'information : groupée, hiérarchisée, ~5 destinations
 * primaires. Les outils avancés (Pont .json) sont relégués, pas en façade.
 * La boucle quotidienne (Apprendre) vient en premier.
 */
export const NAV_GROUPS: NavGroup[] = [
  {
    title: 'Apprendre',
    items: [
      { href: '/dashboard', label: "Aujourd'hui", icon: IconToday },
      { href: '/seance', label: 'Ma séance', icon: IconSparkles },
      { href: '/expeditions', label: 'Expéditions', icon: IconCompass },
      { href: '/progression', label: 'Progression', icon: IconChart },
      { href: '/planning', label: 'Planning', icon: IconCalendar },
    ],
  },
  {
    title: 'Échanger',
    items: [{ href: '/communaute', label: 'Ma classe', icon: IconUsers }],
  },
  {
    title: 'Mes outils',
    items: [
      { href: '/carnet', label: 'Carnet de bord', icon: IconNotebook },
      { href: '/validation', label: 'Validation', icon: IconBadgeCheck },
    ],
  },
];

/** Liens de bas de barre (discrets) : espace responsable + outil avancé. */
export const NAV_SECONDARY: NavItem[] = [
  { href: '/copilote', label: 'Mon Copilote', icon: IconRobot },
  { href: '/parent', label: 'Espace responsable', icon: IconHeart },
  { href: '/bridge', label: 'Pont .json', icon: IconPlug },
];

/** Chemins « publics » : chrome minimale (pas de barre latérale d'app). */
export const PUBLIC_PATHS = ['/', '/inscription', '/connexion'];
