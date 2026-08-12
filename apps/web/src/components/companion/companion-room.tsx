'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import dynamic from 'next/dynamic';
import { CodexPet } from '@/components/companion/codex-pet';
// Moteur GPU (PixiJS) des open-spaces — chargé côté client uniquement (WebGL).
const PixiOpenspace = dynamic(
  () => import('@/components/companion/pixi-openspace').then((m) => m.PixiOpenspace),
  { ssr: false },
);
import { CompanionDevice } from '@/components/companion/companion-phone';
import { SettingsMenu } from '@/components/companion/settings-menu';
import {
  actPetCare,
  buyShopItem,
  getPetCare,
  getPetRoom,
  getSchedule,
  setPetRoom,
  getCompanionAgents,
  createCompanionAgent,
  deleteCompanionAgent,
  buildCompanionAgent,
  chatCompanionAgent,
  createRelayToken,
  maintainHive,
  retrainCompanionAgent,
  revertCompanionAgentPrompt,
  retireCompanionAgent,
  protectCompanionAgent,
  getCompanionSpaces,
  createCompanionSpace,
  deleteCompanionSpace,
  getOrgTemplates,
  ensureServiceOrg,
  orchestrateSpace,
  addSpaceKnowledge,
  deleteSpaceKnowledge,
  runSpaceProject,
  getSpaceCare,
  actAgentCare,
  recordHiveEvent,
  getHiveCompanionStates,
  type HiveMaintainReport,
  type PetCareState,
  type PetMood,
  type RoomItem,
  type CompanionAgent,
  type AgentPersonality,
  type CompanionSpace,
  type OrgTemplate,
  type SpaceKnowledge,
  type ProjectResult,
  type HiveCompanionState,
} from '@/lib/api';
import { useProfile } from '@/lib/use-profile';
import { blockStyle, fmtHour, DAY_FULL, MONTH_FULL, ymd } from '@/lib/calendar';
import type { ScheduleView } from '@dowze/schemas';
import { useCompanionPet, CURATED_PETS, curatedSheetUrl } from '@/lib/companion-pet';
import { useLocalWeather, wmoIcon, wmoLabel, type WeatherCategory } from '@/lib/use-local-weather';
import {
  decideAction,
  pickLine,
  pickReaction,
  pickWanderTarget,
  type BrainCtx,
} from '@/lib/companion-brain';
import { FLOOR_MATS, WALL_MATS, MAT_PRICES } from '@/components/companion/materials.generated';
import {
  FURNITURE,
  FURNITURE_PRICES,
  FURNITURE_CATS,
  furnUrl,
} from '@/components/companion/furniture.generated';

/** Sentinelle du pinceau « gomme » (efface le carré → retire l'override, rembourse l'unité). */
const ERASER = '~eraser';

/* ---------- Géométrie isométrique ---------- */
const COLS = 8;
const ROWS = 8;
const TW = 72;
const TH = 36;
const WALL = 96;
const OX = (ROWS * TW) / 2;
const OY = WALL;
const cx = (gc: number, gr: number) => OX + (gc - gr) * (TW / 2);
const cy = (gc: number, gr: number) => OY + (gc + gr) * (TH / 2);
// Murs subdivisés en carrés (blocs) : WLEVELS niveaux. j = colonne (le long de r/c), k = niveau (0 = haut).
const WLEVELS = 3;
const WH = WALL / WLEVELS; // hauteur d'un carré de mur (géométrie sol/murs = versions dynamiques g* dans le composant)
const TOP = 96; // marge haute pour les sprites
const center = (c: number, r: number) => ({ x: cx(c + 0.5, r + 0.5), y: cy(c + 0.5, r + 0.5) });
const depthScale = (c: number, r: number) => 0.8 + ((c + r) / (COLS + ROWS - 2)) * 0.34;
const zOf = (c: number, r: number) => Math.round((c + r) * 100);

/** Physique interne d'un compagnon secondaire (déambulation + réplique). */
type SecPhys = {
  name: string;
  personality: AgentPersonality | null;
  c: number;
  r: number;
  tc: number | null;
  tr: number | null;
  facing: 'left' | 'right';
  nextAt: number;
  sayAt: number;
  speech: string | null;
  speechUntil: number;
};
/** Données de rendu d'un compagnon secondaire (état React). */
type SecRender = {
  id: string;
  name: string;
  skinUrl: string | null;
  size: number;
  room: string;
  c: number;
  r: number;
  facing: 'left' | 'right';
  moving: boolean;
  speech: string | null;
};

/** Traits proposés à la création (pilotent les répliques PNJ). */
const TRAIT_CHIPS = ['curieux', 'taquin', 'calme', 'énergique', 'gourmand', 'timide'];

/** Réplique PNJ courte, teintée par la personnalité (aucune IA). */
function personaLine(p: AgentPersonality | null | undefined, nm: string): string {
  const traits = (p?.traits ?? []).map((t) => t.toLowerCase());
  const has = (...ks: string[]) => ks.some((k) => traits.some((t) => t.includes(k)));
  const bank = [
    'Coucou !',
    `C'est ${nm}.`,
    'Je passais par là.',
    'Tout roule ?',
    'Hé, salut !',
    'On fait quoi ?',
  ];
  if (p?.tone) bank.push(`${p.tone.charAt(0).toUpperCase()}${p.tone.slice(1)}, comme toujours.`);
  if (has('curieu')) bank.push('Il se passe quoi d’intéressant ?', 'Oh, c’est quoi ça ?');
  if (has('taquin', 'malicieu', 'espiègle'))
    bank.push('Héhé, tu m’as vu ?', 'Attrape-moi si tu peux !');
  if (has('calme', 'zen', 'posé')) bank.push('On souffle un peu.', 'Tranquille…');
  if (has('énergi', 'sporti', 'vif')) bank.push('On bouge, on bouge !', 'Allez, on y va !');
  if (has('gourmand')) bank.push('Y a un truc à grignoter ?');
  if (has('timide')) bank.push('…salut.');
  return bank[Math.floor(Math.random() * bank.length)]!;
}

/** Réponse PNJ courte à un message du joueur (mots-clés simples + teinte personnalité, zéro IA). */
function replyLine(p: AgentPersonality | null | undefined, nm: string, msg: string): string {
  const pick = (a: string[]) => a[Math.floor(Math.random() * a.length)]!;
  const m = msg.toLowerCase();
  if (/\b(bonjour|salut|coucou|hello|hey|yo)\b/.test(m))
    return pick(['Coucou !', 'Salut à toi !', `Hé, c'est ${nm} !`]);
  if (/(ça va|ca va|comment vas|tu vas|la forme)/.test(m))
    return pick(['Ça va super, et toi ?', 'Au top !', 'Nickel, merci !']);
  if (/\bmerci\b/.test(m)) return pick(['De rien !', 'Avec plaisir !', 'Quand tu veux !']);
  if (/(bravo|super|génial|genial|trop bien|cool|bien jou)/.test(m))
    return pick(['Merci !', 'Héhé, merci !', 'Ça fait plaisir !']);
  if (/(dodo|dors|fatigu|sieste|repos)/.test(m))
    return pick(['On fait une sieste ?', 'Un peu de repos, oui…', 'Bonne idée, je baille déjà.']);
  if (/(jou|jeu|amuse)/.test(m)) return pick(['On joue ?!', 'Oui oui oui, on joue !', 'Chiche !']);
  if (/(mange|faim|goûter|gouter|repas)/.test(m))
    return pick(['Y a un truc à grignoter ?', 'J’ai un petit creux…', 'Miam, où ça ?']);
  if (msg.trim().endsWith('?'))
    return pick(['Bonne question !', 'Hmm, je sais pas trop…', 'Peut-être bien !', 'À ton avis ?']);
  return personaLine(p, nm);
}
const DOOR = { c: COLS - 1, r: ROWS - 1 }; // « porte » au premier plan (coin avant)
const REST = { c: 3, r: 4 }; // case de repos au centre

/* ---------- Pièces ---------- */
interface RoomPreset {
  name: string;
  floor: string;
  floorAlt: string;
  wallL?: string;
  wallR?: string;
  walls: boolean;
  bg: string;
  floorTex?: string;
  wallTex?: string;
}
const ROOMS: Record<string, RoomPreset> = {
  chambre: {
    name: 'Chambre',
    floor: '#e9d8c5',
    floorAlt: '#e1ccb6',
    wallL: '#c3b0e6',
    wallR: '#d6c8ef',
    walls: true,
    bg: '#efe8f7',
    floorTex: 'sol-bois-clair',
    wallTex: 'mur-papier-fleuri',
  },
  salon: {
    name: 'Salon',
    floor: '#dcc6ab',
    floorAlt: '#d2bb9d',
    wallL: '#a6c9ae',
    wallR: '#bcd8c2',
    walls: true,
    bg: '#eef4ee',
    floorTex: 'sol-bois-fonce',
    wallTex: 'mur-pastel',
  },
  cuisine: {
    name: 'Cuisine',
    floor: '#e1e6ec',
    floorAlt: '#d4dae2',
    wallL: '#eecf97',
    wallR: '#f5e2b8',
    walls: true,
    bg: '#faf3e6',
    floorTex: 'sol-carrelage-blanc',
    wallTex: 'mur-carrelage',
  },
  bureau: {
    name: 'Bureau',
    floor: '#cdba9f',
    floorAlt: '#c2ad90',
    wallL: '#a5bccf',
    wallR: '#bccfe0',
    walls: true,
    bg: '#eef2f7',
    floorTex: 'sol-bois-clair',
    wallTex: 'mur-rayures',
  },
  jardin: {
    name: 'Jardin',
    floor: '#8ece79',
    floorAlt: '#82c56d',
    walls: false,
    bg: '#bfe6f2',
    floorTex: 'sol-herbe',
  },
  plage: {
    name: 'Plage',
    floor: '#f2dca0',
    floorAlt: '#ecd393',
    walls: false,
    bg: '#9fd8f0',
    floorTex: 'sol-sable',
  },
};
// Catalogue des matériaux (textures) — généré : 100+ sols, 100+ murs. Voir scratchpad/gen2.mjs.
// Aperçu d'un matériau (swatch texture).
function MatSwatch({ id, size = 40 }: { id: string; size?: number }) {
  return (
    <span
      className="inline-block rounded-md border border-black/10"
      style={{
        width: size,
        height: size,
        backgroundImage: `url(/textures/${id}.png)`,
        backgroundSize: '120% 120%',
        backgroundPosition: 'center',
      }}
    />
  );
}
const ROOM_IDS = Object.keys(ROOMS);
// Décor d'un open-space (espace de travail) : grand sol neutre « bureau », sans murs, où vivent les agents.
const OPENSPACE_PRESET: RoomPreset = {
  name: 'Open space',
  floor: '#d9dee7',
  floorAlt: '#cfd5df',
  walls: false,
  bg: '#eef1f6',
  floorTex: 'sol-beton',
};

/** Salles d'un OPEN-SPACE (thème entreprise) : MURS + sol texturés, comme une vraie pièce d'entreprise. */
const OPENSPACE_ROOMS: Record<string, RoomPreset> = {
  travail: {
    name: 'Espace de travail',
    floor: '#d9dee7',
    floorAlt: '#cfd5df',
    wallL: '#b7c2d6',
    wallR: '#cdd6e6',
    walls: true,
    bg: '#eef1f6',
    floorTex: 'sol-moquette-gris',
    wallTex: 'mur-rayures-blanc-gris',
  },
  toilettes: {
    name: 'Toilettes',
    floor: '#e3e8ee',
    floorAlt: '#d6dce4',
    wallL: '#bfe0e6',
    wallR: '#d6eef2',
    walls: true,
    bg: '#eef6f7',
    floorTex: 'sol-carrelage-blanc',
    wallTex: 'mur-carrelage-ciel',
  },
  cantine: {
    name: 'Cantine',
    floor: '#dcc6ab',
    floorAlt: '#d2bb9d',
    wallL: '#eecf97',
    wallR: '#f5e2b8',
    walls: true,
    bg: '#faf3e6',
    floorTex: 'sol-carrelage-creme',
    wallTex: 'mur-uni-creme',
  },
  repos: {
    name: 'Espace de repos',
    floor: '#cfe0cf',
    floorAlt: '#c2d6c2',
    wallL: '#a6c9ae',
    wallR: '#bcd8c2',
    walls: true,
    bg: '#eef4ee',
    floorTex: 'sol-moquette-sauge',
    wallTex: 'mur-uni-sauge',
  },
  parking: {
    name: 'Parking',
    floor: '#c9ccd2',
    floorAlt: '#bcc0c7',
    wallL: '#9aa3ad',
    wallR: '#b3bac3',
    walls: true,
    bg: '#e7e9ee',
    floorTex: 'sol-beton-gris',
    wallTex: 'mur-uni-gris',
  },
};
/* ============================ TAILLES DE MAP (⚙️ CONFIG ADMIN) ============================
 * Tailles disponibles, toutes créées/optimisées/fonctionnelles. La taille est IMPOSÉE (l'utilisateur
 * ne peut PAS la changer) ; NOUS (admin) la choisissons ici puis on redéploie.
 *  - Tailles ≤ SVG_MAX : rendu SVG par tuile (texturé + interactif).
 *  - Tailles  > SVG_MAX : rendu CANVAS optimisé (résolution plafonnée → mémoire bornée, tient 128/256).
 * ========================================================================================= */
const MAP_SIZES = [8, 16, 32, 64, 128, 256] as const;
type MapSize = (typeof MAP_SIZES)[number];
/** Au-delà de cette taille de côté, on bascule du SVG (une tuile = un nœud) au canvas (une passe de dessin). */
const SVG_MAX = 16;
/** Taille de la Maison (par défaut la pièce cosy 8×8 ; réglable admin). */
const HOME_SIZE: MapSize = 8;
/** Taille par TYPE de salle d'open-space (réglable admin). L'espace de travail est vaste ; les annexes plus petites. */
const OPENSPACE_SIZES: Record<string, MapSize> = {
  travail: 32,
  toilettes: 16,
  cantine: 16,
  repos: 16,
  parking: 16,
};
const sizeForOpenspace = (type: string): MapSize => OPENSPACE_SIZES[type] ?? 16;
/** Plafond de résolution du canvas (px) : borne la mémoire quelle que soit la taille de map (256 inclus). */
const MAX_CANVAS_PX = 4096;
/** Ordre des salles dans la barre, par type d'espace. */
const HOME_ROOM_ORDER = ROOM_IDS;
const OPENSPACE_ROOM_ORDER = Object.keys(OPENSPACE_ROOMS);
/** Types de salles MULTI-INSTANCE (menu déroulant) : chambres perso (Maison), workspaces (open-space). */
const MULTI_ROOM_TYPES = new Set(['chambre', 'travail']);
/** Type de salle (sans le suffixe d'instance). Ex : 'travail:2' → 'travail', 'chambre:<id>' → 'chambre'. */
const roomType = (room: string): string => room.split(':')[0]!;

/** Skin par défaut universel (le robot « Nono ») : garantit qu'un compagnon a TOUJOURS un skin. */
const ROBOT_SKIN_URL = curatedSheetUrl('super-nono-v2');
/** Classe du nametag, positionné AU-DESSUS du compagnon (au ras de la tête). */
const NAMETAG_CLASS =
  'pointer-events-none absolute bottom-full mb-1 whitespace-nowrap rounded-full bg-black/45 px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur-sm';

/* ---------- Icônes (Lucide inline) ---------- */
const ICON: Record<string, ReactNode> = {
  utensils: (
    <>
      <path d="M3 2v7a2 2 0 0 0 2 2 2 2 0 0 0 2-2V2" />
      <path d="M7 2v20" />
      <path d="M21 15V2a5 5 0 0 0-5 5v6a2 2 0 0 0 2 2h3Zm0 0v7" />
    </>
  ),
  smile: (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="M8 14s1.5 2 4 2 4-2 4-2" />
      <path d="M9 9h.01" />
      <path d="M15 9h.01" />
    </>
  ),
  zap: <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />,
  droplet: (
    <path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z" />
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </>
  ),
  eraser: (
    <>
      <path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21" />
      <path d="M22 21H7" />
      <path d="m5 11 9 9" />
    </>
  ),
  wind: (
    <>
      <path d="M12.8 19.6A2 2 0 1 0 14 16H2" />
      <path d="M17.5 8a2.5 2.5 0 1 1 2 4H2" />
      <path d="M9.8 4.4A2 2 0 1 1 11 8H2" />
    </>
  ),
  mapPin: (
    <>
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
      <circle cx="12" cy="10" r="3" />
    </>
  ),
  chevronLeft: <path d="m15 18-6-6 6-6" />,
  chevronRight: <path d="m9 18 6-6-6-6" />,
  chevronDown: <path d="m6 9 6 6 6-6" />,
  smartphone: (
    <>
      <rect width="14" height="20" x="5" y="2" rx="2" ry="2" />
      <path d="M12 18h.01" />
    </>
  ),
  tablet: (
    <>
      <rect width="16" height="20" x="4" y="2" rx="2" ry="2" />
      <line x1="12" x2="12.01" y1="18" y2="18" />
    </>
  ),
  desktop: (
    <>
      <rect width="20" height="14" x="2" y="3" rx="2" />
      <path d="M8 21h8M12 17v4" />
    </>
  ),
  home: (
    <>
      <path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8" />
      <path d="M3 10a2 2 0 0 1 .709-1.528l7-6a2 2 0 0 1 2.582 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    </>
  ),
  calendar: (
    <>
      <path d="M8 2v4" />
      <path d="M16 2v4" />
      <rect width="18" height="18" x="3" y="4" rx="2" />
      <path d="M3 10h18" />
    </>
  ),
  users: (
    <>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </>
  ),
  trash: (
    <>
      <path d="M3 6h18" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </>
  ),
  send: (
    <>
      <path d="M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z" />
      <path d="m21.854 2.147-10.94 10.939" />
    </>
  ),
  sunrise: (
    <>
      <path d="M12 2v8" />
      <path d="m4.93 10.93 1.41 1.41" />
      <path d="M2 18h2" />
      <path d="M20 18h2" />
      <path d="m19.07 10.93-1.41 1.41" />
      <path d="M22 22H2" />
      <path d="m8 6 4-4 4 4" />
      <path d="M16 18a4 4 0 0 0-8 0" />
    </>
  ),
  sunset: (
    <>
      <path d="M12 10V2" />
      <path d="m4.93 10.93 1.41 1.41" />
      <path d="M2 18h2" />
      <path d="M20 18h2" />
      <path d="m19.07 10.93-1.41 1.41" />
      <path d="M22 22H2" />
      <path d="m16 6-4 4-4-4" />
      <path d="M16 18a4 4 0 0 0-8 0" />
    </>
  ),
  heart: (
    <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.29 1.51 4.04 3 5.5l7 7Z" />
  ),
  heartPulse: (
    <>
      <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.29 1.51 4.04 3 5.5l7 7Z" />
      <path d="M3.22 12H9.5l.5-1 2 4.5 2-7 1.5 3.5h5.27" />
    </>
  ),
  moon: <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />,
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
    </>
  ),
  cloud: <path d="M17.5 19a4.5 4.5 0 0 0 0-9h-1.8A7 7 0 1 0 4 15.9" />,
  cloudSun: (
    <>
      <path d="M12 2v2M5.22 5.22l1.42 1.42M2 12h2M20 12h2M18.36 5.64l-1.42 1.42" />
      <path d="M13 22H7a5 5 0 1 1 4.9-6 3.5 3.5 0 0 1 5 3.4" />
      <circle cx="12" cy="9" r="2.5" />
    </>
  ),
  cloudRain: (
    <>
      <path d="M4 14.9A7 7 0 1 1 15.7 8h1.8a4.5 4.5 0 0 1 .5 9" />
      <path d="M8 19v2M12 19v3M16 19v2" />
    </>
  ),
  cloudSnow: (
    <>
      <path d="M4 14.9A7 7 0 1 1 15.7 8h1.8a4.5 4.5 0 0 1 .5 9" />
      <path d="M8 20h.01M12 18h.01M12 22h.01M16 20h.01" />
    </>
  ),
  cloudFog: (
    <>
      <path d="M4 14.9A7 7 0 1 1 15.7 8h1.8a4.5 4.5 0 0 1 .5 9" />
      <path d="M5 18h14M7 22h10" />
    </>
  ),
  cloudLightning: (
    <>
      <path d="M6 16.3A7 7 0 1 1 15.7 8h1.8a4.5 4.5 0 0 1 1.3 8.8" />
      <path d="m13 12-3 5h4l-3 5" />
    </>
  ),
  cross: (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 8v8M8 12h8" />
    </>
  ),
  plus: (
    <>
      <path d="M12 5v14M5 12h14" />
    </>
  ),
  check: <path d="M20 6 9 17l-5-5" />,
  book: (
    <>
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </>
  ),
  minus: <path d="M5 12h14" />,
  x: <path d="M18 6 6 18M6 6l12 12" />,
  terminal: (
    <>
      <polyline points="4 17 10 11 4 5" />
      <line x1="12" x2="20" y1="19" y2="19" />
    </>
  ),
  copy: (
    <>
      <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
      <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
    </>
  ),
  star: (
    <path d="m12 2 3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
  ),
  refresh: (
    <>
      <path d="M21 12a9 9 0 1 1-3-6.7L21 8" />
      <path d="M21 3v5h-5" />
    </>
  ),
  archive: (
    <>
      <rect x="3" y="4" width="18" height="4" rx="1" />
      <path d="M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8" />
      <path d="M10 12h4" />
    </>
  ),
  sparkles: (
    <>
      <path d="M12 3l1.6 4.8L18 9.4l-4.4 1.6L12 16l-1.6-5L6 9.4l4.4-1.6z" />
      <path d="M19 14l.8 2.2L22 17l-2.2.8L19 20l-.8-2.2L16 17l2.2-.8z" />
    </>
  ),
  undo: (
    <>
      <path d="M3 7v6h6" />
      <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" />
    </>
  ),
  coin: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M14.8 9a2.5 2.5 0 0 0-2.3-1.5h-.8a2.2 2.2 0 0 0 0 4.4h1.2a2.2 2.2 0 0 1 0 4.4h-.9A2.5 2.5 0 0 1 9 18.8M12 6v1.5M12 16.5V18" />
    </>
  ),
  bag: (
    <>
      <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
      <path d="M3 6h18" />
      <path d="M16 10a4 4 0 0 1-8 0" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </>
  ),
};
function Ico({ k, size = 18 }: { k: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {ICON[k]}
    </svg>
  );
}

/* ---------- Soin ---------- */
const MOOD_ANIM: Record<PetMood, string> = {
  malade: 'failed',
  fatigue: 'waiting',
  affame: 'waving',
  sale: 'waiting',
  triste: 'failed',
  heureux: 'jumping',
  ok: 'idle',
};
type StatKey = 'satiety' | 'happiness' | 'energy' | 'hygiene' | 'health';
const GAUGES: { key: StatKey; label: string; icon: string }[] = [
  { key: 'satiety', label: 'Faim', icon: 'utensils' },
  { key: 'happiness', label: 'Bonheur', icon: 'smile' },
  { key: 'energy', label: 'Énergie', icon: 'zap' },
  { key: 'hygiene', label: 'Propreté', icon: 'droplet' },
  { key: 'health', label: 'Santé', icon: 'heartPulse' },
];
const ACTIONS: {
  id: string;
  label: string;
  icon: string;
  react: string;
  feedback: string;
  cls: string;
}[] = [
  {
    id: 'feed',
    label: 'Nourrir',
    icon: 'utensils',
    react: 'jumping',
    feedback: 'Miam !',
    cls: 'bg-amber-100 text-amber-700 hover:bg-amber-200',
  },
  {
    id: 'play',
    label: 'Jouer',
    icon: 'smile',
    react: 'jumping',
    feedback: 'Youpi !',
    cls: 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200',
  },
  {
    id: 'sleep',
    label: 'Dormir',
    icon: 'moon',
    react: 'waiting',
    feedback: 'Zzz…',
    cls: 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200',
  },
  {
    id: 'clean',
    label: 'Nettoyer',
    icon: 'droplet',
    react: 'waving',
    feedback: 'Propre !',
    cls: 'bg-cyan-100 text-cyan-700 hover:bg-cyan-200',
  },
  {
    id: 'heal',
    label: 'Soigner',
    icon: 'cross',
    react: 'waving',
    feedback: 'Mieux !',
    cls: 'bg-rose-100 text-rose-700 hover:bg-rose-200',
  },
  {
    id: 'cuddle',
    label: 'Câliner',
    icon: 'heart',
    react: 'jumping',
    feedback: 'Câlin !',
    cls: 'bg-pink-100 text-pink-700 hover:bg-pink-200',
  },
];
const gaugeColor = (v: number) => (v < 25 ? '#ef4444' : v < 50 ? '#f59e0b' : 'var(--color-accent)');

type CareLike = {
  satiety: number;
  happiness: number;
  energy: number;
  hygiene: number;
  health: number;
};
// Repli AVANT réponse backend : état stable dérivé de l'id (FNV-1a) → évite un flash de barres à 0 le temps du fetch.
function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function derivedCareFor(id: string): CareLike {
  const h = hashStr(id);
  const pick = (shift: number, min: number, span: number) =>
    min + (((h >>> shift) & 0xffff) % span);
  return {
    satiety: pick(0, 45, 50),
    happiness: pick(6, 50, 45),
    energy: pick(12, 45, 50),
    hygiene: pick(18, 55, 40),
    health: pick(24, 60, 38),
  };
}

type Pt = { c: number; r: number };
const clampScale = (s: number) => Math.min(2.4, Math.max(0.04, s)); // min très bas → permet de cadrer même une map 256×256

/* ---------- Cycle jour/nuit (teinte du ciel selon l'heure locale) ---------- */
const SKY_STOPS: { h: number; c: [number, number, number]; a: number }[] = [
  { h: 0, c: [16, 20, 54], a: 0.58 }, // nuit profonde
  { h: 5, c: [26, 28, 70], a: 0.5 }, // avant l'aube
  { h: 6.5, c: [255, 150, 92], a: 0.3 }, // aube (chaud)
  { h: 8, c: [255, 224, 178], a: 0.1 }, // matin
  { h: 12, c: [255, 255, 255], a: 0.0 }, // plein jour
  { h: 17, c: [255, 232, 190], a: 0.08 }, // après-midi
  { h: 19, c: [255, 138, 72], a: 0.3 }, // coucher (golden hour)
  { h: 20.5, c: [92, 62, 122], a: 0.42 }, // crépuscule
  { h: 22, c: [18, 22, 58], a: 0.54 }, // nuit
  { h: 24, c: [16, 20, 54], a: 0.58 },
];
/** Couleur d'overlay (rgba) pour l'heure décimale donnée — interpolée entre 2 paliers. */
function skyTint(h: number): string {
  let i = 0;
  while (i < SKY_STOPS.length - 1 && h > SKY_STOPS[i + 1]!.h) i++;
  const a = SKY_STOPS[i]!;
  const b = SKY_STOPS[Math.min(i + 1, SKY_STOPS.length - 1)]!;
  const t = b.h === a.h ? 0 : (h - a.h) / (b.h - a.h);
  const lp = (x: number, y: number) => Math.round(x + (y - x) * t);
  const al = (a.a + (b.a - a.a) * t).toFixed(3);
  return `rgba(${lp(a.c[0], b.c[0])}, ${lp(a.c[1], b.c[1])}, ${lp(a.c[2], b.c[2])}, ${al})`;
}

/* ---------- Météo : couleur d'icône + effets sur la map ---------- */
const WEATHER_COLOR: Record<WeatherCategory, string> = {
  clear: '#f59e0b',
  clouds: '#94a3b8',
  fog: '#94a3b8',
  rain: '#0ea5e9',
  snow: '#7dd3fc',
  storm: '#8b5cf6',
};

/** Dégradé « ciel » immersif pour la popup météo (assez sombre pour un texte blanc lisible). */
function weatherSky(cat: WeatherCategory, isDay: boolean): string {
  const top = !isDay
    ? '#172554'
    : cat === 'clear'
      ? '#2b8fd6'
      : cat === 'rain'
        ? '#3f5266'
        : cat === 'snow'
          ? '#5b7285'
          : cat === 'storm'
            ? '#3b2f6b'
            : cat === 'fog'
              ? '#586474'
              : '#566475'; // clouds
  return `linear-gradient(165deg, ${top} 0%, #131c30 78%, #0b1220 120%)`;
}

/** Pseudo-aléatoire stable : le décor SSR et le premier rendu navigateur doivent être identiques. */
function stableUnit(seed: number): number {
  const value = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return value - Math.floor(value);
}

/** Particules météo au-dessus de la map (pluie / neige / brouillard / orage). */
function WeatherFx({ category }: { category: WeatherCategory }) {
  const drops = useMemo(
    () =>
      Array.from({ length: 70 }, (_, i) => ({
        left: stableUnit(i * 5 + 1) * 100,
        delay: stableUnit(i * 5 + 2) * 1.2,
        dur: 0.5 + stableUnit(i * 5 + 3) * 0.45,
        len: 10 + stableUnit(i * 5 + 4) * 14,
        op: 0.2 + stableUnit(i * 5 + 5) * 0.35,
      })),
    [],
  );
  const flakes = useMemo(
    () =>
      Array.from({ length: 55 }, (_, i) => ({
        left: stableUnit(500 + i * 6 + 1) * 100,
        delay: stableUnit(500 + i * 6 + 2) * 6,
        dur: 5 + stableUnit(500 + i * 6 + 3) * 5,
        size: 3 + stableUnit(500 + i * 6 + 4) * 4,
        drift: (stableUnit(500 + i * 6 + 5) * 2 - 1) * 34,
        op: 0.4 + stableUnit(500 + i * 6 + 6) * 0.5,
      })),
    [],
  );

  if (category === 'clear' || category === 'clouds') return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-[7] overflow-hidden">
      {(category === 'rain' || category === 'storm') &&
        drops.map((d, i) => (
          <span
            key={i}
            className="wx-drop absolute top-0 w-[2px] rounded-full"
            style={{
              left: `${d.left}%`,
              height: d.len,
              opacity: d.op,
              background: 'linear-gradient(to bottom, rgba(186,230,253,0), rgba(125,211,252,0.9))',
              animation: `wx-rain ${d.dur}s linear ${d.delay}s infinite`,
            }}
          />
        ))}
      {category === 'snow' &&
        flakes.map((f, i) => (
          <span
            key={i}
            className="wx-flake absolute top-0 rounded-full bg-white"
            style={
              {
                left: `${f.left}%`,
                width: f.size,
                height: f.size,
                opacity: f.op,
                ['--drift' as string]: `${f.drift}px`,
                animation: `wx-snow ${f.dur}s linear ${f.delay}s infinite`,
              } as React.CSSProperties
            }
          />
        ))}
      {category === 'fog' && (
        <>
          <div
            className="wx-fog absolute inset-x-[-20%] h-40 blur-3xl"
            style={{
              top: '18%',
              background: 'rgba(220,225,235,0.55)',
              animation: 'wx-fog 13s ease-in-out infinite alternate',
            }}
          />
          <div
            className="wx-fog absolute inset-x-[-20%] h-32 blur-3xl"
            style={{
              top: '48%',
              background: 'rgba(210,216,228,0.5)',
              animation: 'wx-fog 17s ease-in-out infinite alternate-reverse',
            }}
          />
          <div
            className="wx-fog absolute inset-x-[-20%] h-40 blur-3xl"
            style={{
              top: '70%',
              background: 'rgba(225,229,238,0.45)',
              animation: 'wx-fog 21s ease-in-out infinite alternate',
            }}
          />
        </>
      )}
      {category === 'storm' && (
        <div
          className="wx-flash absolute inset-0 bg-white"
          style={{ animation: 'wx-flash 6.5s linear infinite' }}
        />
      )}
    </div>
  );
}

/* ---------- Décor derrière la salle : ciel dynamique + soleil/lune + nuages + étoiles ---------- */
const SKY_BG: { h: number; top: [number, number, number]; bot: [number, number, number] }[] = [
  { h: 0, top: [27, 36, 80], bot: [45, 58, 107] },
  { h: 5, top: [38, 48, 94], bot: [58, 74, 122] },
  { h: 6.5, top: [91, 111, 168], bot: [240, 168, 120] },
  { h: 8, top: [143, 182, 224], bot: [223, 238, 251] },
  { h: 12, top: [125, 180, 230], bot: [223, 240, 251] },
  { h: 17, top: [134, 182, 224], bot: [242, 228, 200] },
  { h: 19, top: [91, 111, 168], bot: [240, 154, 106] },
  { h: 20.5, top: [58, 63, 114], bot: [138, 90, 134] },
  { h: 22, top: [30, 37, 80], bot: [45, 58, 107] },
  { h: 24, top: [27, 36, 80], bot: [45, 58, 107] },
];
function skyColors(h: number) {
  let i = 0;
  while (i < SKY_BG.length - 1 && h > SKY_BG[i + 1]!.h) i++;
  const a = SKY_BG[i]!,
    b = SKY_BG[Math.min(i + 1, SKY_BG.length - 1)]!;
  const t = b.h === a.h ? 0 : (h - a.h) / (b.h - a.h);
  const mix = (x: number, y: number) => Math.round(x + (y - x) * t);
  const rgb = (c1: [number, number, number], c2: [number, number, number]) =>
    `rgb(${mix(c1[0], c2[0])},${mix(c1[1], c2[1])},${mix(c1[2], c2[2])})`;
  return { top: rgb(a.top, b.top), bot: rgb(a.bot, b.bot) };
}
type Scene = 'sea' | 'hills' | 'mountains';
function SceneHorizon({ scene }: { scene: Scene }) {
  if (scene === 'hills') {
    return (
      <>
        <div
          className="absolute inset-x-0 bottom-0 h-1/3"
          style={{
            background: 'linear-gradient(to top, rgba(120,175,110,0.55), rgba(120,175,110,0))',
          }}
        />
        <svg
          className="absolute inset-x-0 bottom-0 w-full"
          height="150"
          viewBox="0 0 400 150"
          preserveAspectRatio="none"
        >
          <path
            d="M0 90 Q 60 44 130 78 T 260 72 T 400 82 L400 150 L0 150 Z"
            fill="rgba(110,165,100,0.45)"
          />
          <path d="M0 112 Q 80 74 170 104 T 400 102 L400 150 L0 150 Z" fill="rgba(96,150,88,0.6)" />
        </svg>
      </>
    );
  }
  if (scene === 'sea') {
    return (
      <>
        <div
          className="absolute inset-x-0 bottom-0"
          style={{
            height: '38%',
            background: 'linear-gradient(to bottom, rgba(120,200,214,0.15), rgba(70,150,180,0.6))',
          }}
        />
        <svg
          className="absolute inset-x-0 bottom-0 w-full"
          height="150"
          viewBox="0 0 400 150"
          preserveAspectRatio="none"
        >
          <path d="M0 60 L400 60 L400 150 L0 150 Z" fill="rgba(86,180,196,0.35)" />
          <path
            d="M0 78 Q 40 72 80 78 T 160 78 T 240 78 T 320 78 T 400 78"
            stroke="rgba(255,255,255,0.35)"
            fill="none"
            strokeWidth="2"
          />
          <path
            d="M0 96 Q 50 90 100 96 T 200 96 T 300 96 T 400 96"
            stroke="rgba(255,255,255,0.28)"
            fill="none"
            strokeWidth="2"
          />
          <path
            d="M0 116 Q 45 110 90 116 T 180 116 T 270 116 T 400 116"
            stroke="rgba(255,255,255,0.22)"
            fill="none"
            strokeWidth="2"
          />
        </svg>
      </>
    );
  }
  // mountains (intérieur) : chaîne lointaine bleutée
  return (
    <svg
      className="absolute inset-x-0 bottom-0 w-full"
      height="300"
      viewBox="0 0 400 300"
      preserveAspectRatio="none"
    >
      <path
        d="M0 210 L60 130 L110 195 L170 100 L230 200 L300 140 L360 205 L400 170 L400 300 L0 300 Z"
        fill="rgba(96,112,158,0.32)"
      />
      <path
        d="M0 245 L70 178 L140 236 L210 168 L280 240 L360 182 L400 226 L400 300 L0 300 Z"
        fill="rgba(74,90,138,0.46)"
      />
    </svg>
  );
}
/* Phase de lune réelle (cycle synodique 29,53 j depuis une nouvelle lune de référence). 0 = nouvelle, 0.5 = pleine. */
function moonPhaseFrac(date: Date) {
  const jd = date.getTime() / 86400000 + 2440587.5;
  const p = ((jd - 2451550.1) / 29.530588853) % 1;
  return p < 0 ? p + 1 : p;
}
/* --- Position apparente (altitude & azimut, degrés) du Soleil et de la Lune pour un lieu + instant réels. --- */
const DEG = Math.PI / 180;
function altAz(ha: number, decl: number, lat: number) {
  const latR = lat * DEG;
  const alt = Math.asin(
    Math.sin(latR) * Math.sin(decl) + Math.cos(latR) * Math.cos(decl) * Math.cos(ha),
  );
  let az =
    Math.atan2(Math.sin(ha), Math.cos(ha) * Math.sin(latR) - Math.tan(decl) * Math.cos(latR)) /
      DEG +
    180;
  az = ((az % 360) + 360) % 360; // 0=N, 90=E, 180=S, 270=O
  return { alt: alt / DEG, az };
}
/* Soleil — algo NOAA basse précision (±0,01°). */
function sunAltAz(date: Date, lat: number, lon: number) {
  const n = date.getTime() / 86400000 + 2440587.5 - 2451545.0; // jours depuis J2000
  const L = (280.46 + 0.9856474 * n) % 360;
  const g = (357.528 + 0.9856003 * n) % 360;
  const lambda = (L + 1.915 * Math.sin(g * DEG) + 0.02 * Math.sin(2 * g * DEG)) * DEG;
  const eps = (23.439 - 0.0000004 * n) * DEG;
  const decl = Math.asin(Math.sin(eps) * Math.sin(lambda));
  const ra = Math.atan2(Math.cos(eps) * Math.sin(lambda), Math.cos(lambda));
  const gmst = (18.697374558 + 24.06570982441908 * n) % 24;
  const lst = ((gmst * 15 + lon) % 360) * DEG;
  return altAz(lst - ra, decl, lat);
}
/* Lune — série tronquée (~quelques degrés, suffisant pour le décor). */
function moonAltAz(date: Date, lat: number, lon: number) {
  const d = date.getTime() / 86400000 + 2440587.5 - 2451545.0;
  const L = (218.316 + 13.176396 * d) * DEG;
  const M = (134.963 + 13.064993 * d) * DEG;
  const F = (93.272 + 13.22935 * d) * DEG;
  const lambda = L + 6.289 * DEG * Math.sin(M);
  const beta = 5.128 * DEG * Math.sin(F);
  const eps = 23.439 * DEG;
  const ra = Math.atan2(
    Math.sin(lambda) * Math.cos(eps) - Math.tan(beta) * Math.sin(eps),
    Math.cos(lambda),
  );
  const decl = Math.asin(
    Math.sin(beta) * Math.cos(eps) + Math.cos(beta) * Math.sin(eps) * Math.sin(lambda),
  );
  const gmst = (18.697374558 + 24.06570982441908 * d) % 24;
  const lst = ((gmst * 15 + lon) % 360) * DEG;
  return altAz(lst - ra, decl, lat);
}
/* Projection alt/az → position % sur la voûte : est (az 90) à gauche, sud (180) au centre, ouest (270) à droite. */
function skyProject(alt: number, az: number) {
  const x = 6 + Math.max(0, Math.min(1, (az - 90) / 180)) * 88;
  const y = 90 - Math.max(0, Math.sin(alt * DEG)) * 80;
  return { x, y };
}
/* Contour de la partie ÉCLAIRÉE (hémisphère nord : croissant à droite quand la lune croît). */
function moonLitPath(c: number, R: number, phase: number) {
  const cosr = Math.cos(2 * Math.PI * phase);
  const waxing = phase < 0.5;
  const outer = waxing ? 1 : 0; // demi-disque éclairé (droite si croissante)
  const inner = cosr < 0 ? outer : 1 - outer; // terminateur : gibbeuse (bombe côté éclairé) vs croissant (côté sombre)
  const rx = R * Math.abs(cosr);
  return `M ${c} ${c - R} A ${R} ${R} 0 0 ${outer} ${c} ${c + R} A ${rx} ${R} 0 0 ${inner} ${c} ${c - R} Z`;
}
function MoonSVG({ phase }: { phase: number }) {
  const S = 52,
    R = 22,
    c = S / 2;
  const f = (1 - Math.cos(2 * Math.PI * phase)) / 2; // fraction éclairée
  return (
    <div
      style={{
        filter:
          f > 0.02
            ? `drop-shadow(0 0 ${8 + 18 * f}px rgba(210,222,248,${0.22 + 0.45 * f}))`
            : 'none',
      }}
    >
      <svg width={S} height={S} viewBox={`0 0 ${S} ${S}`}>
        <defs>
          <radialGradient id="moonlit" cx="42%" cy="38%">
            <stop offset="0%" stopColor="#fcfcff" />
            <stop offset="100%" stopColor="#d3dbec" />
          </radialGradient>
        </defs>
        <circle cx={c} cy={c} r={R} fill="#3a4262" />
        {f > 0.006 && <path d={moonLitPath(c, R, phase)} fill="url(#moonlit)" />}
      </svg>
    </div>
  );
}
function RoomBackground({
  hour,
  scene,
  pan,
  date,
  lat,
  lon,
}: {
  hour: number;
  scene: Scene;
  pan: { x: number; y: number };
  date: Date;
  lat: number;
  lon: number;
}) {
  const { top, bot } = skyColors(hour);
  const nf =
    hour < 5 ? 1 : hour < 7 ? (7 - hour) / 2 : hour < 18 ? 0 : hour < 21 ? (hour - 18) / 3 : 1; // 0 jour → 1 nuit
  // Course RÉELLE du soleil et de la lune selon la localisation + l'instant (lever/coucher/altitude vrais).
  const sun = sunAltAz(date, lat, lon);
  const moon = moonAltAz(date, lat, lon);
  const moonPhase = moonPhaseFrac(date);
  const sunPos = skyProject(sun.alt, sun.az);
  const moonPos = skyProject(moon.alt, moon.az);
  const day = nf < 0.5;
  const stars = useMemo(
    () =>
      Array.from({ length: 40 }, (_, i) => ({
        x: stableUnit(1000 + i * 5 + 1) * 100,
        y: stableUnit(1000 + i * 5 + 2) * 62,
        s: 1 + stableUnit(1000 + i * 5 + 3) * 1.8,
        o: 0.4 + stableUnit(1000 + i * 5 + 4) * 0.6,
        d: stableUnit(1000 + i * 5 + 5) * 3,
      })),
    [],
  );
  const clouds = useMemo(
    () =>
      Array.from({ length: 5 }, (_, i) => ({
        top: 8 + stableUnit(2000 + i * 5 + 1) * 42,
        scale: 0.7 + stableUnit(2000 + i * 5 + 2) * 0.9,
        dur: 70 + stableUnit(2000 + i * 5 + 3) * 80,
        delay: -stableUnit(2000 + i * 5 + 4) * 120,
        op: 0.55 + stableUnit(2000 + i * 5 + 5) * 0.4,
      })),
    [],
  );
  const birds = useMemo(
    () =>
      Array.from({ length: 5 }, (_, i) => ({
        top: 12 + stableUnit(3000 + i * 5 + 1) * 32,
        dur: 26 + stableUnit(3000 + i * 5 + 2) * 30,
        delay: -stableUnit(3000 + i * 5 + 3) * 50,
        scale: 0.7 + stableUnit(3000 + i * 5 + 4) * 0.7,
        bob: 2 + stableUnit(3000 + i * 5 + 5) * 2,
      })),
    [],
  );
  const flies = useMemo(
    () =>
      Array.from({ length: 18 }, (_, i) => ({
        x: stableUnit(4000 + i * 6 + 1) * 100,
        y: 42 + stableUnit(4000 + i * 6 + 2) * 46,
        dur: 6 + stableUnit(4000 + i * 6 + 3) * 8,
        delay: -stableUnit(4000 + i * 6 + 4) * 10,
        dx: (stableUnit(4000 + i * 6 + 5) * 2 - 1) * 46,
        dy: (stableUnit(4000 + i * 6 + 6) * 2 - 1) * 34,
      })),
    [],
  );
  const par = (f: number) => `translate(${pan.x * f}px, ${pan.y * f}px)`;
  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden"
      style={{ background: `linear-gradient(to bottom, ${top}, ${bot})` }}
    >
      <style>{`@keyframes bgcloud{from{left:-30%}to{left:130%}}@keyframes bgtw{0%,100%{opacity:1}50%{opacity:.25}}@keyframes bgbird{from{left:-12%}to{left:112%}}@keyframes bgbob{0%,100%{transform:translateY(0)}50%{transform:translateY(-7px)}}@keyframes bgfly{0%{transform:translate(0,0);opacity:.15}50%{opacity:1}100%{transform:translate(var(--dx),var(--dy));opacity:.15}}`}</style>
      {/* étoiles */}
      {nf > 0.04 && (
        <div className="absolute inset-0" style={{ transform: par(0.03) }}>
          {stars.map((st, i) => (
            <span
              key={i}
              className="absolute rounded-full bg-white"
              style={{
                left: `${st.x}%`,
                top: `${st.y}%`,
                width: st.s,
                height: st.s,
                opacity: st.o * nf,
                animation: `bgtw ${2.5 + st.d}s ease-in-out ${st.d}s infinite`,
              }}
            />
          ))}
        </div>
      )}
      {/* soleil & lune — chacun visible seulement au-dessus de l'horizon (les deux peuvent coexister) */}
      <div className="absolute inset-0" style={{ transform: par(0.05) }}>
        {moon.alt > 0 && (
          <div
            className="absolute"
            style={{
              left: `${moonPos.x}%`,
              top: `${moonPos.y}%`,
              transform: 'translate(-50%,-50%)',
              opacity: day ? 0.5 : 1,
            }}
          >
            <MoonSVG phase={moonPhase} />
          </div>
        )}
        {sun.alt > -0.8 && (
          <div
            className="absolute rounded-full"
            style={{
              left: `${sunPos.x}%`,
              top: `${sunPos.y}%`,
              width: 60,
              height: 60,
              transform: 'translate(-50%,-50%)',
              background: 'radial-gradient(circle at 40% 40%, #fff6d0, #ffd873)',
              boxShadow: '0 0 46px 16px rgba(255,214,110,0.5)',
            }}
          />
        )}
      </div>
      {/* décor de fond (mer / collines / montagnes) */}
      <div className="absolute inset-0" style={{ transform: par(0.1), opacity: 1 - nf * 0.4 }}>
        <SceneHorizon scene={scene} />
      </div>
      {/* nuages */}
      <div className="absolute inset-0" style={{ transform: par(0.16) }}>
        {clouds.map((c, i) => (
          <div
            key={i}
            className="absolute"
            style={{
              top: `${c.top}%`,
              opacity: c.op * (1 - nf * 0.75),
              animation: `bgcloud ${c.dur}s linear ${c.delay}s infinite`,
            }}
          >
            <div
              className="relative"
              style={{
                width: 70,
                height: 26,
                transform: `scale(${c.scale})`,
                filter: 'blur(0.6px)',
              }}
            >
              <span
                className="absolute rounded-full bg-white"
                style={{ width: 34, height: 34, left: 0, top: -6 }}
              />
              <span
                className="absolute rounded-full bg-white"
                style={{ width: 46, height: 46, left: 18, top: -16 }}
              />
              <span
                className="absolute rounded-full bg-white"
                style={{ width: 32, height: 32, left: 46, top: -4 }}
              />
              <span
                className="absolute rounded-full bg-white"
                style={{ width: 72, height: 22, left: 2, top: 4 }}
              />
            </div>
          </div>
        ))}
      </div>
      {/* oiseaux (jour) / lucioles (nuit) */}
      <div className="absolute inset-0" style={{ transform: par(0.13) }}>
        {day
          ? birds.map((b, i) => (
              <div
                key={i}
                className="absolute"
                style={{
                  top: `${b.top}%`,
                  animation: `bgbird ${b.dur}s linear ${b.delay}s infinite`,
                }}
              >
                <div
                  style={{
                    animation: `bgbob ${1.4 + b.bob}s ease-in-out infinite`,
                    transform: `scale(${b.scale})`,
                    opacity: 0.6,
                  }}
                >
                  <svg width="20" height="9" viewBox="0 0 20 9" fill="none">
                    <path
                      d="M1 7 Q5.5 1 10 6 Q14.5 1 19 7"
                      stroke="#4a4a55"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
              </div>
            ))
          : nf > 0.55 &&
            flies.map((f, i) => (
              <span
                key={i}
                className="absolute rounded-full"
                style={
                  {
                    left: `${f.x}%`,
                    top: `${f.y}%`,
                    width: 4,
                    height: 4,
                    background: '#f4e58a',
                    boxShadow: '0 0 8px 2px rgba(244,229,138,0.8)',
                    ['--dx' as string]: `${f.dx}px`,
                    ['--dy' as string]: `${f.dy}px`,
                    animation: `bgfly ${f.dur}s ease-in-out ${f.delay}s infinite`,
                  } as React.CSSProperties
                }
              />
            ))}
      </div>
    </div>
  );
}

export function CompanionRoom() {
  const petUrl = useCompanionPet((s) => s.url);
  const name = useCompanionPet((s) => s.companionName);

  // Heure locale RÉELLE + météo RÉELLE (géolocalisation).
  const weather = useLocalWeather();
  const { profileId } = useProfile();
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);
  const hourFrac = now ? now.getHours() + now.getMinutes() / 60 + now.getSeconds() / 3600 : 12;

  const [room, setRoom] = useState('chambre');
  const [roomMenu, setRoomMenu] = useState<string | null>(null); // type de salle dont le menu déroulant est ouvert
  const gridRef = useRef({ cols: COLS, rows: ROWS }); // taille de grille courante (lue par la boucle physique)
  const boardRef = useRef<HTMLDivElement | null>(null); // plateau (pour recentrer la caméra en open-space)
  const floorCanvasRef = useRef<HTMLCanvasElement | null>(null); // sol + murs des GRANDES maps (canvas optimisé)
  const viewportRef = useRef<HTMLDivElement | null>(null); // conteneur visible (pour ajuster la caméra)
  const boardDimRef = useRef({ w: 0, h: 0 }); // dimensions du plateau courant (maj au rendu)
  // Meubles PAR pièce : { [idPièce]: RoomItem[] }. Chaque pièce garde sa propre déco.
  const [roomsMap, setRoomsMap] = useState<Record<string, RoomItem[]>>({});
  const rawItems = roomsMap[room] ?? [];
  // La liste persistée ne contient plus que des marqueurs de matériau « ~ft:/~wl:/~wr:/~floor:/~wall: ».
  const [edit, setEdit] = useState(false);
  const [selected, setSelected] = useState(FLOOR_MATS[0]?.id ?? '');
  const [pos, setPos] = useState<Pt>({ c: 3, r: 4 });
  const [facing, setFacing] = useState<'right' | 'left'>('right');
  const [moving, setMoving] = useState(false);
  const [transition, setTransition] = useState<'idle' | 'exit' | 'enter'>('idle');
  const [pendingRoom, setPendingRoom] = useState<string | null>(null);
  const [fade, setFade] = useState(false);
  const onArriveRef = useRef<() => void>(() => {});
  const hourlyRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [weatherOpen, setWeatherOpen] = useState(false);
  const [clockOpen, setClockOpen] = useState(false);
  const [calView, setCalView] = useState(() => {
    const d = new Date();
    return { y: d.getFullYear(), m: d.getMonth() };
  });
  const [selDay, setSelDay] = useState<Date>(() => new Date());
  const [schedule, setSchedule] = useState<ScheduleView | null>(null);
  const [shopOpen, setShopOpen] = useState(false);
  const [shopCat, setShopCat] = useState<'sols' | 'murs' | 'meubles'>('sols');
  const [shopFurnCat, setShopFurnCat] = useState<string>('all'); // sous-catégorie de meubles dans la Boutique
  const [invQuery, setInvQuery] = useState(''); // recherche dans l'inventaire
  const [buyQty, setBuyQty] = useState(1); // quantité d'unités achetées d'un coup en Boutique
  const [buying, setBuying] = useState<string | null>(null);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const panDrag = useRef<{ sx: number; sy: number; ox: number; oy: number } | null>(null);
  const [care, setCare] = useState<PetCareState | null>(null);
  // Care PERSISTÉ par compagnon (backend) : jauges réelles des agents de l'espace courant (hors principal).
  const [secCare, setSecCare] = useState<Record<string, CareLike>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [reaction, setReaction] = useState<string | null>(null);
  const [fx, setFx] = useState<{ text: string; id: number } | null>(null);
  const [speech, setSpeech] = useState<string | null>(null);
  const [autoAnim, setAutoAnim] = useState<string | null>(null); // anim autonome (dort, salue…)
  const fxId = useRef(0);
  const speechTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const posRef = useRef<Pt>({ c: 3, r: 4 });
  // Famille de compagnons (Maison) : le principal reste le pet existant ; les autres sont des sprites secondaires.
  const [family, setFamily] = useState<CompanionAgent[]>([]);
  const [operationalStates, setOperationalStates] = useState<Record<string, HiveCompanionState>>(
    {},
  );
  const secPhysRef = useRef<Record<string, SecPhys>>({});
  const [secs, setSecs] = useState<SecRender[]>([]);
  const [followId, setFollowId] = useState<string | null>(null); // compagnon sélectionné (clic) qui te suit de salle en salle
  const [familyOpen, setFamilyOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newSkin, setNewSkin] = useState(CURATED_PETS[1]?.slug ?? 'aiso-feather');
  const [newTraits, setNewTraits] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const [createMode, setCreateMode] = useState<'pnj' | 'ia'>('pnj');
  const [iaDesc, setIaDesc] = useState('');
  const [iaBusy, setIaBusy] = useState(false);
  const [iaErr, setIaErr] = useState<string | null>(null);
  const [chatText, setChatText] = useState('');
  const [spaces, setSpaces] = useState<CompanionSpace[]>([]);
  const [activeSpace, setActiveSpace] = useState('home'); // 'home' (Maison) | id d'open-space
  const [spacesMenuOpen, setSpacesMenuOpen] = useState(false);
  // Création d'un open-space typé : on choisit un modèle d'organisation (entreprise/SaaS/école) qui seede l'effectif d'agents.
  const [orgPicker, setOrgPicker] = useState(false);
  const [orgTemplates, setOrgTemplates] = useState<OrgTemplate[]>([]);
  const [orgName, setOrgName] = useState('');
  const [orgTpl, setOrgTpl] = useState('startup-saas');
  const [orgBusy, setOrgBusy] = useState(false);
  // P3 — base de connaissances de l'organisation (open-space) : les agents la consultent (RAG scopé).
  const [knowOpen, setKnowOpen] = useState(false);
  const [knowList, setKnowList] = useState<SpaceKnowledge[]>([]);
  const [knowTitle, setKnowTitle] = useState('');
  const [knowContent, setKnowContent] = useState('');
  const [knowBusy, setKnowBusy] = useState(false);
  // P4 — chantier (SOP) : donner un objectif à l'organisation → livrable assemblé + archivé.
  const [projOpen, setProjOpen] = useState(false);
  const [projGoal, setProjGoal] = useState('');
  const [projBusy, setProjBusy] = useState(false);
  const [projResult, setProjResult] = useState<ProjectResult | null>(null);
  // Believabilité : rassemblement des membres autour du leader pendant un échange d'organisation.
  const [gather, setGather] = useState<{ leaderId: string; memberIds: string[] } | null>(null);
  const gatherTimer = useRef<number | null>(null);
  const [device, setDevice] = useState<'phone' | 'tablet' | 'desktop' | null>(null);
  const [initialDeviceApp, setInitialDeviceApp] = useState<string | undefined>();
  useEffect(() => {
    const requestedApp = new URLSearchParams(window.location.search).get('app');
    if (requestedApp) {
      setInitialDeviceApp(requestedApp);
      setDevice('desktop');
    }
  }, []);
  const [relayToken, setRelayToken] = useState<string | null>(null); // jeton MCP montré une fois
  const [relayBusy, setRelayBusy] = useState(false);
  const [relayCopied, setRelayCopied] = useState(false);
  const [hiveBusy, setHiveBusy] = useState(false);
  const [hiveReport, setHiveReport] = useState<HiveMaintainReport | null>(null);
  const [beeBusy, setBeeBusy] = useState<string | null>(null); // id de l'abeille en cours d'action
  const isHome = activeSpace === 'home';
  const target = useRef<Pt | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  // Cerveau autonome : prochaine décision, dernière réplique, snapshot d'état lu par le timer.
  const autoNextAt = useRef(0);
  const lastLine = useRef<string[]>([]); // 6 dernières répliques (anti-répétition)
  const brainRef = useRef<{ ctx: BrainCtx | null; blocked: boolean; items: RoomItem[] }>({
    ctx: null,
    blocked: false,
    items: [],
  });

  // Planning : chargé (une fois) à la 1re ouverture de la popup calendrier.
  useEffect(() => {
    if (clockOpen && profileId && !schedule)
      getSchedule(profileId)
        .then(setSchedule)
        .catch(() => {});
  }, [clockOpen, profileId, schedule]);

  // Météo heure par heure : molette verticale → défilement horizontal (sans scroller le reste).
  useEffect(() => {
    const el = hourlyRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      const d = Math.abs(e.deltaY) > Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
      if (!d) return;
      e.preventDefault();
      el.scrollLeft += d;
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [weatherOpen]);

  // Chargements
  useEffect(() => {
    getPetRoom()
      .then((r) => {
        setRoom(r.room in ROOMS ? r.room : 'chambre');
        setRoomsMap(r.rooms ?? {});
      })
      .catch(() => {});
  }, []);
  // Au changement d'espace, on se place dans la salle par défaut : Maison → chambre ; open-space → 1er workspace.
  useEffect(() => {
    setRoomMenu(null);
    setRoom(activeSpace === 'home' ? 'chambre' : 'travail:0');
  }, [activeSpace]);
  useEffect(() => {
    const load = () =>
      getPetCare()
        .then(setCare)
        .catch(() => {});
    load();
    const id = window.setInterval(load, 60_000);
    return () => window.clearInterval(id);
  }, []);
  // Care PERSISTÉ des compagnons de l'espace (backend) : chargé au changement d'espace + rafraîchi (décroissance).
  useEffect(() => {
    const load = () =>
      getSpaceCare(activeSpace)
        .then((list) =>
          setSecCare(
            Object.fromEntries(
              list.map((c) => [
                c.agentId,
                {
                  satiety: c.satiety,
                  happiness: c.happiness,
                  energy: c.energy,
                  hygiene: c.hygiene,
                  health: c.health,
                },
              ]),
            ),
          ),
        )
        .catch(() => {});
    load();
    const id = window.setInterval(load, 60_000);
    return () => window.clearInterval(id);
  }, [activeSpace, family.length]);

  const save = useCallback((nextRoom: string, nextMap: Record<string, RoomItem[]>) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      setPetRoom(nextRoom, nextMap).catch(() => {});
    }, 700);
  }, []);

  // Met à jour les meubles de la pièce COURANTE (map par pièce) puis persiste.
  const updateItems = useCallback(
    (nextItems: RoomItem[]) => {
      setRoomsMap((prev) => {
        const next = { ...prev, [room]: nextItems };
        save(room, next);
        return next;
      });
    },
    [room, save],
  );

  // Boucle de déplacement
  useEffect(() => {
    let raf = 0;
    let last = 0;
    const loop = (t: number) => {
      const dt = last ? Math.min(0.05, (t - last) / 1000) : 0;
      last = t;
      const tgt = target.current;
      if (tgt) {
        const p = posRef.current;
        const dc = tgt.c - p.c,
          dr = tgt.r - p.r;
        const dist = Math.hypot(dc, dr);
        if (dist < 0.06) {
          posRef.current = { ...tgt };
          target.current = null;
          setPos({ ...tgt });
          onArriveRef.current();
        } else {
          const step = Math.min(dist, 3.4 * dt);
          posRef.current = { c: p.c + (dc / dist) * step, r: p.r + (dr / dist) * step };
          setPos({ ...posRef.current });
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  // Charge la famille (compagnons de la Maison). Le principal reste le pet existant ; on rend les autres.
  const loadFamily = useCallback(async () => {
    try {
      const list = await getCompanionAgents(activeSpace);
      setFamily(list);
      // Le relais (« Claude Code ») n'est pas un personnage qui déambule : il ne vit que dans le téléphone.
      const others = list.filter((a) => !a.isPrimary && a.mode !== 'relay');
      const prev = secPhysRef.current;
      const phys: Record<string, SecPhys> = {};
      others.forEach((a, i) => {
        const ex = prev[a.id];
        const start = ex
          ? { c: ex.c, r: ex.r }
          : (a.pos ?? { c: 1 + (i % 6), r: 1 + Math.floor(i / 6) });
        phys[a.id] = {
          name: a.name,
          personality: a.personality,
          c: start.c,
          r: start.r,
          tc: ex?.tc ?? null,
          tr: ex?.tr ?? null,
          facing: ex?.facing ?? 'right',
          nextAt: ex?.nextAt ?? 0,
          sayAt: ex?.sayAt ?? -1,
          speech: ex?.speech ?? null,
          speechUntil: ex?.speechUntil ?? 0,
        };
      });
      secPhysRef.current = phys;
      setSecs(
        others.map((a) => ({
          id: a.id,
          name: a.name,
          skinUrl: a.skinUrl,
          size: a.size,
          room: a.room,
          c: phys[a.id]!.c,
          r: phys[a.id]!.r,
          facing: phys[a.id]!.facing,
          moving: false,
          speech: phys[a.id]!.speech,
        })),
      );
    } catch {
      /* ignore */
    }
  }, [activeSpace]);
  useEffect(() => {
    void loadFamily();
  }, [loadFamily]);
  useEffect(() => {
    let active = true;
    const refresh = () =>
      getHiveCompanionStates()
        .then((states) => {
          if (!active) return;
          setOperationalStates(Object.fromEntries(states.map((state) => [state.agentId, state])));
        })
        .catch(() => undefined);
    void refresh();
    const timer = window.setInterval(refresh, 5000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);
  useEffect(() => {
    const now = performance.now();
    for (const [id, state] of Object.entries(operationalStates)) {
      const physical = secPhysRef.current[id];
      if (!physical || state.availability !== 'busy') continue;
      physical.tc = null;
      physical.tr = null;
      physical.speech = state.activity;
      physical.speechUntil = now + 5500;
    }
  }, [operationalStates]);
  // Provisionne (idempotent) l'école du service Académie selon le rang, PUIS charge les espaces
  // → l'open-space « École Dowze » et ses profs apparaissent automatiquement dans le menu.
  useEffect(() => {
    ensureServiceOrg('academie')
      .catch(() => {})
      .finally(() => {
        getCompanionSpaces()
          .then(setSpaces)
          .catch(() => {});
      });
  }, []);

  // Animation des compagnons secondaires : déambulation douce + répliques PNJ.
  useEffect(() => {
    let raf = 0;
    let last = 0;
    const loop = (t: number) => {
      const dt = last ? Math.min(0.05, (t - last) / 1000) : 0;
      last = t;
      const phys = secPhysRef.current;
      let changed = false;
      for (const id in phys) {
        const s = phys[id]!;
        if (s.sayAt < 0) s.sayAt = t + 5000 + Math.random() * 9000;
        if (s.speech && t >= s.speechUntil) {
          s.speech = null;
          changed = true;
        }
        if (s.tc == null) {
          if (t >= s.nextAt) {
            const nc = Math.floor(Math.random() * gridRef.current.cols),
              nr = Math.floor(Math.random() * gridRef.current.rows);
            s.tc = nc;
            s.tr = nr;
            s.facing = nc - nr - (s.c - s.r) >= 0 ? 'right' : 'left';
          }
        } else {
          const dc = s.tc - s.c,
            dr = (s.tr ?? s.r) - s.r;
          const d = Math.hypot(dc, dr) || 1;
          if (d < 0.06) {
            s.c = s.tc;
            s.r = s.tr ?? s.r;
            s.tc = null;
            s.tr = null;
            s.nextAt = t + 2500 + Math.random() * 6000;
            changed = true;
          } else {
            const step = Math.min(d, 2.6 * dt);
            s.c += (dc / d) * step;
            s.r += (dr / d) * step;
            changed = true;
          }
        }
        if (!s.speech && t >= s.sayAt) {
          s.speech = personaLine(s.personality, s.name);
          s.speechUntil = t + 3500;
          s.sayAt = t + 14000 + Math.random() * 14000;
          changed = true;
        }
      }
      if (changed)
        setSecs((prev) =>
          prev.map((sr) => {
            const s = phys[sr.id];
            return s
              ? { ...sr, c: s.c, r: s.r, facing: s.facing, moving: s.tc != null, speech: s.speech }
              : sr;
          }),
        );
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  // Affiche une bulle sur un secondaire (texte donné, PNJ ou réponse IA).
  const saySec = useCallback((id: string, text: string, holdMs = 4000) => {
    const s = secPhysRef.current[id];
    if (!s) return;
    const nowMs = performance.now();
    s.speech = text;
    s.speechUntil = nowMs + holdMs;
    s.sayAt = nowMs + 14000 + Math.random() * 14000;
    setSecs((prev) => prev.map((sr) => (sr.id === id ? { ...sr, speech: text } : sr)));
  }, []);

  // Clic gauche sur un compagnon → le sélectionne (il te suit) ; re-clic → désélectionne.
  const toggleFollow = useCallback(
    (id: string) => {
      setFollowId((cur) => {
        if (cur === id) return null;
        const s = secPhysRef.current[id];
        if (s) saySec(id, personaLine(s.personality, s.name), 2500); // petit salut à la sélection
        return id;
      });
    },
    [saySec],
  );
  // Nettoyage : si le suivi disparaît (supprimé / changement d'espace), on désélectionne.
  // Le compagnon PRINCIPAL n'est jamais dans `secs` (c'est le pet) → on le garde, sinon sa fiche clignote.
  useEffect(() => {
    if (!followId) return;
    const inSecs = secs.some((s) => s.id === followId);
    const isPrincipal = family.some((a) => a.isPrimary && a.id === followId);
    if (!inSecs && !isPrincipal) setFollowId(null);
  }, [secs, family, followId]);
  // Quand TU changes de salle, le compagnon suivi « entre » : il apparaît à la porte (coin avant) et marche vers le centre.
  useEffect(() => {
    if (!followId) return;
    const s = secPhysRef.current[followId];
    if (!s) return;
    const g = gridRef.current;
    s.c = Math.max(0, g.cols - 1);
    s.r = Math.max(0, g.rows - 1);
    s.tc = Math.floor(g.cols / 2);
    s.tr = Math.floor(g.rows / 2);
    s.facing = 'left';
    setSecs((prev) =>
      prev.map((sr) =>
        sr.id === followId ? { ...sr, c: s.c, r: s.r, facing: 'left', moving: true } : sr,
      ),
    );
  }, [room, followId]);

  // Ajoute un compagnon à la famille (Maison, mode PNJ).
  const addCompanion = useCallback(async () => {
    const nm = newName.trim();
    if (!nm) return;
    setCreating(true);
    try {
      await createCompanionAgent({
        name: nm.slice(0, 40),
        skinUrl: curatedSheetUrl(newSkin),
        personality: newTraits.length ? { traits: newTraits } : null,
        space: activeSpace,
      });
      setNewName('');
      setNewTraits([]);
      await loadFamily();
    } catch {
      /* réseau / limite */
    } finally {
      setCreating(false);
    }
  }, [newName, newSkin, newTraits, activeSpace, loadFamily]);

  const removeCompanion = useCallback(
    async (id: string) => {
      try {
        await deleteCompanionAgent(id);
        await loadFamily();
      } catch {
        /* protégé / réseau */
      }
    },
    [loadFamily],
  );

  // Jardinage de la ruche : nettoyage (dedup → fusion → prune).
  const runMaintain = useCallback(async () => {
    setHiveBusy(true);
    setHiveReport(null);
    try {
      setHiveReport(await maintainHive());
      await loadFamily();
    } catch {
      /* réseau */
    } finally {
      setHiveBusy(false);
    }
  }, [loadFamily]);
  const retrainBee = useCallback(
    async (id: string) => {
      setBeeBusy(id);
      try {
        await retrainCompanionAgent(id);
        await loadFamily();
      } catch {
        /* */
      } finally {
        setBeeBusy(null);
      }
    },
    [loadFamily],
  );
  const revertBee = useCallback(
    async (id: string) => {
      setBeeBusy(id);
      try {
        await revertCompanionAgentPrompt(id);
        await loadFamily();
      } catch {
        /* */
      } finally {
        setBeeBusy(null);
      }
    },
    [loadFamily],
  );
  const retireBee = useCallback(
    async (id: string) => {
      setBeeBusy(id);
      try {
        await retireCompanionAgent(id);
        await loadFamily();
      } catch {
        /* */
      } finally {
        setBeeBusy(null);
      }
    },
    [loadFamily],
  );
  const toggleProtect = useCallback(
    async (id: string, next: boolean) => {
      setBeeBusy(id);
      try {
        await protectCompanionAgent(id, next);
        await loadFamily();
      } catch {
        /* */
      } finally {
        setBeeBusy(null);
      }
    },
    [loadFamily],
  );

  // Relais : génère un jeton MCP pour connecter SON Claude Code / Codex.
  const genRelayToken = useCallback(async () => {
    setRelayBusy(true);
    setRelayCopied(false);
    try {
      const { token } = await createRelayToken();
      setRelayToken(token);
      await loadFamily(); // fait apparaître le fil « Claude Code » dans le téléphone
    } catch {
      /* réseau */
    } finally {
      setRelayBusy(false);
    }
  }, [loadFamily]);

  // Crée un compagnon-AGENT via l'IA (Dowze construit la config depuis une phrase).
  const addCompanionAI = useCallback(async () => {
    const d = iaDesc.trim();
    if (!d) return;
    setIaBusy(true);
    setIaErr(null);
    try {
      await buildCompanionAgent(d, curatedSheetUrl(newSkin), activeSpace);
      setIaDesc('');
      await loadFamily();
    } catch (e) {
      const msg = e instanceof Error ? e.message : '';
      setIaErr(
        /clé|byok|crédits|disponible|Service Unavailable|503/i.test(msg)
          ? 'Configure une clé IA (réglages du Copilote) pour créer un compagnon IA.'
          : 'Création IA impossible pour l’instant, réessaie.',
      );
    } finally {
      setIaBusy(false);
    }
  }, [iaDesc, newSkin, activeSpace, loadFamily]);

  function onTile(c: number, r: number) {
    if (transition !== 'idle') return; // pas de déplacement pendant un changement de pièce
    if (edit) {
      if (erasing)
        eraseTile(c, r); // gomme : meuble puis sol
      else if (brushKind === 'furniture')
        placeFurniture(c, r); // pose un meuble
      else if (brushKind === 'floor') paintFloorTile(c, r); // pinceau sol (les murs se peignent sur leurs faces)
      return;
    } else {
      // Déplacement manuel : reprend la main sur l'autonomie un instant.
      setAutoAnim(null);
      autoNextAt.current = Date.now() + 4000;
      setFacing(c - r - (posRef.current.c - posRef.current.r) >= 0 ? 'right' : 'left');
      target.current = { c, r };
      setMoving(true);
    }
  }
  // Rejoué à chaque rendu (closures fraîches) : appelé par la boucle quand le compagnon arrive.
  onArriveRef.current = () => {
    setMoving(false);
    if (transition === 'exit') {
      setFade(true); // fondu de sortie
      window.setTimeout(() => {
        const nr = pendingRoom ?? room;
        setRoom(nr);
        save(nr, roomsMap); // la pièce courante change ; les meubles par pièce restent inchangés

        posRef.current = { ...DOOR };
        setPos({ ...DOOR });
        setFacing(DOOR.c - DOOR.r - (REST.c - REST.r) >= 0 ? 'right' : 'left');
        setFade(false); // fondu d'entrée
        setPendingRoom(null);
        setTransition('enter');
        target.current = { ...REST };
        setMoving(true);
      }, 300);
    } else if (transition === 'enter') {
      setTransition('idle');
    }
  };

  // Clic droit maintenu = déplacer la vue (pan).
  function startPan(e: React.PointerEvent) {
    if (e.button !== 2) return;
    panDrag.current = { sx: e.clientX, sy: e.clientY, ox: pan.x, oy: pan.y };
    const move = (ev: PointerEvent) => {
      const d = panDrag.current;
      if (!d) return;
      setPan({ x: d.ox + (ev.clientX - d.sx), y: d.oy + (ev.clientY - d.sy) });
    };
    const up = () => {
      panDrag.current = null;
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }

  // Le compagnon parle (au clic) : une réplique selon son état, sinon aléatoire.
  // Affiche une bulle (réplique instantanée, sans IA). Utilisé au clic ET en autonomie.
  const say = useCallback((line: string) => {
    lastLine.current = [line, ...lastLine.current].slice(0, 6);
    setSpeech(line);
    if (speechTimer.current) clearTimeout(speechTimer.current);
    speechTimer.current = setTimeout(() => setSpeech(null), 3500);
  }, []);

  function talk() {
    // Réveille + laisse la main à l'utilisateur un instant avant que l'autonomie reprenne.
    setAutoAnim(null);
    autoNextAt.current = Date.now() + 4000;
    const ctx = brainRef.current.ctx;
    say(ctx ? pickLine(ctx, lastLine.current) : 'Coucou !');
  }

  // Chat direct : parle à tous les compagnons de la pièce (ou à un seul avec « /nom … »).
  const sendChat = useCallback(() => {
    const raw = chatText.trim();
    if (!raw) return;
    setChatText('');
    let targetName: string | null = null;
    let msg = raw;
    const mt = raw.match(/^\/(\S+)\s*([\s\S]*)$/);
    if (mt) {
      targetName = mt[1]!.toLowerCase();
      msg = (mt[2] || '').trim();
    }
    // ORGANISATION (open-space école/entreprise) + message NON ciblé → le LEADER délègue au bon rôle.
    const activeSpaceType = spaces.find((s) => s.id === activeSpace)?.type;
    if (
      !isHome &&
      !targetName &&
      activeSpaceType &&
      ['school', 'company', 'saas'].includes(activeSpaceType)
    ) {
      // Indicateur « … » sur le leader (1er membre seedé = Directeur/CEO) pendant qu'il réfléchit.
      const leadGuess = secs[0];
      if (leadGuess) saySec(leadGuess.id, '…', 15000);
      orchestrateSpace(activeSpace, msg || raw)
        .then((r) => {
          // Believabilité : le leader et les membres mobilisés se rassemblent (le hand-off se voit).
          const involved = [
            ...new Set([...r.delegates.map((d) => d.id), ...(r.qa ? [r.qa.id] : [])]),
          ];
          if (involved.length) {
            setGather({ leaderId: r.leadId, memberIds: involved });
            if (gatherTimer.current) window.clearTimeout(gatherTimer.current);
          }
          r.delegates.forEach((d, i) =>
            window.setTimeout(() => saySec(d.id, d.said, 7000), i * 300),
          );
          let t = r.delegates.length * 300 + 200;
          // L'Évaluateur (QA) affiche son verdict entre l'équipe et la synthèse du leader.
          if (r.qa) {
            const note = r.qa.ok ? r.qa.note || 'Validé.' : `À corriger : ${r.qa.note}`;
            window.setTimeout(() => saySec(r.qa!.id, note, 7000), t);
            t += 900;
          }
          window.setTimeout(() => saySec(r.leadId, r.reply, 9000), t);
          // Fin de réunion → chacun repart (après la synthèse du leader).
          if (involved.length)
            gatherTimer.current = window.setTimeout(() => setGather(null), t + 9000);
        })
        .catch(() => {
          const lead = secs[0];
          if (lead) saySec(lead.id, 'Configure une clé IA pour que l’équipe réponde');
        });
      return;
    }
    const primaryAgent = family.find((a) => a.isPrimary);
    const modeOf = (id: string) => family.find((a) => a.id === id)?.mode;
    const speakers: {
      id: string;
      name: string;
      personality: AgentPersonality | null;
      mode?: string;
    }[] = [
      ...(isHome
        ? [
            {
              id: 'primary',
              name: primaryAgent?.name || name || 'Dowze',
              personality: primaryAgent?.personality ?? null,
              mode: 'pnj',
            },
          ]
        : []),
      ...secs.map((s) => ({
        id: s.id,
        name: s.name,
        personality: secPhysRef.current[s.id]?.personality ?? null,
        mode: modeOf(s.id),
      })),
    ];
    const matched = targetName
      ? speakers.filter((s) => s.name.toLowerCase().startsWith(targetName!))
      : speakers;
    const list = matched.length ? matched : speakers;
    list.forEach((sp, i) => {
      // Compagnon-AGENT : vraie réponse IA (bulle « … » pendant la réflexion), comme dans le téléphone.
      if (sp.mode === 'agent' && sp.id !== 'primary') {
        saySec(sp.id, '…', 30000);
        chatCompanionAgent(sp.id, msg || raw)
          .then((r) => saySec(sp.id, r.reply, 6000))
          .catch(() => saySec(sp.id, 'Configure une clé IA pour que je réfléchisse 🙂'));
        return;
      }
      // Compagnon PNJ (principal inclus) : réplique scriptée instantanée.
      const line = replyLine(sp.personality, sp.name, msg || raw);
      const persistedId = sp.id === 'primary' ? primaryAgent?.id : sp.id;
      void recordHiveEvent({
        kind: 'message.received',
        content: msg || raw,
        channel: 'direct',
        subjectAgentId: persistedId,
        space: activeSpace,
        importance: 0.45,
        metadata: { scripted: true },
      })
        .then((source) =>
          recordHiveEvent({
            kind: 'message.sent',
            content: line,
            channel: 'direct',
            actorAgentId: persistedId,
            space: activeSpace,
            importance: 0.4,
            sourceEventIds: [source.id],
            metadata: { scripted: true },
          }),
        )
        .catch(() => undefined);
      window.setTimeout(() => {
        if (sp.id === 'primary') {
          setAutoAnim(null);
          autoNextAt.current = Date.now() + 4000;
          say(line);
        } else saySec(sp.id, line);
      }, i * 420);
    });
  }, [chatText, family, secs, name, say, isHome, saySec, spaces, activeSpace]);

  async function doAction(a: (typeof ACTIONS)[number]) {
    // Cible = compagnon sélectionné (popup) ; sinon le principal. Principal → API réelle ; autre → deltas de session.
    const target = followId ?? principalId;
    setBusy(a.id);
    try {
      if (target && target === principalId) {
        setCare(await actPetCare(a.id));
      } else if (target) {
        const c = await actAgentCare(target, a.id); // care PERSISTÉ du compagnon
        setSecCare((prev) => ({
          ...prev,
          [target]: {
            satiety: c.satiety,
            happiness: c.happiness,
            energy: c.energy,
            hygiene: c.hygiene,
            health: c.health,
          },
        }));
        saySec(target, a.feedback, 2200); // petit feedback sur le compagnon ciblé
      } else {
        setCare(await actPetCare(a.id)); // aucun compagnon : agit sur le principal par défaut
      }
      setReaction(a.react);
      setFx({ text: a.feedback, id: ++fxId.current });
      const c = brainRef.current.ctx;
      if (c) say(pickReaction(a.id, c, lastLine.current[0] ?? null));
      autoNextAt.current = Date.now() + 4500;
      window.setTimeout(() => setReaction(null), 1600);
    } catch {
      /* réseau */
    } finally {
      setBusy(null);
    }
  }

  async function buy(item: string, qty = 1) {
    setBuying(item);
    try {
      setCare(await buyShopItem(item, qty)); // renvoie gold + stock à jour
    } catch {
      /* solde insuffisant / réseau */
    } finally {
      setBuying(null);
    }
  }

  const gold = care?.gold ?? 0;
  const stock = care?.stock ?? {}; // unités ACHETÉES par matériau
  // Unités POSÉES par matériau = carrés peints (toutes pièces confondues).
  const placed: Record<string, number> = {};
  for (const its of Object.values(roomsMap))
    for (const it of its) {
      if (it.item.startsWith('~')) {
        const key = /^~(?:ft|wl|wr):(.+)$/.exec(it.item)?.[1];
        if (key) placed[key] = (placed[key] ?? 0) + 1;
      } else {
        placed[it.item] = (placed[it.item] ?? 0) + 1; // meuble posé (1 exemplaire = 1 unité)
      }
    }
  // Disponible = acheté − posé (TOUT matériau est limité à l'unité, aucun illimité).
  const availableOf = (id: string) => (stock[id] ?? 0) - (placed[id] ?? 0);
  const erasing = selected === ERASER;

  // Contexte lu par le cerveau autonome (mis à jour à chaque rendu).
  const brainCtx: BrainCtx = {
    name: name?.trim() || 'Dowze',
    mood: care?.mood ?? 'ok',
    satiety: care?.satiety ?? 80,
    happiness: care?.happiness ?? 80,
    energy: care?.energy ?? 80,
    hygiene: care?.hygiene ?? 80,
    health: care?.health ?? 90,
    hour: hourFrac,
    isDay: weather.isDay,
    weather: weather.category,
    tempC: weather.tempC,
    room,
  };
  brainRef.current = {
    ctx: brainCtx,
    blocked: edit || settingsOpen || shopOpen || transition !== 'idle',
    items: [],
  };

  // Boucle d'autonomie : décisions instantanées (déplacement / sieste / bulle), 0 réseau, 0 IA.
  useEffect(() => {
    const tick = () => {
      if (typeof document !== 'undefined' && document.hidden) return;
      const { ctx, blocked, items: its } = brainRef.current;
      if (!ctx || blocked || target.current) return; // occupé (menu, transition, déjà en mouvement)
      const nowMs = Date.now();
      if (nowMs < autoNextAt.current) return;

      const act = decideAction(ctx, { hasFurniture: its.length > 0 });
      autoNextAt.current = nowMs + act.pauseMs;

      if (act.kind === 'sleep') {
        setAutoAnim('waiting');
        if (posRef.current.c !== REST.c || posRef.current.r !== REST.r) {
          setFacing(
            REST.c - REST.r - (posRef.current.c - posRef.current.r) >= 0 ? 'right' : 'left',
          );
          target.current = { ...REST };
          setMoving(true);
        }
      } else if (act.kind === 'wander' || act.kind === 'visit') {
        setAutoAnim(null);
        const occupied = new Set(its.map((i) => `${i.c},${i.r}`));
        let tgt = null as { c: number; r: number } | null;
        if (act.kind === 'visit' && its.length) {
          const f = its[Math.floor(Math.random() * its.length)]!;
          const cand = [
            { c: f.c + 1, r: f.r },
            { c: f.c - 1, r: f.r },
            { c: f.c, r: f.r + 1 },
            { c: f.c, r: f.r - 1 },
          ].find(
            (p) =>
              p.c >= 0 &&
              p.c < gridRef.current.cols &&
              p.r >= 0 &&
              p.r < gridRef.current.rows &&
              !occupied.has(`${p.c},${p.r}`),
          );
          tgt = cand ?? null;
        }
        if (!tgt)
          tgt = pickWanderTarget(
            posRef.current,
            occupied,
            gridRef.current.cols,
            gridRef.current.rows,
          );
        if (tgt) {
          setFacing(tgt.c - tgt.r - (posRef.current.c - posRef.current.r) >= 0 ? 'right' : 'left');
          target.current = tgt;
          setMoving(true);
        }
      } else {
        // idle : petite mimique de temps en temps
        setAutoAnim(Math.random() < 0.5 ? (Math.random() < 0.5 ? 'waving' : 'jumping') : null);
      }

      if (act.say) say(pickLine(ctx, lastLine.current));
    };
    const id = window.setInterval(tick, 900);
    return () => window.clearInterval(id);
  }, [say]);

  const curType = roomType(room);
  const preset = isHome
    ? (ROOMS[curType] ?? ROOMS.chambre!)
    : (OPENSPACE_ROOMS[curType] ?? OPENSPACE_PRESET);

  // ---- Géométrie DYNAMIQUE selon l'espace : Maison = 8×8 (identique à l'origine) ; open-space = grand plateau.
  // Toutes les formules sont celles d'origine paramétrées par (cols, rows) → pour 8×8, valeurs strictement identiques.
  const mapSize: number = isHome ? HOME_SIZE : sizeForOpenspace(curType); // taille imposée selon le contexte
  const useSvg = mapSize <= SVG_MAX; // petites maps = SVG par tuile ; grandes = canvas optimisé
  const gcols = mapSize;
  const grows = mapSize;
  gridRef.current = { cols: gcols, rows: grows }; // la boucle physique lit les bornes ici
  const gox = (grows * TW) / 2;
  const gcx = (c: number, r: number) => gox + (c - r) * (TW / 2);
  const gcy = (c: number, r: number) => OY + (c + r) * (TH / 2);
  const gboardW = gox + (gcols * TW) / 2;
  const gboardH = OY + ((gcols + grows) * TH) / 2 + 8;
  boardDimRef.current = { w: gboardW, h: gboardH };
  const gdepth = (c: number, r: number) => 0.8 + ((c + r) / (gcols + grows - 2)) * 0.34;
  const gcenter = (c: number, r: number) => ({
    x: gcx(c + 0.5, r + 0.5),
    y: gcy(c + 0.5, r + 0.5),
  });
  // Matrices sol/murs DYNAMIQUES (mêmes formules que les versions module, mais avec l'origine gox du plateau courant).
  const gfloorMtx = (c: number, r: number) =>
    `matrix(${TW / 2} ${TH / 2} ${-TW / 2} ${TH / 2} ${gcx(c, r)} ${gcy(c, r)})`;
  const gwlPts = (j: number, k: number) => {
    const X = (u: number) => gox - u * (TW / 2);
    const Y = (u: number, v: number) => OY + u * (TH / 2) - WALL + WH * v;
    return `${X(j)},${Y(j, k)} ${X(j + 1)},${Y(j + 1, k)} ${X(j + 1)},${Y(j + 1, k + 1)} ${X(j)},${Y(j, k + 1)}`;
  };
  const gwrPts = (j: number, k: number) => {
    const X = (u: number) => gox + u * (TW / 2);
    const Y = (u: number, v: number) => OY + u * (TH / 2) - WALL + WH * v;
    return `${X(j)},${Y(j, k)} ${X(j + 1)},${Y(j + 1, k)} ${X(j + 1)},${Y(j + 1, k + 1)} ${X(j)},${Y(j, k + 1)}`;
  };
  const gwlMtx = (j: number, k: number) =>
    `matrix(${-TW / 2} ${TH / 2} 0 ${WH} ${gox - j * (TW / 2)} ${OY + j * (TH / 2) - WALL + WH * k})`;
  const gwrMtx = (j: number, k: number) =>
    `matrix(${TW / 2} ${TH / 2} 0 ${WH} ${gox + j * (TW / 2)} ${OY + j * (TH / 2) - WALL + WH * k})`;

  // ---- Rendu CANVAS des GRANDES maps (> SVG_MAX) : sol texturé + grille + murs, en UNE passe, résolution plafonnée
  // (mémoire bornée → 128×128, 256×256 tiennent). Les petites maps + la Maison restent en SVG par tuile (interactif).
  useEffect(() => {
    if (useSvg) return;
    const cv = floorCanvasRef.current;
    if (!cv) return;
    const kk = Math.min(1, MAX_CANVAS_PX / gboardW); // facteur de résolution (plafonné)
    const cw = Math.max(1, Math.round(gboardW * kk));
    const ch = Math.max(1, Math.round(gboardH * kk));
    cv.width = cw;
    cv.height = ch;
    cv.style.width = `${gboardW}px`;
    cv.style.height = `${gboardH}px`;
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, cw, ch);
    const X = (c: number, r: number) => gcx(c, r) * kk;
    const Y = (c: number, r: number) => gcy(c, r) * kk;
    // Fond uni (sous la texture).
    ctx.beginPath();
    ctx.moveTo(X(0, 0), Y(0, 0));
    ctx.lineTo(X(gcols, 0), Y(gcols, 0));
    ctx.lineTo(X(gcols, grows), Y(gcols, grows));
    ctx.lineTo(X(0, grows), Y(0, grows));
    ctx.closePath();
    ctx.fillStyle = preset.floor;
    ctx.fill();
    // MOTIF (createPattern) : un seul remplissage plaque la texture en iso sur toute la surface → O(1) (instantané en 256²).
    const quad = (pts: [number, number][]) => {
      ctx.beginPath();
      const [x0, y0] = pts[0]!;
      ctx.moveTo(x0, y0);
      for (let i = 1; i < pts.length; i++) {
        const [x, y] = pts[i]!;
        ctx.lineTo(x, y);
      }
      ctx.closePath();
    };
    const paintWalls = (img: HTMLImageElement | null) => {
      if (!preset.walls || !img || !img.width) return;
      const s = 1 / img.width,
        sh = 1 / img.height;
      // Mur GAUCHE : tuile = matrice de bloc (-TW/2, TH/2, 0, WH), origine (gox, OY-WALL).
      const pl = ctx.createPattern(img, 'repeat');
      if (pl?.setTransform) {
        pl.setTransform(
          new DOMMatrix([
            kk * (-TW / 2) * s,
            kk * (TH / 2) * s,
            0,
            kk * WH * sh,
            kk * gox,
            kk * (OY - WALL),
          ]),
        );
        ctx.fillStyle = pl;
        quad([
          [X(0, 0), Y(0, 0) - kk * WALL],
          [X(0, grows), Y(0, grows) - kk * WALL],
          [X(0, grows), Y(0, grows)],
          [X(0, 0), Y(0, 0)],
        ]);
        ctx.fill();
      }
      // Mur DROIT : tuile = matrice (TW/2, TH/2, 0, WH), origine (gox, OY-WALL).
      const pr = ctx.createPattern(img, 'repeat');
      if (pr?.setTransform) {
        pr.setTransform(
          new DOMMatrix([
            kk * (TW / 2) * s,
            kk * (TH / 2) * s,
            0,
            kk * WH * sh,
            kk * gox,
            kk * (OY - WALL),
          ]),
        );
        ctx.fillStyle = pr;
        quad([
          [X(0, 0), Y(0, 0) - kk * WALL],
          [X(gcols, 0), Y(gcols, 0) - kk * WALL],
          [X(gcols, 0), Y(gcols, 0)],
          [X(0, 0), Y(0, 0)],
        ]);
        ctx.fill();
      }
    };
    const paintFloor = (img: HTMLImageElement | null) => {
      if (img && img.width) {
        const s = 1 / img.width;
        const pat = ctx.createPattern(img, 'repeat');
        if (pat?.setTransform) {
          pat.setTransform(
            new DOMMatrix([
              kk * (TW / 2) * s,
              kk * (TH / 2) * s,
              kk * (-TW / 2) * s,
              kk * (TH / 2) * s,
              kk * gox,
              kk * OY,
            ]),
          );
          ctx.fillStyle = pat;
          quad([
            [X(0, 0), Y(0, 0)],
            [X(gcols, 0), Y(gcols, 0)],
            [X(gcols, grows), Y(gcols, grows)],
            [X(0, grows), Y(0, grows)],
          ]);
          ctx.fill();
        }
      }
      // Grille « tuilée » — seulement pour tailles modérées (au-delà c'est imperceptible ET coûteux).
      if (gcols <= 64) {
        ctx.strokeStyle = 'rgba(0,0,0,0.06)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let r = 0; r < grows; r++)
          for (let c = 0; c < gcols; c++) {
            ctx.moveTo(X(c, r), Y(c, r));
            ctx.lineTo(X(c + 1, r), Y(c + 1, r));
            ctx.lineTo(X(c + 1, r + 1), Y(c + 1, r + 1));
            ctx.lineTo(X(c, r + 1), Y(c, r + 1));
            ctx.closePath();
          }
        ctx.stroke();
      }
    };
    const load = (name: string | undefined, cb: (im: HTMLImageElement | null) => void) => {
      if (!name) {
        cb(null);
        return;
      }
      const im = new Image();
      im.onload = () => cb(im);
      im.onerror = () => cb(null);
      im.src = `/textures/${name}.png`;
    };
    // Murs d'abord (au fond), puis sol + grille par-dessus.
    load(preset.wallTex, (wimg) => {
      paintWalls(wimg);
      load(preset.floorTex, (fimg) => paintFloor(fimg));
    });
  }, [useSvg, gcols, grows, gox, preset.floorTex, preset.wallTex, preset.floor, preset.walls]);

  // Auto-ajustement caméra à l'entrée d'un espace : la Maison à 1× ; un grand open-space dézoomé + RE-CENTRÉ.
  useEffect(() => {
    const vp = viewportRef.current;
    const { w, h } = boardDimRef.current;
    if (isHome || !vp || !w) {
      setScale(1);
      setPan({ x: 0, y: 0 });
      return;
    }
    // Le plateau (flexShrink:0) est centré par le flex → il suffit de choisir le zoom qui le fait tenir dans le viewport.
    const fit = clampScale(Math.min(vp.clientWidth / w, vp.clientHeight / (h + TOP)) * 0.9);
    setScale(fit);
    setPan({ x: 0, y: 0 });
  }, [activeSpace, room]);
  // Salle = conteneur : on n'affiche que les compagnons de la salle sélectionnée.
  // Maison : 'chambre:<id>' = la chambre d'UN compagnon ; 'chambre' seul = toutes les chambres ; sinon la salle partagée.
  // Open-space : 'travail:N' exact ; sinon la salle entreprise (toilettes, cantine, repos, garage).
  const bedroomOwner = curType === 'chambre' ? room.split(':')[1] : undefined;
  const visibleSecs = secs.filter((sr) => {
    if (curType === 'chambre')
      return roomType(sr.room) === 'chambre' && (!bedroomOwner || sr.id === bedroomOwner);
    if (curType === 'travail') return sr.room === room; // workspace précis (travail:N)
    return sr.room === curType; // salle partagée (salon, toilettes, cantine, repos, garage…)
  });
  // Le compagnon SÉLECTIONNÉ te suit : on l'affiche dans la salle courante même s'il n'y « habite » pas.
  const follower = followId ? secs.find((s) => s.id === followId) : undefined;
  const shownSecs =
    follower && !visibleSecs.some((s) => s.id === followId)
      ? [...visibleSecs, follower]
      : visibleSecs;
  // Le principal (pet) vit à la Maison : visible en vue « chambre » (sa chambre) — pas dans les salles partagées.
  const primaryAgent = family.find((a) => a.isPrimary);
  const principalId = primaryAgent?.id ?? null;
  const showPet =
    isHome && curType === 'chambre' && (!bedroomOwner || bedroomOwner === principalId);

  // État de soin d'UN compagnon : le principal = pet_care (avec gold) ; les autres = companion_care persisté (secCare),
  // avec repli dérivé le temps que le backend réponde (évite un flash à 0).
  const careForId = (id: string): CareLike => {
    if (id === principalId && care)
      return {
        satiety: care.satiety,
        happiness: care.happiness,
        energy: care.energy,
        hygiene: care.hygiene,
        health: care.health,
      };
    return secCare[id] ?? derivedCareFor(id);
  };
  // Membres de l'ESPACE courant (tous les compagnons vivants, hors relais « Claude Code ») → moyenne du board gauche.
  const spaceMembers = family.filter((a) => a.mode !== 'relay');
  const avgCare: CareLike = (() => {
    if (!spaceMembers.length)
      return care
        ? {
            satiety: care.satiety,
            happiness: care.happiness,
            energy: care.energy,
            hygiene: care.hygiene,
            health: care.health,
          }
        : { satiety: 0, happiness: 0, energy: 0, hygiene: 0, health: 0 };
    const acc: CareLike = { satiety: 0, happiness: 0, energy: 0, hygiene: 0, health: 0 };
    for (const a of spaceMembers) {
      const c = careForId(a.id);
      acc.satiety += c.satiety;
      acc.happiness += c.happiness;
      acc.energy += c.energy;
      acc.hygiene += c.hygiene;
      acc.health += c.health;
    }
    const n = spaceMembers.length;
    return {
      satiety: Math.round(acc.satiety / n),
      happiness: Math.round(acc.happiness / n),
      energy: Math.round(acc.energy / n),
      hygiene: Math.round(acc.hygiene / n),
      health: Math.round(acc.health / n),
    };
  })();
  // Compagnon dont le popup d'info est ouvert (= le sélectionné) : principal ou secondaire.
  const infoAgent = followId ? (family.find((a) => a.id === followId) ?? null) : null;
  const infoCare = infoAgent ? careForId(infoAgent.id) : null;

  // Salles de la barre selon l'espace + leurs instances (chambres perso / workspaces) pour le menu déroulant.
  const roomOrder = isHome ? HOME_ROOM_ORDER : OPENSPACE_ROOM_ORDER;
  const roomInstances = (type: string): { key: string; label: string }[] => {
    if (type === 'chambre')
      return family
        .filter((a) => roomType(a.room) === 'chambre')
        .map((a) => ({ key: `chambre:${a.id}`, label: `Chambre de ${a.name}` }));
    if (type === 'travail') {
      const keys = [
        ...new Set(family.filter((a) => roomType(a.room) === 'travail').map((a) => a.room)),
      ].sort();
      if (!keys.length) keys.push('travail:0');
      return keys.map((k) => ({
        key: k,
        label:
          keys.length > 1
            ? `Espace de travail ${Number(k.split(':')[1] ?? 0) + 1}`
            : 'Espace de travail',
      }));
    }
    const p = isHome ? ROOMS[type] : OPENSPACE_ROOMS[type];
    return [{ key: type, label: p?.name ?? type }];
  };
  const selectRoom = (key: string) => {
    setRoomMenu(null);
    if (key === room) return;
    // Changement de salle instantané (plus de marche-vers-la-porte, buggée à plusieurs). Le compagnon SÉLECTIONNÉ te suit (effet « entrée » géré à part).
    setRoom(key);
    if (isHome && !key.includes(':')) save(key, roomsMap); // persiste la pièce courante (Maison)
  };
  // Matériau de base de la pièce (fond) + overrides PAR CARRÉ (façon blocs Minecraft).
  const floorBase =
    rawItems.find((i) => i.item.startsWith('~floor:'))?.item.slice(7) ?? preset.floorTex;
  const wallBase = preset.walls
    ? (rawItems.find((i) => i.item.startsWith('~wall:'))?.item.slice(6) ?? preset.wallTex)
    : undefined;
  const floorTileMat = new Map<string, string>(); // "c,r" → matériau
  const wallLMat = new Map<string, string>(); // "j,k" → matériau (mur gauche)
  const wallRMat = new Map<string, string>(); // "j,k" → matériau (mur droit)
  for (const it of rawItems) {
    if (it.item.startsWith('~ft:')) floorTileMat.set(`${it.c},${it.r}`, it.item.slice(4));
    else if (it.item.startsWith('~wl:')) wallLMat.set(`${it.c},${it.r}`, it.item.slice(4));
    else if (it.item.startsWith('~wr:')) wallRMat.set(`${it.c},${it.r}`, it.item.slice(4));
  }
  const floorMatAt = (c: number, r: number) => floorTileMat.get(`${c},${r}`) ?? floorBase;
  // Pinceau : selected est un MEUBLE, un matériau de sol, ou un matériau de mur.
  const brushKind: 'floor' | 'wall' | 'furniture' =
    FURNITURE_PRICES[selected] != null
      ? 'furniture'
      : FLOOR_MATS.some((m) => m.id === selected)
        ? 'floor'
        : 'wall';
  // Meubles POSÉS dans la salle courante (items sans préfixe ~).
  const furnAt = (c: number, r: number) =>
    rawItems.find((i) => !i.item.startsWith('~') && i.c === c && i.r === r);
  // Pose un meuble sur une case (un seul par case ; consomme une unité de stock).
  const placeFurniture = (c: number, r: number) => {
    const rest = rawItems.filter((i) => !(!i.item.startsWith('~') && i.c === c && i.r === r));
    if (availableOf(selected) < 1) {
      setShopOpen(true);
      return;
    }
    updateItems([...rest, { item: selected, c, r }]);
  };
  // Gomme : enlève d'abord un meuble sur la case, sinon l'override de sol.
  const eraseTile = (c: number, r: number) => {
    if (furnAt(c, r)) {
      updateItems(rawItems.filter((i) => !(!i.item.startsWith('~') && i.c === c && i.r === r)));
      return;
    }
    updateItems(rawItems.filter((i) => !(i.item.startsWith('~ft:') && i.c === c && i.r === r)));
  };
  // Peindre UN carré (sol / mur). Si on peint le matériau de fond, on retire l'override (revient au défaut).
  const paintFloorTile = (c: number, r: number) => {
    const rest = rawItems.filter((i) => !(i.item.startsWith('~ft:') && i.c === c && i.r === r));
    if (erasing) {
      updateItems(rest);
      return;
    } // gomme : retire l'override (revient au fond, rembourse l'unité)
    const cur = rawItems
      .find((i) => i.item.startsWith('~ft:') && i.c === c && i.r === r)
      ?.item.slice(4);
    if (cur !== selected && availableOf(selected) < 1) {
      setShopOpen(true);
      return;
    } // stack vide → racheter
    updateItems([...rest, { item: `~ft:${selected}`, c, r }]);
  };
  const paintWall = (side: 'L' | 'R', j: number, k: number) => {
    const pref = side === 'L' ? '~wl:' : '~wr:';
    const rest = rawItems.filter((i) => !(i.item.startsWith(pref) && i.c === j && i.r === k));
    if (erasing) {
      updateItems(rest);
      return;
    }
    const cur = rawItems
      .find((i) => i.item.startsWith(pref) && i.c === j && i.r === k)
      ?.item.slice(4);
    if (cur !== selected && availableOf(selected) < 1) {
      setShopOpen(true);
      return;
    }
    updateItems([...rest, { item: `${pref}${selected}`, c: j, r: k }]);
  };
  // Inventaire : tout matériau/meuble déjà acheté (stack possédé), filtré par la recherche.
  const invItems = [
    ...FLOOR_MATS,
    ...WALL_MATS,
    ...FURNITURE.map((f) => ({ id: f.id, name: f.name })),
  ]
    .filter((m) => (stock[m.id] ?? 0) > 0)
    .filter((m) => m.name.toLowerCase().includes(invQuery.trim().toLowerCase()));
  const isFurn = (id: string) => FURNITURE_PRICES[id] != null;
  // Silhouette de la pièce (sol + murs) → l'éclairage jour/nuit est clippé À la map, jamais sur le HUD.
  const clipPts = preset.walls
    ? [
        [gcx(0, 0), gcy(0, 0) - WALL + TOP],
        [gcx(gcols, 0), gcy(gcols, 0) - WALL + TOP],
        [gcx(gcols, 0), gcy(gcols, 0) + TOP],
        [gcx(gcols, grows), gcy(gcols, grows) + TOP],
        [gcx(0, grows), gcy(0, grows) + TOP],
        [gcx(0, grows), gcy(0, grows) - WALL + TOP],
      ]
    : [
        [gcx(0, 0), gcy(0, 0) + TOP],
        [gcx(gcols, 0), gcy(gcols, 0) + TOP],
        [gcx(gcols, grows), gcy(gcols, grows) + TOP],
        [gcx(0, grows), gcy(0, grows) + TOP],
      ];
  const roomClip = `polygon(${clipPts.map(([x, y]) => `${x}px ${y}px`).join(', ')})`;
  const petAnim = moving
    ? facing === 'right'
      ? 'running-right'
      : 'running-left'
    : (autoAnim ?? (care ? MOOD_ANIM[care.mood] : 'idle'));
  const anim = reaction ?? petAnim;

  const entities: { key: string; c: number; r: number; node: ReactNode }[] = [];
  // Le compagnon PRINCIPAL (pet) ne vit qu'à la Maison, dans sa chambre ; en open-space, seuls les agents de la salle.
  if (showPet)
    entities.push({
      key: 'pet',
      c: pos.c,
      r: pos.r,
      node: (
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (principalId) setFollowId((cur) => (cur === principalId ? null : principalId));
            talk();
          }}
          className={`relative flex cursor-pointer flex-col items-center ${principalId && followId === principalId ? 'drop-shadow-[0_0_10px_rgba(56,189,248,0.9)]' : ''}`}
        >
          <span className={NAMETAG_CLASS}>{name}</span>
          {principalId && followId === principalId && (
            <span className="pointer-events-none absolute bottom-0 left-1/2 h-3 w-12 -translate-x-1/2 rounded-[50%] border-2 border-sky-400 bg-sky-400/20" />
          )}
          <CodexPet url={petUrl || ROBOT_SKIN_URL} animId={anim} size={96} />
        </button>
      ),
    });
  // Compagnons secondaires de la salle sélectionnée (famille en Maison, agents en open-space) : sprites qui déambulent.
  shownSecs.forEach((sr) => {
    const isFollowed = sr.id === followId;
    entities.push({
      key: `sec-${sr.id}`,
      c: sr.c,
      r: sr.r,
      node: (
        <button
          onClick={(e) => {
            e.stopPropagation();
            toggleFollow(sr.id);
          }}
          className={`relative flex cursor-pointer flex-col items-center ${isFollowed ? 'drop-shadow-[0_0_10px_rgba(56,189,248,0.9)]' : ''}`}
        >
          <span className={NAMETAG_CLASS}>{sr.name}</span>
          {isFollowed && (
            <span className="pointer-events-none absolute bottom-0 left-1/2 h-3 w-12 -translate-x-1/2 rounded-[50%] border-2 border-sky-400 bg-sky-400/20" />
          )}
          <CodexPet
            url={sr.skinUrl || ROBOT_SKIN_URL}
            animId={sr.moving ? (sr.facing === 'right' ? 'running-right' : 'running-left') : 'idle'}
            size={sr.size || 84}
          />
        </button>
      ),
    });
  });
  // Meubles posés (items sans préfixe ~) : sprites statiques ancrés au sol, triés en profondeur avec les compagnons.
  rawItems
    .filter((i) => !i.item.startsWith('~'))
    .forEach((fi) => {
      entities.push({
        key: `furn-${fi.item}-${fi.c}-${fi.r}`,
        c: fi.c,
        r: fi.r,
        node: (
          <img
            src={furnUrl(fi.item)}
            alt=""
            draggable={false}
            className="pointer-events-none select-none"
            style={{ width: 92, height: 'auto' }}
          />
        ),
      });
    });
  entities.sort((a, b) => a.c + a.r - (b.c + b.r));

  return (
    <div
      ref={viewportRef}
      className="relative h-full w-full touch-none overflow-hidden"
      style={{ background: preset.bg }}
      onWheel={(e) => setScale((s) => clampScale(s * (e.deltaY < 0 ? 1.12 : 0.89)))}
      onPointerDown={startPan}
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* Décor derrière la salle (ciel/soleil/nuages/étoiles + horizon par zone, parallaxe au pan) */}
      <RoomBackground
        hour={hourFrac}
        scene={room === 'plage' ? 'sea' : room === 'jardin' ? 'hills' : 'mountains'}
        pan={pan}
        date={now ?? new Date(0)}
        lat={weather.lat ?? 46.8}
        lon={weather.lon ?? 8.2}
      />

      {/* Plateau iso — Maison = DOM/SVG (interactif). Les open-spaces sont rendus par le moteur GPU (PixiOpenspace, plus bas). */}
      {isHome && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div
            ref={boardRef}
            style={{
              width: gboardW,
              height: gboardH + TOP,
              flexShrink: 0,
              position: 'relative',
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
              transformOrigin: 'center',
              opacity: fade ? 0 : 1,
              transition: 'opacity 300ms ease',
            }}
          >
            {/* GRANDES maps (> SVG_MAX) : sol + murs sur canvas optimisé (128/256 OK). */}
            {!useSvg && (
              <canvas
                ref={floorCanvasRef}
                className="pointer-events-none absolute left-0"
                style={{ top: TOP }}
              />
            )}
            {/* PETITES maps + Maison : sol + murs en SVG par tuile (texturé + interactif). */}
            <svg
              width={gboardW}
              height={gboardH}
              viewBox={`0 0 ${gboardW} ${gboardH}`}
              className="absolute left-0"
              style={{ top: TOP }}
            >
              {useSvg && preset.walls && (
                <>
                  {Array.from({ length: grows }, (_, j) =>
                    Array.from({ length: WLEVELS }, (_, k) => {
                      // Maison : texture peinte par case ; open-space : texture murale uniforme de la salle.
                      const m = isHome ? (wallLMat.get(`${j},${k}`) ?? wallBase) : preset.wallTex;
                      return (
                        <g key={`wl-${j}-${k}`}>
                          {m && (
                            <image
                              href={`/textures/${m}.png`}
                              width="1"
                              height="1"
                              preserveAspectRatio="none"
                              transform={gwlMtx(j, k)}
                            />
                          )}
                          <polygon
                            points={gwlPts(j, k)}
                            fill={m ? 'transparent' : preset.wallL}
                            stroke="rgba(0,0,0,0.07)"
                            strokeWidth="1"
                            style={{ pointerEvents: 'all' }}
                            className={
                              isHome && edit && (erasing || brushKind === 'wall')
                                ? 'cursor-copy'
                                : ''
                            }
                            onClick={() =>
                              isHome &&
                              edit &&
                              (erasing || brushKind === 'wall') &&
                              paintWall('L', j, k)
                            }
                          />
                        </g>
                      );
                    }),
                  )}
                  {Array.from({ length: gcols }, (_, j) =>
                    Array.from({ length: WLEVELS }, (_, k) => {
                      const m = isHome ? (wallRMat.get(`${j},${k}`) ?? wallBase) : preset.wallTex;
                      return (
                        <g key={`wr-${j}-${k}`}>
                          {m && (
                            <image
                              href={`/textures/${m}.png`}
                              width="1"
                              height="1"
                              preserveAspectRatio="none"
                              transform={gwrMtx(j, k)}
                            />
                          )}
                          <polygon
                            points={gwrPts(j, k)}
                            fill={m ? 'transparent' : preset.wallR}
                            stroke="rgba(0,0,0,0.07)"
                            strokeWidth="1"
                            style={{ pointerEvents: 'all' }}
                            className={
                              isHome && edit && (erasing || brushKind === 'wall')
                                ? 'cursor-copy'
                                : ''
                            }
                            onClick={() =>
                              isHome &&
                              edit &&
                              (erasing || brushKind === 'wall') &&
                              paintWall('R', j, k)
                            }
                          />
                        </g>
                      );
                    }),
                  )}
                </>
              )}
              {useSvg &&
                Array.from({ length: grows }, (_, r) =>
                  Array.from({ length: gcols }, (_, c) => {
                    // Sol par tuile (texturé) — Maison : peinture par case ; open-space : texture uniforme de la salle.
                    const m = isHome ? floorMatAt(c, r) : preset.floorTex;
                    const pts = `${gcx(c, r)},${gcy(c, r)} ${gcx(c + 1, r)},${gcy(c + 1, r)} ${gcx(c + 1, r + 1)},${gcy(c + 1, r + 1)} ${gcx(c, r + 1)},${gcy(c, r + 1)}`;
                    return (
                      <g key={`${c}-${r}`}>
                        {m && (
                          <image
                            href={`/textures/${m}.png`}
                            width="1"
                            height="1"
                            preserveAspectRatio="none"
                            transform={gfloorMtx(c, r)}
                          />
                        )}
                        <polygon
                          points={pts}
                          fill={m ? 'transparent' : (c + r) % 2 ? preset.floorAlt : preset.floor}
                          stroke="rgba(0,0,0,0.06)"
                          strokeWidth="1"
                          style={{ pointerEvents: 'all' }}
                          className={isHome && edit ? 'cursor-copy' : 'cursor-pointer'}
                          onClick={() => isHome && onTile(c, r)}
                        />
                      </g>
                    );
                  }),
                )}
            </svg>
            {entities.map((e) => {
              const { x, y } = gcenter(e.c, e.r);
              return (
                <div
                  key={e.key}
                  className="absolute"
                  style={{
                    left: x,
                    top: y + TOP,
                    transform: `translate(-50%, -100%) scale(${gdepth(e.c, e.r)})`,
                    transformOrigin: 'bottom center',
                    zIndex: zOf(e.c, e.r),
                  }}
                >
                  {e.node}
                </div>
              );
            })}
            {/* Cycle jour/nuit : teinte clippée À la silhouette de la pièce (sol+murs+meubles+compagnon), jamais sur le HUD. */}
            <div
              className="pointer-events-none absolute left-0 top-0 transition-colors duration-1000"
              style={{
                width: gboardW,
                height: gboardH + TOP,
                backgroundColor: skyTint(hourFrac),
                clipPath: roomClip,
                zIndex: 1_000_000,
              }}
            />
            {/* Bulle + feedback du principal : seulement quand le pet est RÉELLEMENT affiché (sa chambre) — sinon bulle orpheline. */}
            {showPet &&
              (speech || fx) &&
              (() => {
                const { x, y } = center(pos.c, pos.r);
                return (
                  <div
                    className="pointer-events-none absolute"
                    style={{
                      left: x,
                      top: y + TOP,
                      transform: `translate(-50%, -100%) scale(${depthScale(pos.c, pos.r)})`,
                      transformOrigin: 'bottom center',
                      zIndex: 1_000_001,
                    }}
                  >
                    <div className="relative flex h-24 w-24 flex-col items-center">
                      {speech && (
                        <div className="absolute bottom-full left-1/2 mb-1 -translate-x-1/2 whitespace-nowrap rounded-2xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-lg">
                          {speech}
                          <span className="absolute -bottom-1 left-1/2 h-2 w-2 -translate-x-1/2 rotate-45 border-b border-r border-slate-200 bg-white" />
                        </div>
                      )}
                      {fx && (
                        <div
                          key={fx.id}
                          className="tam-float absolute -top-4 left-1/2 whitespace-nowrap rounded-full bg-white/90 px-2 py-0.5 text-xs font-bold text-slate-800 shadow"
                        >
                          {fx.text}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}
            {/* Bulles des compagnons secondaires de la salle affichée (au-dessus de la teinte aussi). */}
            {shownSecs
              .filter((sr) => sr.speech)
              .map((sr) => {
                const { x, y } = gcenter(sr.c, sr.r);
                return (
                  <div
                    key={`secb-${sr.id}`}
                    className="pointer-events-none absolute"
                    style={{
                      left: x,
                      top: y + TOP,
                      transform: `translate(-50%, -100%) scale(${gdepth(sr.c, sr.r)})`,
                      transformOrigin: 'bottom center',
                      zIndex: 1_000_001,
                    }}
                  >
                    <div className="relative flex h-20 w-20 flex-col items-center">
                      <div className="absolute bottom-full left-1/2 mb-1 -translate-x-1/2 whitespace-nowrap rounded-2xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-lg">
                        {sr.speech}
                        <span className="absolute -bottom-1 left-1/2 h-2 w-2 -translate-x-1/2 rotate-45 border-b border-r border-slate-200 bg-white" />
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* OPEN-SPACES : moteur de rendu GPU (PixiJS/WebGL) — sol + murs en Mesh iso, compagnons en sprites batchés. */}
      {!isHome && (
        <PixiOpenspace
          size={mapSize}
          floorTex={preset.floorTex ?? 'sol-beton'}
          wallTex={preset.wallTex}
          companions={shownSecs.map((s) => ({
            id: s.id,
            name: s.name,
            skinUrl: s.skinUrl || ROBOT_SKIN_URL,
            size: s.size || 84,
          }))}
          speeches={Object.fromEntries(shownSecs.map((s) => [s.id, s.speech]))}
          hour={hourFrac}
          selectedId={followId}
          roomKey={room}
          furniture={rawItems
            .filter((i) => !i.item.startsWith('~'))
            .map((i) => ({ id: i.item, c: i.c, r: i.r }))}
          editing={edit}
          gather={gather}
          onPlaceTile={(c, r) => {
            if (erasing) eraseTile(c, r);
            else if (brushKind === 'furniture') placeFurniture(c, r);
          }}
          onCompanionClick={toggleFollow}
        />
      )}

      {/* Météo sur la map : pluie / neige / brouillard / orage. */}
      <WeatherFx category={weather.category} />

      {/* Haut-gauche : 3 pilules empilées, MÊME largeur (items-stretch → largeur du plus large), texte centré. */}
      <div className="absolute left-3 top-3 z-10 flex flex-col items-stretch gap-1.5">
        <div className="flex items-center justify-center gap-2 rounded-full bg-black/40 px-4 py-1.5 text-sm font-semibold text-white backdrop-blur-sm">
          <span className="inline-block h-2 w-2 rounded-full bg-emerald-400" />
          {name?.trim() || 'Dowze'}
          {care && <span className="font-normal text-white/70">· Jour {care.ageDays}</span>}
        </div>
        <div className="rounded-full bg-black/40 px-4 py-0.5 text-left text-sm font-semibold text-white/90 backdrop-blur-sm">
          Map {mapSize}×{mapSize}
        </div>
        {/* Gold : global au profil → visible PARTOUT (Maison et open-spaces). */}
        <div className="flex items-center justify-center gap-1.5 rounded-full bg-black/40 px-4 py-1.5 text-sm font-semibold text-white/90 backdrop-blur-sm">
          <span className="text-amber-400">
            <Ico k="coin" size={15} />
          </span>
          <span className="tabular-nums text-amber-300">{gold}</span>
        </div>
      </div>

      {/* Haut-centre : sélecteur d'ESPACE (Maison + open-spaces) puis, en Maison, la barre des pièces. */}
      <div className="absolute left-1/2 top-3 z-30 flex max-w-[94%] -translate-x-1/2 items-start gap-2">
        {/* Menu déroulant des espaces */}
        <div className="relative shrink-0">
          <button
            onClick={() => setSpacesMenuOpen((v) => !v)}
            className="flex items-center gap-1.5 rounded-full border border-white/40 bg-white/85 px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-lg backdrop-blur-md transition hover:bg-white"
          >
            <Ico k={isHome ? 'home' : 'users'} size={14} />
            <span className="max-w-[8rem] truncate">
              {isHome ? 'Maison' : (spaces.find((s) => s.id === activeSpace)?.name ?? 'Espace')}
            </span>
            <Ico k="chevronDown" size={14} />
          </button>
          {spacesMenuOpen && (
            <>
              <div className="fixed inset-0 z-20" onClick={() => setSpacesMenuOpen(false)} />
              <div className="absolute left-0 top-full z-30 mt-1 w-56 overflow-hidden rounded-2xl border border-border bg-surface p-1 shadow-2xl">
                <button
                  onClick={() => {
                    setActiveSpace('home');
                    setSpacesMenuOpen(false);
                  }}
                  className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-medium transition ${isHome ? 'bg-accent/10 text-accent' : 'text-foreground hover:bg-muted'}`}
                >
                  <Ico k="home" size={15} /> Maison
                </button>
                {spaces.map((s) => (
                  <div
                    key={s.id}
                    className={`group flex items-center gap-1 rounded-xl px-1 ${activeSpace === s.id ? 'bg-accent/10' : 'hover:bg-muted'}`}
                  >
                    <button
                      onClick={() => {
                        setActiveSpace(s.id);
                        setSpacesMenuOpen(false);
                      }}
                      className={`flex flex-1 items-center gap-2 rounded-xl px-2 py-2 text-left text-sm font-medium transition ${activeSpace === s.id ? 'text-accent' : 'text-foreground'}`}
                    >
                      <Ico k="users" size={15} /> <span className="truncate">{s.name}</span>
                    </button>
                    <button
                      onClick={async (e) => {
                        e.stopPropagation();
                        if (activeSpace === s.id) setActiveSpace('home');
                        try {
                          await deleteCompanionSpace(s.id);
                          setSpaces((v) => v.filter((x) => x.id !== s.id));
                        } catch {
                          /* */
                        }
                      }}
                      aria-label="Supprimer l'espace"
                      className="rounded-full p-1 text-slate-400 opacity-0 transition hover:bg-rose-50 hover:text-rose-600 group-hover:opacity-100"
                    >
                      <Ico k="trash" size={13} />
                    </button>
                  </div>
                ))}
                <button
                  onClick={() => {
                    setSpacesMenuOpen(false);
                    setOrgName(`Open space ${spaces.length + 1}`);
                    setOrgTpl('startup-saas');
                    setOrgPicker(true);
                    if (!orgTemplates.length)
                      getOrgTemplates()
                        .then(setOrgTemplates)
                        .catch(() => {});
                  }}
                  className="mt-0.5 flex w-full items-center gap-2 rounded-xl border-t border-border px-3 py-2 text-left text-sm font-semibold text-accent transition hover:bg-accent/5"
                >
                  <Ico k="plus" size={15} /> Nouvel open-space
                </button>
              </div>
            </>
          )}
        </div>
        {/* Connaissances & projets = AUTOMATIQUES (pilotés par le système éducatif), plus de boutons manuels. */}
        {/* Modale : chantier (SOP) — objectif → l'équipe produit → livrable assemblé + archivé. */}
        {projOpen &&
          createPortal(
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
              onClick={() => !projBusy && setProjOpen(false)}
            >
              <div
                onClick={(e) => e.stopPropagation()}
                className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-3xl border border-border bg-surface shadow-2xl"
              >
                <div className="flex items-center gap-2 border-b border-border px-5 py-3.5">
                  <Ico k="sparkles" size={18} />
                  <h3 className="text-base font-bold text-foreground">
                    Chantier · {spaces.find((s) => s.id === activeSpace)?.name ?? 'Organisation'}
                  </h3>
                </div>
                <div className="flex-1 space-y-3 overflow-y-auto p-5">
                  <textarea
                    value={projGoal}
                    onChange={(e) => setProjGoal(e.target.value)}
                    disabled={projBusy}
                    placeholder="Décris l'objectif du projet (ex. « prépare un plan de cours sur les fractions » ou « conçois une landing page pour notre app »)"
                    maxLength={1000}
                    rows={3}
                    className="w-full resize-none rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-accent disabled:opacity-60"
                  />
                  {projBusy && (
                    <p className="text-center text-sm text-muted-foreground">
                      L’équipe travaille… (plan → production → relecture → assemblage)
                    </p>
                  )}
                  {projResult && (
                    <div className="space-y-3">
                      <div className="rounded-2xl border border-accent/30 bg-accent/5 p-3">
                        <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-accent">
                          Livrable
                        </div>
                        <p className="whitespace-pre-wrap text-sm text-foreground">
                          {projResult.deliverable}
                        </p>
                      </div>
                      {projResult.qa && (
                        <p className="text-xs text-muted-foreground">
                          Contrôle qualité ({projResult.qa.name}) :{' '}
                          {projResult.qa.ok ? 'validé' : 'à corriger'} — {projResult.qa.note}
                        </p>
                      )}
                      {projResult.steps.length > 0 && (
                        <details className="rounded-xl border border-border p-2">
                          <summary className="cursor-pointer text-xs font-semibold text-muted-foreground">
                            Détail par membre ({projResult.steps.length})
                          </summary>
                          <div className="mt-2 space-y-2">
                            {projResult.steps.map((s, i) => (
                              <div key={i} className="rounded-lg bg-muted/50 px-2.5 py-1.5">
                                <div className="text-xs font-semibold text-foreground">
                                  {s.name} · {s.produces}
                                </div>
                                <div className="whitespace-pre-wrap text-xs text-muted-foreground">
                                  {s.said}
                                </div>
                              </div>
                            ))}
                          </div>
                        </details>
                      )}
                      <p className="text-xs text-muted-foreground">
                        Ce livrable a été archivé dans la base de connaissances de l’organisation.
                      </p>
                    </div>
                  )}
                </div>
                <div className="flex justify-end gap-2 border-t border-border px-5 py-3">
                  <button
                    disabled={projBusy}
                    onClick={() => setProjOpen(false)}
                    className="rounded-xl px-3 py-2 text-sm font-medium text-muted-foreground transition hover:bg-muted disabled:opacity-50"
                  >
                    Fermer
                  </button>
                  <button
                    disabled={projBusy || !projGoal.trim()}
                    onClick={async () => {
                      setProjBusy(true);
                      setProjResult(null);
                      try {
                        setProjResult(await runSpaceProject(activeSpace, projGoal.trim()));
                      } catch {
                        /* */
                      } finally {
                        setProjBusy(false);
                      }
                    }}
                    className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground transition hover:opacity-90 disabled:opacity-50"
                  >
                    {projBusy ? 'En cours…' : projResult ? 'Relancer' : 'Lancer'}
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )}
        {/* Modale : base de connaissances de l'organisation (ajout / liste / suppression). */}
        {knowOpen &&
          createPortal(
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
              onClick={() => !knowBusy && setKnowOpen(false)}
            >
              <div
                onClick={(e) => e.stopPropagation()}
                className="flex max-h-[85vh] w-full max-w-md flex-col overflow-hidden rounded-3xl border border-border bg-surface shadow-2xl"
              >
                <div className="flex items-center gap-2 border-b border-border px-5 py-3.5">
                  <Ico k="book" size={18} />
                  <h3 className="text-base font-bold text-foreground">
                    Connaissances ·{' '}
                    {spaces.find((s) => s.id === activeSpace)?.name ?? 'Organisation'}
                  </h3>
                </div>
                <div className="flex-1 space-y-2 overflow-y-auto p-4">
                  {knowList.length === 0 && (
                    <p className="py-6 text-center text-sm text-muted-foreground">
                      Aucune connaissance. Ajoute un document, une règle ou un fait : l’équipe s’en
                      servira pour répondre.
                    </p>
                  )}
                  {knowList.map((k) => (
                    <div
                      key={k.id}
                      className="group flex items-start gap-2 rounded-xl border border-border px-3 py-2"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-foreground">
                          {k.title}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {k.preview}
                        </span>
                      </span>
                      <button
                        onClick={async () => {
                          try {
                            await deleteSpaceKnowledge(k.id);
                            setKnowList((v) => v.filter((x) => x.id !== k.id));
                          } catch {
                            /* */
                          }
                        }}
                        aria-label="Supprimer"
                        className="rounded-full p-1 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                      >
                        <Ico k="trash" size={13} />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="space-y-2 border-t border-border p-4">
                  <input
                    value={knowTitle}
                    onChange={(e) => setKnowTitle(e.target.value)}
                    placeholder="Titre (ex. Règle de la classe)"
                    maxLength={160}
                    className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
                  />
                  <textarea
                    value={knowContent}
                    onChange={(e) => setKnowContent(e.target.value)}
                    placeholder="Contenu : le document, le fait, la règle…"
                    maxLength={8000}
                    rows={3}
                    className="w-full resize-none rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => setKnowOpen(false)}
                      className="rounded-xl px-3 py-2 text-sm font-medium text-muted-foreground transition hover:bg-muted"
                    >
                      Fermer
                    </button>
                    <button
                      disabled={knowBusy || !knowContent.trim()}
                      onClick={async () => {
                        setKnowBusy(true);
                        try {
                          const r = await addSpaceKnowledge(
                            activeSpace,
                            knowTitle.trim(),
                            knowContent.trim(),
                          );
                          setKnowList((v) => [
                            {
                              id: r.id,
                              title: r.title,
                              preview: knowContent.trim().slice(0, 140),
                              at: Date.now(),
                            },
                            ...v,
                          ]);
                          setKnowTitle('');
                          setKnowContent('');
                        } catch {
                          /* */
                        } finally {
                          setKnowBusy(false);
                        }
                      }}
                      className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground transition hover:opacity-90 disabled:opacity-50"
                    >
                      {knowBusy ? 'Ajout…' : 'Ajouter'}
                    </button>
                  </div>
                </div>
              </div>
            </div>,
            document.body,
          )}
        {/* Modale : choix du modèle d'organisation à la création d'un open-space (seede l'effectif d'agents-employés). */}
        {orgPicker &&
          createPortal(
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
              onClick={() => !orgBusy && setOrgPicker(false)}
            >
              <div
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-md overflow-hidden rounded-3xl border border-border bg-surface shadow-2xl"
              >
                <div className="flex items-center gap-2 border-b border-border px-5 py-3.5">
                  <Ico k="users" size={18} />
                  <h3 className="text-base font-bold text-foreground">Nouvelle organisation</h3>
                </div>
                <div className="space-y-3 p-5">
                  <input
                    value={orgName}
                    onChange={(e) => setOrgName(e.target.value)}
                    placeholder="Nom de l'entreprise"
                    maxLength={40}
                    className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
                  />
                  <div className="grid grid-cols-1 gap-1.5">
                    {(orgTemplates.length
                      ? orgTemplates
                      : [
                          {
                            key: 'startup-saas',
                            label: 'Startup SaaS',
                            type: 'saas',
                            defaultMission: '',
                            roles: [
                              'ceo',
                              'cto',
                              'dev-back',
                              'dev-front',
                              'graphiste',
                              'commercial',
                              'qa',
                            ],
                          },
                        ]
                    ).map((t) => (
                      <button
                        key={t.key}
                        onClick={() => setOrgTpl(t.key)}
                        className={`flex items-center justify-between gap-2 rounded-xl border px-3 py-2.5 text-left transition ${orgTpl === t.key ? 'border-accent bg-accent/10' : 'border-border hover:bg-muted'}`}
                      >
                        <span className="min-w-0">
                          <span className="block text-sm font-semibold text-foreground">
                            {t.label}
                          </span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {t.roles.length
                              ? `${t.roles.length} agent${t.roles.length > 1 ? 's' : ''} : ${t.roles.join(', ')}`
                              : 'Sans effectif'}
                          </span>
                        </span>
                        {orgTpl === t.key && <Ico k="check" size={16} />}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex justify-end gap-2 border-t border-border px-5 py-3">
                  <button
                    disabled={orgBusy}
                    onClick={() => setOrgPicker(false)}
                    className="rounded-xl px-3 py-2 text-sm font-medium text-muted-foreground transition hover:bg-muted disabled:opacity-50"
                  >
                    Annuler
                  </button>
                  <button
                    disabled={orgBusy || !orgName.trim()}
                    onClick={async () => {
                      setOrgBusy(true);
                      try {
                        const tpl = (orgTemplates.length ? orgTemplates : []).find(
                          (x) => x.key === orgTpl,
                        );
                        const sp = await createCompanionSpace(
                          orgName.trim() || `Open space ${spaces.length + 1}`,
                          { template: orgTpl, type: tpl?.type },
                        );
                        setSpaces((v) => [...v, sp]);
                        setActiveSpace(sp.id);
                        setOrgPicker(false);
                      } catch {
                        /* limite atteinte */
                      } finally {
                        setOrgBusy(false);
                      }
                    }}
                    className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground transition hover:opacity-90 disabled:opacity-50"
                  >
                    {orgBusy ? 'Création…' : 'Créer'}
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )}
        {/* Barre des salles — Maison (chambres/pièces) ET open-spaces (salles entreprise). Types multi-instance = menu déroulant. */}
        <div className="flex flex-nowrap justify-center gap-0.5 rounded-full border border-white/40 bg-white/85 p-1 shadow-lg backdrop-blur-md">
          {roomOrder.map((type) => {
            const multi = MULTI_ROOM_TYPES.has(type);
            const active = curType === type;
            const label = (isHome ? ROOMS[type] : OPENSPACE_ROOMS[type])?.name ?? type;
            const cls = `shrink-0 whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold transition ${active ? 'bg-accent text-accent-foreground' : 'text-slate-600 hover:bg-slate-100'}`;
            if (!multi)
              return (
                <button key={type} onClick={() => selectRoom(type)} className={cls}>
                  {label}
                </button>
              );
            const insts = roomInstances(type);
            return (
              <div key={type} className="relative">
                <button
                  onClick={() => setRoomMenu((m) => (m === type ? null : type))}
                  className={cls}
                >
                  {label} ▾
                </button>
                {roomMenu === type && (
                  <div className="absolute top-full left-1/2 z-50 mt-1 max-h-56 min-w-[8rem] -translate-x-1/2 overflow-y-auto rounded-xl border border-border bg-white p-1 shadow-xl">
                    {insts.length ? (
                      insts.map((inst) => (
                        <button
                          key={inst.key}
                          onClick={() => selectRoom(inst.key)}
                          className={`block w-full whitespace-nowrap rounded-lg px-3 py-1.5 text-left text-xs font-medium transition ${room === inst.key ? 'bg-accent/10 text-accent' : 'text-foreground hover:bg-muted'}`}
                        >
                          {inst.label}
                        </button>
                      ))
                    ) : (
                      <div className="px-3 py-1.5 text-xs text-slate-400">Vide</div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Bas-gauche : Inventaire (partout ; l'aménagement par carré ne s'applique qu'à la Maison) */}
      <div className="absolute bottom-3 left-3 z-40">
        <button
          onClick={() => setEdit((v) => !v)}
          className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold shadow-lg transition ${edit ? 'bg-accent-active text-accent-foreground ring-2 ring-accent/40' : 'bg-accent text-accent-foreground hover:bg-accent-active'}`}
        >
          <Ico k="bag" size={14} /> Inventaire
        </button>
      </div>

      {/* Les trois appareils virtuels partagent les compagnons et les applications Dowze. */}
      <div className="absolute bottom-14 left-3 z-30 flex gap-1.5">
        <button
          onClick={() => setDevice('phone')}
          aria-label="Smartphone"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-white/85 text-slate-700 shadow-lg backdrop-blur transition hover:bg-white"
        >
          <Ico k="smartphone" size={17} />
        </button>
        <button
          onClick={() => setDevice('tablet')}
          aria-label="Tablette"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-white/85 text-slate-700 shadow-lg backdrop-blur transition hover:bg-white"
        >
          <Ico k="tablet" size={17} />
        </button>
        <button
          onClick={() => setDevice('desktop')}
          aria-label="Ordinateur"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-white/85 text-slate-700 shadow-lg backdrop-blur transition hover:bg-white"
        >
          <Ico k="desktop" size={17} />
        </button>
      </div>
      {device && (
        <CompanionDevice
          key={`${device}:${initialDeviceApp ?? 'home'}`}
          mode={device}
          initialApp={initialDeviceApp}
          onClose={() => {
            setDevice(null);
            setInitialDeviceApp(undefined);
          }}
        />
      )}

      {/* Bas-droite : Boutique (partout — gold + stock sont globaux au profil) */}
      <div className="absolute bottom-3 right-3 z-20">
        <button
          onClick={() => setShopOpen(true)}
          className="flex items-center gap-1.5 rounded-full bg-amber-500 px-4 py-2 text-xs font-semibold text-white shadow-lg transition hover:bg-amber-600"
        >
          <Ico k="bag" size={15} /> Boutique
        </button>
      </div>

      {/* Haut-droite : heure + météo À GAUCHE de l'engrenage, puis zoom en dessous */}
      <div className="absolute right-3 top-3 z-10 flex flex-col items-end gap-2">
        <div className="flex items-start gap-2">
          {/* Heure au-dessus, météo en dessous (à gauche de l'engrenage) */}
          <div className="flex flex-col items-end gap-2">
            {/* Heure exacte de la localisation — clic = popup calendrier */}
            <button
              onClick={() => {
                const d = now ?? new Date();
                setCalView({ y: d.getFullYear(), m: d.getMonth() });
                setSelDay(d);
                setClockOpen(true);
              }}
              aria-label="Calendrier"
              className="w-full rounded-2xl border border-white/40 bg-white/85 px-3 py-1.5 text-right shadow-lg backdrop-blur-md transition hover:bg-white"
            >
              <div className="text-lg font-bold leading-none tabular-nums text-slate-800">
                {now ? now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}
              </div>
              <div className="mt-0.5 text-[10px] font-medium capitalize text-slate-500">
                {now
                  ? now.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' })
                  : ''}
              </div>
            </button>

            {/* Météo exacte de la localisation — clic = popup détaillée */}
            <button
              onClick={() => setWeatherOpen(true)}
              aria-label="Détails météo"
              className="flex w-full items-center justify-end gap-2 rounded-2xl border border-white/40 bg-white/85 px-3 py-1.5 shadow-lg backdrop-blur-md transition hover:bg-white"
            >
              <span style={{ color: WEATHER_COLOR[weather.category] }}>
                <Ico k={weather.icon} size={22} />
              </span>
              <div className="text-right leading-tight">
                <div className="text-base font-bold leading-none tabular-nums text-slate-800">
                  {weather.tempC != null ? `${weather.tempC}°` : '—'}
                </div>
                <div className="mt-0.5 text-[10px] font-medium text-slate-500">
                  {weather.loading ? '…' : weather.label || '—'}
                </div>
              </div>
            </button>
          </div>

          {/* Ma famille (compagnons de la Maison) */}
          <button
            onClick={() => setFamilyOpen(true)}
            aria-label="Ma famille"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white/85 text-slate-700 shadow-lg backdrop-blur transition hover:bg-white"
          >
            <Ico k="users" size={18} />
          </button>

          {/* Paramètres (engrenage) */}
          <button
            onClick={() => setSettingsOpen(true)}
            aria-label="Paramètres"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white/85 text-slate-700 shadow-lg backdrop-blur transition hover:bg-white"
          >
            <Ico k="settings" size={18} />
          </button>
        </div>

        {/* Zoom */}
        <div className="flex flex-col gap-1">
          <button
            onClick={() => setScale((s) => clampScale(s * 1.15))}
            aria-label="Zoomer"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/85 text-slate-700 shadow backdrop-blur hover:bg-white"
          >
            <Ico k="plus" size={16} />
          </button>
          <button
            onClick={() => setScale((s) => clampScale(s * 0.87))}
            aria-label="Dézoomer"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/85 text-slate-700 shadow backdrop-blur hover:bg-white"
          >
            <Ico k="minus" size={16} />
          </button>
        </div>
      </div>

      {/* Board gauche : MOYENNE de tous les compagnons de l'espace (Maison ou open-space), masqué en édition. */}
      {!edit && spaceMembers.length > 0 && (
        <div className="absolute left-3 top-[8.25rem] z-10 w-40 rounded-2xl border border-white/30 bg-white/75 p-2.5 shadow-lg backdrop-blur-md">
          <div className="mb-1.5 flex items-center gap-1 text-[11px] font-bold text-slate-700">
            <Ico k="users" size={13} /> Moyenne · {spaceMembers.length}
          </div>
          {GAUGES.map((g) => {
            const v = avgCare[g.key];
            return (
              <div key={g.key} className="mb-1.5 last:mb-0">
                <div
                  className="flex items-center gap-1 text-[11px] font-medium"
                  style={{ color: gaugeColor(v) }}
                >
                  <Ico k={g.icon} size={13} />
                  <span className="text-slate-600">{g.label}</span>
                  <span className="ml-auto tabular-nums text-slate-500">{v}</span>
                </div>
                <div className="mt-0.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${v}%`, background: gaugeColor(v) }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Panneau bas : chat direct + actions de soin + palette de matériaux (en mode Aménager) */}
      <div className="absolute inset-x-0 bottom-0 flex flex-col items-center gap-2 p-2 sm:p-3">
        {/* Chat direct : parle à toute la pièce, ou « /nom … » pour cibler un compagnon. */}
        <div className="w-full max-w-3xl">
          <div className="flex items-center gap-2 rounded-full border border-white/30 bg-white/85 px-2 py-1.5 shadow-2xl backdrop-blur-xl">
            <input
              value={chatText}
              onChange={(e) => setChatText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  sendChat();
                }
              }}
              placeholder="Parle à tes compagnons…  ( /nom pour cibler )"
              className="min-w-0 flex-1 bg-transparent px-2 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none"
            />
            <button
              onClick={sendChat}
              disabled={!chatText.trim()}
              aria-label="Envoyer"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground transition hover:bg-accent-active disabled:opacity-40"
            >
              <Ico k="send" size={16} />
            </button>
          </div>
        </div>
        {/* Soins : TOUJOURS visible (même en mode Inventaire). Agit sur le compagnon sélectionné ; sinon le principal. */}
        <div className="w-full max-w-3xl rounded-3xl border border-white/30 bg-white/80 p-2.5 shadow-2xl backdrop-blur-xl">
          <div className="mb-1 text-center text-[10px] font-semibold text-slate-400">
            {infoAgent
              ? `Soins → ${infoAgent.name}`
              : isHome
                ? 'Soins → ton compagnon'
                : 'Sélectionne un compagnon pour le soigner'}
          </div>
          <div className="grid grid-cols-6 gap-1.5">
            {ACTIONS.map((a) => (
              <button
                key={a.id}
                onClick={() => void doAction(a)}
                disabled={busy !== null || (!followId && !principalId)}
                className={`flex flex-col items-center gap-0.5 rounded-2xl px-1 py-2 text-[11px] font-semibold transition active:scale-95 disabled:opacity-50 ${a.cls}`}
              >
                <Ico k={a.icon} size={18} />
                {busy === a.id ? '…' : a.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Popup INFO d'un compagnon (droite) : ouvert au clic/sélection — nom, skin, rôle, et ses barres individuelles. */}
      {infoAgent && infoCare && (
        <aside
          className="absolute right-3 top-1/2 z-40 flex max-h-[80%] w-64 -translate-y-1/2 flex-col overflow-hidden rounded-3xl border border-white/40 bg-white/90 shadow-2xl backdrop-blur-xl"
          onWheel={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <div className="flex items-start gap-3 border-b border-slate-200/70 p-3">
            <div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-2xl bg-slate-100">
              <span className="scale-[0.62]">
                <CodexPet
                  url={(infoAgent.isPrimary ? petUrl : infoAgent.skinUrl) || ROBOT_SKIN_URL}
                  animId="idle"
                  size={96}
                />
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-bold text-foreground">{infoAgent.name}</div>
              <div className="mt-0.5 text-[11px] font-medium text-slate-500">
                {infoAgent.isPrimary
                  ? 'Ton compagnon principal'
                  : infoAgent.mode === 'agent'
                    ? 'Compagnon IA'
                    : infoAgent.mode === 'relay'
                      ? 'Relais'
                      : 'Compagnon'}
              </div>
            </div>
            <button
              onClick={() => setFollowId(null)}
              aria-label="Fermer"
              className="rounded-full p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            >
              <Ico k="x" size={16} />
            </button>
          </div>
          <div className="overflow-y-auto p-3">
            {/* Ce qu'il fait */}
            <p className="mb-3 text-xs leading-relaxed text-slate-600">
              {infoAgent.personality?.description ||
                infoAgent.role ||
                (infoAgent.isPrimary
                  ? 'Il t’accompagne partout et veille sur ta progression.'
                  : 'Il vit ici et donne un coup de main à la ruche.')}
            </p>
            {operationalStates[infoAgent.id] && (
              <div className="mb-3 rounded-xl border border-accent/20 bg-accent/5 p-2 text-xs">
                <strong className="block text-accent">
                  {operationalStates[infoAgent.id]!.availability === 'busy'
                    ? 'Au travail'
                    : 'Disponible'}
                </strong>
                <span className="mt-1 block text-slate-600">
                  {operationalStates[infoAgent.id]!.activity}
                </span>
              </div>
            )}
            {!!infoAgent.personality?.traits?.length && (
              <div className="mb-3 flex flex-wrap gap-1">
                {infoAgent.personality!.traits!.slice(0, 6).map((t) => (
                  <span
                    key={t}
                    className="rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-semibold text-accent"
                  >
                    {t}
                  </span>
                ))}
              </div>
            )}
            {/* Barres individuelles */}
            <div className="rounded-2xl border border-slate-200/70 bg-white/70 p-2.5">
              {GAUGES.map((g) => {
                const v = infoCare[g.key];
                return (
                  <div key={g.key} className="mb-1.5 last:mb-0">
                    <div
                      className="flex items-center gap-1 text-[11px] font-medium"
                      style={{ color: gaugeColor(v) }}
                    >
                      <Ico k={g.icon} size={13} />
                      <span className="text-slate-600">{g.label}</span>
                      <span className="ml-auto tabular-nums text-slate-500">{v}</span>
                    </div>
                    <div className="mt-0.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${v}%`, background: gaugeColor(v) }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </aside>
      )}

      {/* Inventaire : sac FLOTTANT à gauche, GRAND (jusqu'en bas) mais s'arrête juste au-dessus du chat + la barre du bas. */}
      {edit && (
        <aside
          className="absolute left-5 top-28 bottom-44 z-30 flex w-72 flex-col overflow-hidden rounded-3xl border border-white/40 bg-white/90 shadow-2xl backdrop-blur-xl"
          onWheel={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between gap-2 border-b border-slate-200/70 px-4 py-3">
            <span className="flex items-center gap-2 text-base font-bold text-slate-700">
              <Ico k="bag" size={18} /> Inventaire
            </span>
            <button
              onClick={() => setEdit(false)}
              aria-label="Fermer l'inventaire"
              className="rounded-full p-1.5 text-slate-500 transition hover:bg-slate-200/70"
            >
              <Ico k="x" size={18} />
            </button>
          </div>
          <div className="border-b border-slate-200/70 p-2.5">
            <div className="flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5">
              <Ico k="search" size={15} />
              <input
                value={invQuery}
                onChange={(e) => setInvQuery(e.target.value)}
                placeholder="Rechercher un objet…"
                className="w-full bg-transparent text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none"
              />
              {invQuery && (
                <button
                  onClick={() => setInvQuery('')}
                  aria-label="Effacer"
                  className="text-slate-400 transition hover:text-slate-600"
                >
                  <Ico k="x" size={14} />
                </button>
              )}
            </div>
          </div>
          {/* Outil gomme : efface un carré (revient au fond, rembourse l'unité) */}
          <div className="border-b border-slate-200/70 px-2.5 py-2">
            <button
              onClick={() => setSelected(ERASER)}
              className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${erasing ? 'bg-accent text-accent-foreground' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            >
              <Ico k="eraser" size={14} /> Gomme
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-2.5">
            {invItems.length === 0 ? (
              <p className="mt-6 px-2 text-center text-sm text-slate-400">
                Aucun matériau.
                <br />
                Achète des unités dans la Boutique.
              </p>
            ) : (
              <div className="grid grid-cols-4 gap-2">
                {invItems.map((m) => {
                  const avail = Math.max(0, availableOf(m.id));
                  const empty = avail <= 0; // stack épuisé → cliquer ouvre la Boutique pour racheter
                  const active = selected === m.id;
                  return (
                    <button
                      key={m.id}
                      title={
                        empty ? `${m.name} — épuisé, racheter` : `${m.name} — ${avail} en stock`
                      }
                      onClick={() => (empty ? setShopOpen(true) : setSelected(m.id))}
                      className={`relative aspect-square overflow-hidden rounded-lg border-2 transition ${active ? 'border-accent ring-2 ring-accent/40' : 'border-transparent hover:border-slate-300'} ${empty ? 'opacity-40' : ''}`}
                    >
                      {isFurn(m.id) ? (
                        <img
                          src={furnUrl(m.id)}
                          alt={m.name}
                          className="h-full w-full bg-slate-50 object-contain p-1"
                          draggable={false}
                        />
                      ) : (
                        <MatSwatch id={m.id} size={58} />
                      )}
                      <span className="absolute bottom-0.5 right-0.5 min-w-4 rounded-md bg-black/70 px-1 text-center text-[10px] font-bold leading-4 text-white tabular-nums">
                        {avail}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </aside>
      )}

      {/* Popup « Ma famille » : gérer les compagnons de la Maison (créer / skin / personnalité / supprimer). */}
      {familyOpen && (
        <div
          className="absolute inset-0 z-40 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setFamilyOpen(false)}
          onWheel={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <div
            className="relative flex max-h-[92%] w-full max-w-lg flex-col overflow-hidden rounded-3xl border border-border bg-surface shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border px-5 py-3">
              <h2 className="flex items-center gap-2 text-lg font-bold text-foreground">
                <Ico k="users" size={18} />{' '}
                {isHome
                  ? 'Ma famille'
                  : (spaces.find((s) => s.id === activeSpace)?.name ?? 'Espace')}
              </h2>
              <button
                onClick={() => setFamilyOpen(false)}
                aria-label="Fermer"
                className="rounded-full p-1.5 text-slate-500 transition hover:bg-muted"
              >
                <Ico k="x" size={18} />
              </button>
            </div>
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
              <div className="space-y-2">
                {family.map((a) => {
                  const isBee = a.mode === 'agent' && !a.isPrimary; // abeille = compagnon-agent (open-space le plus souvent)
                  return (
                    <div
                      key={a.id}
                      className="flex items-center gap-3 rounded-xl border border-border bg-muted/30 px-3 py-2"
                    >
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white/60">
                        <span className="scale-[0.5]">
                          <CodexPet url={a.skinUrl || ROBOT_SKIN_URL} animId="idle" size={96} />
                        </span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                          {a.name}
                          {a.isPrimary && (
                            <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-bold uppercase text-accent">
                              Principal
                            </span>
                          )}
                          {a.protected && (
                            <span className="text-amber-500">
                              <Ico k="star" size={12} />
                            </span>
                          )}
                        </div>
                        <div className="truncate text-xs text-slate-500">
                          {a.role ||
                            a.personality?.traits?.join(' · ') ||
                            (a.isPrimary
                              ? 'Compagnon principal de Dowze'
                              : a.mode === 'relay'
                                ? 'Relais Claude Code / Codex'
                                : 'Compagnon')}
                        </div>
                        {isBee && (
                          <div className="mt-0.5 flex items-center gap-2 text-[10px] text-slate-400">
                            <span>{a.useCount ?? 0}× utilisée</span>
                            {a.quality != null && (
                              <span>· efficacité {Math.round((a.quality ?? 0) * 100)}%</span>
                            )}
                          </div>
                        )}
                      </div>
                      {isBee ? (
                        <div className="flex shrink-0 items-center gap-0.5">
                          <button
                            onClick={() => void toggleProtect(a.id, !a.protected)}
                            disabled={beeBusy === a.id}
                            title={a.protected ? 'Désépingler' : 'Épingler (protéger du nettoyage)'}
                            className={`rounded-full p-1.5 transition ${a.protected ? 'text-amber-500 hover:bg-amber-50' : 'text-slate-400 hover:bg-slate-100'}`}
                          >
                            <Ico k="star" size={15} />
                          </button>
                          <button
                            onClick={() => void retrainBee(a.id)}
                            disabled={beeBusy === a.id}
                            title="Ré-entraîner (consolide ses règles + son prompt)"
                            className="rounded-full p-1.5 text-slate-400 transition hover:bg-sky-50 hover:text-sky-600"
                          >
                            <Ico k="refresh" size={15} />
                          </button>
                          {(a.promptVersions ?? 0) > 0 && (
                            <button
                              onClick={() => void revertBee(a.id)}
                              disabled={beeBusy === a.id}
                              title="Annuler le dernier ré-entraînement (version précédente)"
                              className="rounded-full p-1.5 text-slate-400 transition hover:bg-amber-50 hover:text-amber-600"
                            >
                              <Ico k="undo" size={15} />
                            </button>
                          )}
                          <button
                            onClick={() => void retireBee(a.id)}
                            disabled={beeBusy === a.id}
                            title="Retirer (archiver, réversible)"
                            className="rounded-full p-1.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                          >
                            <Ico k="archive" size={15} />
                          </button>
                        </div>
                      ) : (
                        !a.isPrimary &&
                        a.mode !== 'relay' && (
                          <button
                            onClick={() => void removeCompanion(a.id)}
                            aria-label="Supprimer"
                            className="rounded-full p-1.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                          >
                            <Ico k="trash" size={16} />
                          </button>
                        )
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Nettoyage de la ruche (open-spaces) : dedup → fusion → prune. */}
              {!isHome && (
                <div className="rounded-xl border border-border p-3">
                  <div className="mb-1.5 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-sm font-bold text-foreground">
                      <Ico k="sparkles" size={15} /> Nettoyer la ruche
                    </div>
                    <button
                      onClick={() => void runMaintain()}
                      disabled={hiveBusy}
                      className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-slate-700 disabled:opacity-40"
                    >
                      {hiveBusy ? '…' : 'Lancer'}
                    </button>
                  </div>
                  <p className="text-[11px] leading-relaxed text-slate-500">
                    Fusionne les doublons et retire les abeilles obsolètes ou peu efficaces
                    (réversible). Les abeilles épinglées ★ sont protégées.
                  </p>
                  {hiveReport && (
                    <div className="mt-2 space-y-0.5 rounded-lg bg-muted/40 px-2.5 py-2 text-[11px] text-slate-600">
                      {hiveReport.merged.length === 0 && hiveReport.retired.length === 0 && (
                        <div>Ruche déjà propre — rien à faire.</div>
                      )}
                      {hiveReport.merged.length > 0 && (
                        <div>
                          Fusionnées :{' '}
                          {hiveReport.merged.map((m) => `${m.absorbed} → ${m.survivor}`).join(', ')}
                        </div>
                      )}
                      {hiveReport.retired.length > 0 && (
                        <div>Retirées : {hiveReport.retired.join(', ')}</div>
                      )}
                      <div className="text-slate-400">
                        {hiveReport.scanned} abeilles actives
                        {hiveReport.embedded > 0
                          ? ` · ${hiveReport.embedded} indexées (sémantique)`
                          : ''}
                        .
                      </div>
                    </div>
                  )}
                </div>
              )}
              <div className="rounded-xl border border-border p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div className="text-sm font-bold text-foreground">Ajouter un compagnon</div>
                  <div className="flex gap-0.5 rounded-lg bg-slate-100 p-0.5">
                    {(['pnj', 'ia'] as const).map((mo) => (
                      <button
                        key={mo}
                        onClick={() => setCreateMode(mo)}
                        className={`rounded-md px-2.5 py-1 text-xs font-semibold transition ${createMode === mo ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'}`}
                      >
                        {mo === 'pnj' ? 'Simple' : 'IA'}
                      </button>
                    ))}
                  </div>
                </div>
                {/* Skin (partagé) */}
                <div className="mb-2 grid grid-cols-4 gap-1.5">
                  {CURATED_PETS.map((p) => (
                    <button
                      key={p.slug}
                      onClick={() => setNewSkin(p.slug)}
                      title={p.name}
                      className={`flex aspect-square items-center justify-center overflow-hidden rounded-lg border-2 bg-white/50 transition ${newSkin === p.slug ? 'border-accent ring-2 ring-accent/40' : 'border-transparent hover:border-slate-300'}`}
                    >
                      <span className="scale-[0.42]">
                        <CodexPet url={curatedSheetUrl(p.slug)} animId="idle" size={96} />
                      </span>
                    </button>
                  ))}
                </div>
                {createMode === 'pnj' ? (
                  <>
                    <input
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      placeholder="Nom du compagnon"
                      maxLength={40}
                      className="mb-2 w-full rounded-lg border border-border bg-transparent px-3 py-1.5 text-sm text-foreground placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-accent/40"
                    />
                    <div className="mb-2.5 flex flex-wrap gap-1.5">
                      {TRAIT_CHIPS.map((tr) => {
                        const on = newTraits.includes(tr);
                        return (
                          <button
                            key={tr}
                            onClick={() =>
                              setNewTraits((v) => (on ? v.filter((x) => x !== tr) : [...v, tr]))
                            }
                            className={`rounded-full px-2.5 py-1 text-xs font-semibold capitalize transition ${on ? 'bg-accent text-accent-foreground' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                          >
                            {tr}
                          </button>
                        );
                      })}
                    </div>
                    <button
                      onClick={() => void addCompanion()}
                      disabled={creating || !newName.trim()}
                      className="w-full rounded-xl bg-accent py-2 text-sm font-semibold text-accent-foreground transition hover:bg-accent-active disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {creating ? '…' : 'Ajouter à la famille'}
                    </button>
                  </>
                ) : (
                  <>
                    <textarea
                      value={iaDesc}
                      onChange={(e) => setIaDesc(e.target.value)}
                      rows={2}
                      maxLength={500}
                      placeholder="Décris-le en une phrase — n'importe quel domaine. Ex : « un assistant qui organise mes projets », « un dev senior qui relit mon code », « un coach sportif motivant »"
                      className="mb-1 w-full resize-none rounded-lg border border-border bg-transparent px-3 py-2 text-sm text-foreground placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-accent/40"
                    />
                    <p className="mb-2 text-[11px] text-slate-400">
                      Dowze construit tout automatiquement (nom, caractère, spécialité). Nécessite
                      une clé IA.
                    </p>
                    {iaErr && (
                      <p className="mb-2 rounded-lg bg-rose-50 px-2.5 py-1.5 text-[11px] font-medium text-rose-600">
                        {iaErr}
                      </p>
                    )}
                    <button
                      onClick={() => void addCompanionAI()}
                      disabled={iaBusy || !iaDesc.trim()}
                      className="w-full rounded-xl bg-accent py-2 text-sm font-semibold text-accent-foreground transition hover:bg-accent-active disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {iaBusy ? 'Dowze construit ton compagnon…' : 'Créer avec l’IA'}
                    </button>
                  </>
                )}
              </div>

              {/* Relais Claude Code / Codex : connecter SON agent de code (son abonnement) via MCP. */}
              {isHome && (
                <div className="rounded-xl border border-border p-3">
                  <div className="mb-1.5 flex items-center gap-2 text-sm font-bold text-foreground">
                    <Ico k="terminal" size={16} /> Relais Claude Code / Codex
                  </div>
                  <p className="mb-2.5 text-[11px] leading-relaxed text-slate-500">
                    Connecte <b>ton</b> Claude Code / Codex (ton abonnement). Il t’écrit son
                    avancement dans le téléphone et lit tes instructions — fil « Claude Code » dans
                    Messages.
                  </p>
                  {!relayToken ? (
                    <button
                      onClick={() => void genRelayToken()}
                      disabled={relayBusy}
                      className="w-full rounded-xl bg-slate-800 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:opacity-40"
                    >
                      {relayBusy ? '…' : 'Générer un jeton de connexion'}
                    </button>
                  ) : (
                    (() => {
                      const mcpCmd = `claude mcp add --transport http dowze https://api.dowze.ch/companion/mcp --header "Authorization: Bearer ${relayToken}"`;
                      return (
                        <div className="space-y-2">
                          <div className="relative rounded-lg bg-slate-900 p-2.5">
                            <code className="block break-all pr-8 font-mono text-[10.5px] leading-relaxed text-emerald-300">
                              {mcpCmd}
                            </code>
                            <button
                              onClick={() => {
                                void navigator.clipboard?.writeText(mcpCmd);
                                setRelayCopied(true);
                              }}
                              aria-label="Copier"
                              className="absolute right-1.5 top-1.5 rounded-md p-1.5 text-slate-300 transition hover:bg-white/10"
                            >
                              <Ico k="copy" size={14} />
                            </button>
                          </div>
                          <p className="text-[11px] text-slate-500">
                            {relayCopied
                              ? 'Copié ✓ — colle-la dans ton terminal, puis relance Claude Code.'
                              : 'Colle cette commande dans ton terminal (une seule fois). Le jeton n’est affiché que maintenant.'}
                          </p>
                          <p className="text-[10px] text-slate-400">
                            Codex : ajoute le même serveur MCP (URL + en-tête Authorization) dans ta
                            config.
                          </p>
                        </div>
                      );
                    })()
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Popup Paramètres (centrée en grand sur le jeu) */}
      {settingsOpen && (
        <div
          className="absolute inset-0 z-40 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setSettingsOpen(false)}
          onWheel={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <div
            className="flex h-full w-full flex-col rounded-3xl border border-border bg-surface p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-xl font-bold">Paramètres</h2>
              <button
                onClick={() => setSettingsOpen(false)}
                aria-label="Fermer"
                className="rounded-full p-1.5 text-slate-500 transition hover:bg-muted"
              >
                <Ico k="x" size={18} />
              </button>
            </div>

            <div className="min-h-0 flex-1">
              <SettingsMenu onClearRoom={() => updateItems([])} />
            </div>
          </div>
        </div>
      )}

      {/* Popup Calendrier façon Apple/Google : mini-calendrier + timeline horaire du jour */}
      {clockOpen &&
        (() => {
          const { y, m } = calView;
          const today = now ?? new Date();
          const monthLabel = new Date(y, m, 1).toLocaleDateString('fr-FR', {
            month: 'long',
            year: 'numeric',
          });
          const startDow = (new Date(y, m, 1).getDay() + 6) % 7; // Lundi = 0
          const nDays = new Date(y, m + 1, 0).getDate();
          const isToday = (d: number) =>
            y === today.getFullYear() && m === today.getMonth() && d === today.getDate();
          const isSel = (d: number) =>
            y === selDay.getFullYear() && m === selDay.getMonth() && d === selDay.getDate();
          const cells: (number | null)[] = [
            ...Array(startDow).fill(null),
            ...Array.from({ length: nDays }, (_, i) => i + 1),
          ];
          const shiftMonth = (delta: number) =>
            setCalView((v) => {
              const d = new Date(v.y, v.m + delta, 1);
              return { y: d.getFullYear(), m: d.getMonth() };
            });
          const goDay = (delta: number) =>
            setSelDay((p) => {
              const x = new Date(p);
              x.setDate(x.getDate() + delta);
              setCalView({ y: x.getFullYear(), m: x.getMonth() });
              return x;
            });
          const goToday = () => {
            setSelDay(today);
            setCalView({ y: today.getFullYear(), m: today.getMonth() });
          };
          // Planning du jour sélectionné (emploi du temps hebdo, par jour de semaine).
          const selDow = selDay.getDay();
          const vac = schedule
            ? schedule.vacations.some((v) => v.startDate <= ymd(selDay) && ymd(selDay) <= v.endDate)
            : false;
          const rest = schedule ? !schedule.config.activeDays.includes(selDow) : false;
          const dayBlocks =
            schedule && !vac && !rest
              ? schedule.blocks
                  .filter((b) => b.dayOfWeek === selDow)
                  .slice()
                  .sort((a, b) => a.startMin - b.startMin)
              : [];
          let startHour = 7,
            endHour = 21;
          if (dayBlocks.length) {
            startHour = Math.max(
              0,
              Math.floor(Math.min(...dayBlocks.map((b) => b.startMin)) / 60) - 1,
            );
            endHour = Math.min(
              24,
              Math.ceil(Math.max(...dayBlocks.map((b) => b.startMin + b.durationMin)) / 60) + 1,
            );
          }
          const HOUR = 46;
          const hours = Math.max(1, endHour - startHour);
          const selIsToday =
            today.getFullYear() === selDay.getFullYear() &&
            today.getMonth() === selDay.getMonth() &&
            today.getDate() === selDay.getDate();
          const nowMin = today.getHours() * 60 + today.getMinutes();
          const nowInRange = selIsToday && nowMin >= startHour * 60 && nowMin <= endHour * 60;
          return (
            <div
              className="absolute inset-0 z-40 flex items-center justify-center bg-black/50 p-4"
              onClick={() => setClockOpen(false)}
              onWheel={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
            >
              <div
                className="relative flex max-h-[92%] w-full max-w-3xl flex-col overflow-hidden rounded-3xl bg-surface shadow-2xl ring-1 ring-black/5"
                onClick={(e) => e.stopPropagation()}
              >
                {/* En-tête */}
                <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
                  <h2 className="text-lg font-semibold capitalize tracking-tight text-slate-800">
                    {DAY_FULL[selDow]} {selDay.getDate()} {MONTH_FULL[selDay.getMonth()]}
                  </h2>
                  <div className="flex items-center gap-0.5">
                    <button
                      onClick={() => goDay(-1)}
                      aria-label="Jour précédent"
                      className="flex h-7 w-7 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100"
                    >
                      <Ico k="chevronLeft" size={16} />
                    </button>
                    <button
                      onClick={goToday}
                      className="rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
                    >
                      Aujourd&apos;hui
                    </button>
                    <button
                      onClick={() => goDay(1)}
                      aria-label="Jour suivant"
                      className="flex h-7 w-7 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100"
                    >
                      <Ico k="chevronRight" size={16} />
                    </button>
                  </div>
                  <div className="ml-auto mr-1 hidden text-sm font-medium tabular-nums text-slate-400 sm:block">
                    {now
                      ? now.toLocaleTimeString('fr-FR', {
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        })
                      : ''}
                  </div>
                  <button
                    onClick={() => setClockOpen(false)}
                    aria-label="Fermer"
                    className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100"
                  >
                    <Ico k="x" size={18} />
                  </button>
                </div>

                <div className="flex min-h-0 flex-1 flex-col sm:flex-row">
                  {/* Mini-calendrier */}
                  <div className="shrink-0 border-b border-slate-100 p-3 sm:w-60 sm:border-b-0 sm:border-r">
                    <div className="mb-1.5 flex items-center justify-between">
                      <button
                        onClick={() => shiftMonth(-1)}
                        aria-label="Mois précédent"
                        className="flex h-7 w-7 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100"
                      >
                        <Ico k="chevronLeft" size={16} />
                      </button>
                      <span className="text-sm font-semibold capitalize text-slate-700">
                        {monthLabel}
                      </span>
                      <button
                        onClick={() => shiftMonth(1)}
                        aria-label="Mois suivant"
                        className="flex h-7 w-7 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100"
                      >
                        <Ico k="chevronRight" size={16} />
                      </button>
                    </div>
                    <div className="grid grid-cols-7 gap-0.5 text-center">
                      {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((w, i) => (
                        <div
                          key={i}
                          className="pb-1 text-[10px] font-semibold uppercase text-slate-400"
                        >
                          {w}
                        </div>
                      ))}
                      {cells.map((d, i) =>
                        d == null ? (
                          <div key={i} />
                        ) : (
                          <button
                            key={i}
                            onClick={() => setSelDay(new Date(y, m, d))}
                            className="flex items-center justify-center py-0.5"
                          >
                            <span
                              className={`flex h-7 w-7 items-center justify-center rounded-full text-[13px] tabular-nums transition ${isToday(d) ? 'bg-blue-500 font-semibold text-white' : isSel(d) ? 'bg-blue-100 font-semibold text-blue-700' : 'text-slate-600 hover:bg-slate-100'}`}
                            >
                              {d}
                            </span>
                          </button>
                        ),
                      )}
                    </div>
                  </div>

                  {/* Timeline du jour */}
                  <div className="min-h-0 flex-1 overflow-y-auto">
                    {!schedule ? (
                      <p className="p-10 text-center text-sm text-slate-400">Chargement…</p>
                    ) : vac || rest || dayBlocks.length === 0 ? (
                      <div className="flex h-full min-h-[220px] items-center justify-center px-4">
                        <p className="text-sm text-slate-400">
                          {vac ? 'Vacances' : rest ? 'Jour de repos' : 'Aucun cours ce jour'}
                        </p>
                      </div>
                    ) : (
                      <div className="relative flex px-2 py-3">
                        {/* Colonne des heures */}
                        <div className="w-12 shrink-0" style={{ height: hours * HOUR }}>
                          {Array.from({ length: hours }).map((_, i) => (
                            <div key={i} className="relative" style={{ height: HOUR }}>
                              <span className="absolute -top-2 right-2 text-[10px] tabular-nums text-slate-400">
                                {String(startHour + i).padStart(2, '0')}:00
                              </span>
                            </div>
                          ))}
                        </div>
                        {/* Grille + événements */}
                        <div
                          className="relative flex-1 border-l border-slate-100"
                          style={{ height: hours * HOUR }}
                        >
                          {Array.from({ length: hours }).map((_, i) => (
                            <div
                              key={i}
                              className="border-t border-slate-100"
                              style={{ height: HOUR }}
                            />
                          ))}
                          {dayBlocks.map((b, bi) => {
                            const st = blockStyle(b);
                            const top = ((b.startMin - startHour * 60) / 60) * HOUR;
                            const h = Math.max((b.durationMin / 60) * HOUR - 2, 22);
                            const tall = h >= 44;
                            return (
                              <div
                                key={bi}
                                className={`absolute left-1 right-2 flex overflow-hidden rounded-md ${st.fill}`}
                                style={{ top: top + 1, height: h }}
                              >
                                <span className={`w-1 shrink-0 ${st.bar}`} />
                                <div className="min-w-0 px-2 py-1 leading-tight">
                                  <div className={`truncate text-[13px] font-semibold ${st.text}`}>
                                    {b.label}
                                  </div>
                                  {tall && (
                                    <div className={`text-[11px] ${st.sub}`}>
                                      {fmtHour(b.startMin)} – {fmtHour(b.startMin + b.durationMin)}
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                          {nowInRange && (
                            <div
                              className="pointer-events-none absolute inset-x-0 z-10"
                              style={{ top: ((nowMin - startHour * 60) / 60) * HOUR }}
                            >
                              <span className="absolute -left-1 -top-[3px] h-[7px] w-[7px] rounded-full bg-red-500" />
                              <div className="h-[1.5px] bg-red-500" />
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

      {/* Popup Météo — app météo immersive (fond ciel, panneaux « verre »), paysage responsive */}
      {weatherOpen &&
        (() => {
          const wMin = weather.daily.length ? Math.min(...weather.daily.map((d) => d.min)) : 0;
          const wMax = weather.daily.length ? Math.max(...weather.daily.map((d) => d.max)) : 1;
          const span = Math.max(1, wMax - wMin);
          const tiles = [
            {
              k: 'droplet',
              lbl: 'Humidité',
              val: weather.humidity != null ? `${weather.humidity}%` : '—',
            },
            {
              k: 'wind',
              lbl: 'Vent',
              val: weather.windKmh != null ? `${weather.windKmh} km/h` : '—',
            },
            {
              k: 'cloudRain',
              lbl: 'Précipitations',
              val: weather.precipMm != null ? `${weather.precipMm} mm` : '—',
            },
            {
              k: 'cloud',
              lbl: 'Nébulosité',
              val: weather.cloud != null ? `${weather.cloud}%` : '—',
            },
            { k: 'sunrise', lbl: 'Lever du soleil', val: weather.sunrise?.slice(11, 16) ?? '—' },
            { k: 'sunset', lbl: 'Coucher du soleil', val: weather.sunset?.slice(11, 16) ?? '—' },
          ];
          return (
            <div
              className="absolute inset-0 z-40 flex items-center justify-center bg-black/50 p-3 sm:p-5"
              onClick={() => setWeatherOpen(false)}
              onWheel={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
            >
              <div
                className="relative max-h-[94%] w-full max-w-5xl overflow-hidden rounded-[28px] shadow-2xl ring-1 ring-white/10"
                style={{ background: weatherSky(weather.category, weather.isDay) }}
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  onClick={() => setWeatherOpen(false)}
                  aria-label="Fermer"
                  className="absolute right-4 top-4 z-10 rounded-full p-1.5 text-white/70 transition hover:bg-white/15 hover:text-white"
                >
                  <Ico k="x" size={18} />
                </button>
                <div className="flex max-h-[94vh] flex-col overflow-y-auto text-white lg:flex-row">
                  {/* Actuel + prochaines heures */}
                  <div className="flex flex-col gap-6 p-6 lg:w-[42%] lg:p-8">
                    <div>
                      <div className="flex items-center gap-1.5 text-base font-semibold">
                        <Ico k="mapPin" size={16} /> {weather.city ?? 'Ma position'}
                      </div>
                      <div className="mt-3 flex items-start gap-2">
                        <div className="text-[5.5rem] font-semibold leading-[0.9] tracking-tight tabular-nums">
                          {weather.tempC != null ? `${weather.tempC}°` : '—'}
                        </div>
                        <span className="mt-1 opacity-95">
                          <Ico k={weather.icon} size={46} />
                        </span>
                      </div>
                      <div className="mt-1.5 text-lg font-medium">
                        {weather.loading ? '…' : weather.label || '—'}
                      </div>
                      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-sm text-white/70">
                        {weather.daily[0] && (
                          <span>
                            Max <span className="text-white">{weather.daily[0].max}°</span> · Min{' '}
                            <span className="text-white">{weather.daily[0].min}°</span>
                          </span>
                        )}
                        {weather.feelsC != null && <span>Ressenti {weather.feelsC}°</span>}
                      </div>
                    </div>

                    {weather.hourly.length > 0 && (
                      <div className="rounded-2xl border border-white/15 bg-white/10 p-3 backdrop-blur-md">
                        <div
                          ref={hourlyRef}
                          className="flex gap-4 overflow-x-auto pb-1 [&::-webkit-scrollbar]:hidden"
                          style={{ scrollbarWidth: 'none' }}
                        >
                          {weather.hourly.map((h) => (
                            <div
                              key={h.time}
                              className="flex shrink-0 flex-col items-center gap-1.5"
                            >
                              <div className="text-xs text-white/70">{h.time.slice(11, 13)}h</div>
                              {h.pop > 0 ? (
                                <div className="flex items-center gap-0.5 text-[10px] font-medium text-sky-200">
                                  <Ico k="droplet" size={9} />
                                  {h.pop}
                                </div>
                              ) : (
                                <div className="h-3.5" />
                              )}
                              <span title={wmoLabel(h.code)}>
                                <Ico k={wmoIcon(h.code, h.isDay)} size={22} />
                              </span>
                              <div className="text-sm font-semibold tabular-nums">{h.tempC}°</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Détails + prévisions 6 jours */}
                  <div className="flex flex-col gap-3 p-6 lg:flex-1 lg:border-l lg:border-white/10 lg:px-8 lg:pb-8 lg:pt-14">
                    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                      {tiles.map((d) => (
                        <div
                          key={d.lbl}
                          className="rounded-2xl border border-white/15 bg-white/10 p-3 backdrop-blur-md"
                        >
                          <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-white/60">
                            <Ico k={d.k} size={13} /> {d.lbl}
                          </div>
                          <div className="mt-1 text-lg font-semibold tabular-nums">{d.val}</div>
                        </div>
                      ))}
                    </div>

                    {weather.daily.length > 0 && (
                      <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-1.5 backdrop-blur-md">
                        {weather.daily.map((d, i) => {
                          const left = ((d.min - wMin) / span) * 100;
                          const width = Math.max(6, ((d.max - d.min) / span) * 100);
                          return (
                            <div
                              key={d.date}
                              className={`flex items-center gap-3 py-2 ${i > 0 ? 'border-t border-white/10' : ''}`}
                            >
                              <div className="w-10 shrink-0 text-sm font-medium capitalize">
                                {i === 0
                                  ? 'Auj.'
                                  : new Date(`${d.date}T12:00`).toLocaleDateString([], {
                                      weekday: 'short',
                                    })}
                              </div>
                              <span title={wmoLabel(d.code)} className="shrink-0">
                                <Ico k={wmoIcon(d.code, true)} size={22} />
                              </span>
                              <div className="w-8 shrink-0 text-[11px] font-medium text-sky-200">
                                {d.pop > 0 ? `${d.pop}%` : ''}
                              </div>
                              <div className="w-8 shrink-0 text-right text-sm text-white/60 tabular-nums">
                                {d.min}°
                              </div>
                              <div className="relative h-1.5 flex-1 rounded-full bg-white/15">
                                <div
                                  className="absolute inset-y-0 rounded-full"
                                  style={{
                                    left: `${left}%`,
                                    width: `${width}%`,
                                    background: 'linear-gradient(90deg, #7dd3fc, #fbbf24)',
                                  }}
                                />
                              </div>
                              <div className="w-8 shrink-0 text-sm font-semibold tabular-nums">
                                {d.max}°
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {weather.tempC == null && !weather.loading && (
                      <p className="py-4 text-center text-sm text-white/70">
                        Météo indisponible (localisation refusée ?).
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

      {/* Popup Boutique (sidebar catégories + contenu). Bloque le scroll/pan de la map derrière. */}
      {shopOpen && (
        <div
          className="absolute inset-0 z-40 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setShopOpen(false)}
          onWheel={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <div
            className="flex h-[86%] w-full max-w-2xl overflow-hidden rounded-3xl border border-border bg-surface shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Barre latérale : catégories */}
            <aside className="flex w-40 shrink-0 flex-col gap-1 border-r border-border bg-muted/40 p-3">
              <div className="mb-2 flex w-fit items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-sm font-bold text-amber-700">
                <span className="text-amber-500">
                  <Ico k="coin" size={15} />
                </span>
                <span className="tabular-nums">{gold}</span>
              </div>
              {(
                [
                  ['sols', 'Sols'],
                  ['murs', 'Murs'],
                  ['meubles', 'Meubles'],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  onClick={() => setShopCat(id)}
                  className={`rounded-xl px-3 py-2 text-left text-sm font-semibold transition ${shopCat === id ? 'bg-accent text-accent-foreground' : 'text-slate-600 hover:bg-slate-100'}`}
                >
                  {label}
                </button>
              ))}
            </aside>

            {/* Contenu de la catégorie */}
            <div className="flex min-w-0 flex-1 flex-col">
              <div className="flex items-center justify-between border-b border-border px-5 py-3">
                <h2 className="text-lg font-bold">
                  {shopCat === 'sols' ? 'Sols' : shopCat === 'murs' ? 'Murs' : 'Meubles'}
                </h2>
                <button
                  onClick={() => setShopOpen(false)}
                  aria-label="Fermer"
                  className="rounded-full p-1.5 text-slate-500 transition hover:bg-muted"
                >
                  <Ico k="x" size={18} />
                </button>
              </div>
              {/* Quantité d'unités achetées d'un coup (1 unité = 1 carré) */}
              <div className="flex items-center gap-2 border-b border-border px-5 py-2">
                <span className="text-xs font-semibold text-slate-500">Quantité</span>
                {[1, 8, 32, 64].map((n) => (
                  <button
                    key={n}
                    onClick={() => setBuyQty(n)}
                    className={`rounded-lg px-2.5 py-1 text-xs font-bold tabular-nums transition ${buyQty === n ? 'bg-accent text-accent-foreground' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                  >
                    ×{n}
                  </button>
                ))}
                <span className="ml-auto text-[11px] text-slate-400">
                  {shopCat === 'meubles' ? '1 unité = 1 meuble' : '1 unité = 1 carré'}
                </span>
              </div>
              {/* Sous-catégories (meubles uniquement) */}
              {shopCat === 'meubles' && (
                <div className="flex flex-wrap gap-1 border-b border-border px-4 py-2">
                  {[{ id: 'all', label: 'Tous' }, ...FURNITURE_CATS].map((c) => (
                    <button
                      key={c.id}
                      onClick={() => setShopFurnCat(c.id)}
                      className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition ${shopFurnCat === c.id ? 'bg-accent text-accent-foreground' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
              )}
              <div className="min-h-0 flex-1 overflow-auto p-4">
                <div className="grid auto-rows-fr grid-cols-3 gap-2 sm:grid-cols-4">
                  {(shopCat === 'meubles'
                    ? FURNITURE.filter((f) => shopFurnCat === 'all' || f.cat === shopFurnCat).map(
                        (f) => ({
                          id: f.id,
                          name: f.name,
                          price: f.price,
                          preview: (
                            <img
                              src={furnUrl(f.id)}
                              alt=""
                              className="h-14 w-14 object-contain"
                              draggable={false}
                            />
                          ),
                        }),
                      )
                    : (shopCat === 'sols' ? FLOOR_MATS : WALL_MATS).map((m) => ({
                        id: m.id,
                        name: m.name,
                        price: MAT_PRICES[m.id] ?? 0,
                        preview: <MatSwatch id={m.id} size={56} />,
                      }))
                  ).map((it) => {
                    const ownedN = stock[it.id] ?? 0;
                    const cost = it.price * buyQty;
                    const tooPoor = gold < cost;
                    return (
                      <div
                        key={it.id}
                        className="flex flex-col items-center rounded-xl border border-border p-2.5 text-center"
                      >
                        <div className="flex h-16 items-center justify-center">{it.preview}</div>
                        <div className="mt-1 flex min-h-[2.1rem] items-center justify-center text-sm font-semibold leading-tight text-foreground">
                          {it.name}
                        </div>
                        <div className="mt-auto w-full">
                          <div className="mb-1 flex items-center justify-center gap-1 text-xs font-bold text-amber-600">
                            <Ico k="coin" size={12} />{' '}
                            <span className="tabular-nums">{it.price}</span>
                            <span className="font-normal text-slate-400">/unité</span>
                          </div>
                          {ownedN > 0 && (
                            <div className="mb-1 text-[11px] font-semibold text-emerald-600">
                              En stock ×{Math.max(0, availableOf(it.id))}
                            </div>
                          )}
                          <button
                            onClick={() => void buy(it.id, buyQty)}
                            disabled={buying !== null || tooPoor}
                            className="block w-full rounded-full bg-accent py-1.5 text-xs font-semibold text-accent-foreground transition hover:bg-accent-active disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            {buying === it.id ? '…' : tooPoor ? 'Trop cher' : `Acheter ×${buyQty}`}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
