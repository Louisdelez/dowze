import type { ComponentType, SVGProps } from 'react';
import {
  IconToday,
  IconSparkles,
  IconCompass,
  IconChart,
  IconCalendar,
  IconUsers,
  IconMessage,
  IconUserPlus,
  IconNotebook,
  IconBadgeCheck,
  IconHeart,
  IconZap,
  IconTarget,
  IconLanguages,
  IconStar,
  IconGrid,
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
      { href: '/langues', label: 'Cours de langue', icon: IconLanguages },
      { href: '/seance', label: 'Ma séance', icon: IconSparkles },
      { href: '/expeditions', label: 'Expéditions', icon: IconCompass },
      { href: '/tests', label: 'Tests', icon: IconBadgeCheck },
      { href: '/resultats', label: 'Mes résultats', icon: IconChart },
      { href: '/specialisation', label: 'Ma spécialisation', icon: IconTarget },
      { href: '/passion', label: 'Ma passion', icon: IconStar },
      { href: '/saut', label: 'Saut de Rang', icon: IconZap },
      { href: '/planning', label: 'Planning', icon: IconCalendar },
    ],
  },
  {
    title: 'Échanger',
    items: [
      { href: '/communaute', label: 'Ma classe', icon: IconUsers },
      { href: '/amis', label: 'Mes amis', icon: IconUserPlus },
      { href: '/messages', label: 'Messages', icon: IconMessage },
    ],
  },
  {
    title: 'Mes outils',
    items: [
      { href: '/carnet', label: 'Carnet de bord', icon: IconNotebook },
      { href: '/validation', label: 'Validation', icon: IconBadgeCheck },
    ],
  },
];

/** Liens de bas de barre (discrets) : réglages IA + espace responsable. */
export const NAV_SECONDARY: NavItem[] = [
  { href: '/compagnon', label: 'Mon compagnon', icon: IconHeart },
  { href: 'https://infra.dowze.ch', label: 'Mes apps', icon: IconGrid },
  { href: '/parent', label: 'Espace responsable', icon: IconHeart },
];

/** Chemins « publics » : chrome minimale (pas de barre latérale d'app). */
export const PUBLIC_PATHS = ['/', '/inscription', '/connexion'];
