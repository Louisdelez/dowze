import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { CompanionState } from '@/components/companion/states';
import type { CompanionConfig } from '@/lib/api';

/**
 * Pets « Codex » : planche standard 1536×1872, frames 192×208, une ligne = une animation
 * (schéma repris à l'identique de codex-pet.com). Le frame reste 192×208 partout, seul le
 * nombre de lignes varie selon la galerie — d'où l'auto-détection de la grille dans <CodexPet>.
 */
export const FRAME_W = 192;
export const FRAME_H = 208;
export const SHEET_W = 1536; // défaut avant détection des dimensions réelles
export const SHEET_H = 1872;

export interface CodexAnim {
  id: string;
  row: number;
  frames: number;
  durationMs: number;
}

export const CODEX_ANIMS: Record<string, CodexAnim> = {
  idle: { id: 'idle', row: 0, frames: 6, durationMs: 1100 },
  'running-right': { id: 'running-right', row: 1, frames: 8, durationMs: 1060 },
  'running-left': { id: 'running-left', row: 2, frames: 8, durationMs: 1060 },
  waving: { id: 'waving', row: 3, frames: 4, durationMs: 700 },
  jumping: { id: 'jumping', row: 4, frames: 5, durationMs: 840 },
  failed: { id: 'failed', row: 5, frames: 8, durationMs: 1220 },
  waiting: { id: 'waiting', row: 6, frames: 6, durationMs: 1010 },
  running: { id: 'running', row: 7, frames: 6, durationMs: 820 },
  review: { id: 'review', row: 8, frames: 6, durationMs: 1030 },
};

/** Les 9 animations dans l'ordre, avec un libellé FR (pour l'aperçu des animations). */
export const ANIM_LABELS: { id: string; label: string }[] = [
  { id: 'idle', label: 'Repos' },
  { id: 'review', label: 'Réfléchit' },
  { id: 'running', label: 'S’active' },
  { id: 'jumping', label: 'Saute' },
  { id: 'waving', label: 'Coucou' },
  { id: 'failed', label: 'Raté' },
  { id: 'waiting', label: 'Attend' },
  { id: 'running-right', label: 'Court →' },
  { id: 'running-left', label: 'Court ←' },
];

/** Mapping des états du compagnon Dowze → animation Codex. */
export const STATE_ANIM: Record<CompanionState, string> = {
  idle: 'idle',
  reading: 'review',
  thinking: 'review',
  preparing: 'review',
  organizing: 'running',
  almost: 'running',
  done: 'jumping',
  ask: 'waving',
  retry: 'running',
  error: 'failed',
  offline: 'waiting',
};

/** Planche d'un pet curé (auto-hébergé dans public/pets/). */
export function curatedSheetUrl(slug: string): string {
  return `/pets/${slug}.webp`;
}

/**
 * Résout la saisie du « mode libre » en URL de planche :
 * - une URL absolue (http/https) → telle quelle (n'importe quel site : petdex.dev, etc.) ;
 * - sinon, traité comme un nom de pet codex-pet.com → planche du CDN.
 */
export function resolveFreeInput(value: string): string {
  const v = value.trim();
  if (/^https?:\/\//i.test(v)) return v;
  return `https://cdn.codex-pet.com/pets/${v}/spritesheet.webp`;
}

/** Pets « curés » téléchargés dans l'app (auto-hébergés), choisis à la main. */
export const CURATED_PETS: { slug: string; name: string }[] = [
  { slug: 'super-nono-v2', name: 'Nono' },
  { slug: 'aiso-feather', name: 'Feather' },
  { slug: 'aka-shiba', name: 'Shiba' },
  { slug: 'aqua-wisp', name: 'Aqua' },
  { slug: 'bipy', name: 'Bipy' },
  { slug: 'boba-2', name: 'Boba' },
  { slug: 'bolt', name: 'Bolt' },
  { slug: 'cloudy', name: 'Cloudy' },
];

/** Galeries de pets « Codex » : va choisir un pet, télécharge son .zip, puis importe-le dans l'app. */
export const PET_SITES: { name: string; url: string; note: string }[] = [
  { name: 'codex-pet.com', url: 'https://codex-pet.com', note: 'télécharge la planche et importe-la' },
  { name: 'codexpet.top', url: 'https://codexpet.top', note: 'télécharge la planche et importe-la' },
  { name: 'petdex.dev', url: 'https://petdex.dev', note: 'télécharge le .zip et importe-le' },
  { name: 'codex-pets.net', url: 'https://codex-pets.net', note: 'télécharge le .zip et importe-le' },
];

export const COMPANION_MIN_SIZE = 60;
export const COMPANION_MAX_SIZE = 260;
export const COMPANION_DEFAULT_SIZE = 140;

// « Cam » : une tuile façon visio Discord (bords arrondis) avec un décor derrière le pet.
export const CAM_MIN_SIZE = 200;
export const CAM_MAX_SIZE = 480;
export const CAM_DEFAULT_SIZE = 320; // largeur de la tuile en px (hauteur = ratio 4:3)
export const CAM_RATIO = 0.75; // hauteur / largeur (4:3)
export const DEFAULT_WORLD = 'salle-de-classe';
/** Nom du compagnon (la persona) par défaut — distinct du nom d'un pet importé. */
export const DEFAULT_COMPANION_NAME = 'Dowze';

/** Les « mondes » (décors) au choix — rendus en SVG/CSS (voir companion-worlds.tsx). */
export const WORLDS: { id: string; name: string }[] = [
  { id: 'salle-de-classe', name: 'Salle de classe' },
  { id: 'plage', name: 'Plage' },
  { id: 'piscine', name: 'Piscine' },
  { id: 'espace', name: 'Espace' },
  { id: 'foret', name: 'Forêt' },
  { id: 'cafe', name: 'Café' },
];

/** Compagnon par défaut pour tout le monde (si aucun pet choisi) = Super NONO. */
const DEFAULT_URL = curatedSheetUrl('super-nono-v2');

interface PetStore {
  /** URL de la planche choisie (relative si curée, absolue si libre/importée). `null` = pas de pet. */
  url: string | null;
  /** true = compagnon masqué (« Aucun »). */
  hidden: boolean;
  /** taille du compagnon en px. */
  size: number;
  /** true = mode « cam » (tuile visio avec décor) au lieu du pet flottant. */
  camMode: boolean;
  /** id du monde/décor choisi pour la cam. */
  world: string;
  /** largeur de la tuile cam en px. */
  camSize: number;
  /** nom du compagnon (persona) — affiché dans la cam. Distinct du nom d'un pet. */
  companionName: string;
  setUrl: (url: string) => void;
  setHidden: (hidden: boolean) => void;
  setSize: (size: number) => void;
  setCamMode: (on: boolean) => void;
  setWorld: (world: string) => void;
  setCamSize: (n: number) => void;
  setCompanionName: (name: string) => void;
  /** Hydrate depuis le compte (serveur = source de vérité, perso à chacun). */
  hydrate: (cfg: CompanionConfig) => void;
}

export const useCompanionPet = create<PetStore>()(
  persist(
    (set) => ({
      url: DEFAULT_URL,
      hidden: false,
      size: COMPANION_DEFAULT_SIZE,
      camMode: false,
      world: DEFAULT_WORLD,
      camSize: CAM_DEFAULT_SIZE,
      companionName: DEFAULT_COMPANION_NAME,
      setUrl: (url) => set({ url, hidden: false }),
      setHidden: (hidden) => set({ hidden }),
      setSize: (size) => set({ size }),
      setCamMode: (camMode) => set({ camMode }),
      setWorld: (world) => set({ world }),
      setCamSize: (camSize) => set({ camSize }),
      setCompanionName: (companionName) => set({ companionName }),
      hydrate: (cfg) =>
        set((s) => ({
          url: cfg.url !== undefined ? cfg.url : s.url,
          size: typeof cfg.size === 'number' ? cfg.size : s.size,
          hidden: typeof cfg.hidden === 'boolean' ? cfg.hidden : s.hidden,
          camMode: typeof cfg.camMode === 'boolean' ? cfg.camMode : s.camMode,
          world: typeof cfg.world === 'string' ? cfg.world : s.world,
          camSize: typeof cfg.camSize === 'number' ? cfg.camSize : s.camSize,
          companionName: typeof cfg.name === 'string' && cfg.name ? cfg.name : s.companionName,
        })),
    }),
    {
      name: 'dowze-companion-pet',
      version: 1,
      // Migre l'ancien défaut local (Feather) vers le nouveau (Super NONO). Sans effet sur un vrai
      // choix : le compte prime à l'hydratation, qui restaure le pet réellement choisi.
      migrate: (persisted, version) => {
        const s = persisted as Partial<PetStore> | undefined;
        if (version < 1 && s && s.url === curatedSheetUrl('aiso-feather')) {
          return { ...s, url: DEFAULT_URL } as PetStore;
        }
        return persisted as PetStore;
      },
    },
  ),
);
