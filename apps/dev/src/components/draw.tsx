'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

const W = 1280;
const H = 800;
const RULER = 22;
type Tool = 'move' | 'pencil' | 'eraser' | 'line' | 'rect' | 'ellipse' | 'arrow' | 'text';
interface Drawing {
  name: string;
  mtime: number;
  size: number;
}
interface Stencil {
  inner: string;
  color: string;
  x: number;
  y: number;
  w: number;
  h: number;
}
interface Layer {
  id: string;
  name: string;
  visible: boolean;
  opacity: number;
  blend: string;
  locked: boolean;
  stencil?: Stencil;
}
const HANDLES: { k: string; cursor: string; pos: React.CSSProperties }[] = [
  { k: 'nw', cursor: 'nwse-resize', pos: { left: -5, top: -5 } },
  { k: 'n', cursor: 'ns-resize', pos: { left: 'calc(50% - 5px)', top: -5 } },
  { k: 'ne', cursor: 'nesw-resize', pos: { right: -5, top: -5 } },
  { k: 'e', cursor: 'ew-resize', pos: { right: -5, top: 'calc(50% - 5px)' } },
  { k: 'se', cursor: 'nwse-resize', pos: { right: -5, bottom: -5 } },
  { k: 's', cursor: 'ns-resize', pos: { left: 'calc(50% - 5px)', bottom: -5 } },
  { k: 'sw', cursor: 'nesw-resize', pos: { left: -5, bottom: -5 } },
  { k: 'w', cursor: 'ew-resize', pos: { left: -5, top: 'calc(50% - 5px)' } },
];

const PALETTE = [
  '#111827',
  '#ffffff',
  '#ef4444',
  '#f97316',
  '#eab308',
  '#22c55e',
  '#14b8a6',
  '#0ea5e9',
  '#3b82f6',
  '#8b5cf6',
  '#ec4899',
  '#78716c',
];
const BLENDS: { v: string; l: string }[] = [
  { v: 'normal', l: 'Normal' },
  { v: 'multiply', l: 'Produit' },
  { v: 'screen', l: 'Superposition' },
  { v: 'overlay', l: 'Incrustation' },
  { v: 'darken', l: 'Obscurcir' },
  { v: 'lighten', l: 'Éclaircir' },
  { v: 'color-dodge', l: 'Densité couleur −' },
  { v: 'color-burn', l: 'Densité couleur +' },
  { v: 'hard-light', l: 'Lumière crue' },
  { v: 'soft-light', l: 'Lumière tamisée' },
  { v: 'difference', l: 'Différence' },
  { v: 'exclusion', l: 'Exclusion' },
  { v: 'hue', l: 'Teinte' },
  { v: 'saturation', l: 'Saturation' },
  { v: 'color', l: 'Couleur' },
  { v: 'luminosity', l: 'Luminosité' },
];
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2));
const clamp01 = (n: number) => Math.max(0, Math.min(1, n));
const newLayer = (name: string): Layer => ({
  id: uid(),
  name,
  visible: true,
  opacity: 1,
  blend: 'normal',
  locked: false,
});

/* ---------- Couleurs (HSV / hex / rgb) ---------- */
function hexToRgb(hex: string) {
  const m = hex.replace('#', '');
  const n =
    m.length === 3
      ? m
          .split('')
          .map((c) => c + c)
          .join('')
      : m;
  const i = parseInt(n || '0', 16);
  return { r: (i >> 16) & 255, g: (i >> 8) & 255, b: i & 255 };
}
function rgbToHex(r: number, g: number, b: number) {
  return (
    '#' +
    [r, g, b]
      .map((v) =>
        Math.max(0, Math.min(255, Math.round(v)))
          .toString(16)
          .padStart(2, '0'),
      )
      .join('')
  );
}
function rgbToHsv(r: number, g: number, b: number) {
  r /= 255;
  g /= 255;
  b /= 255;
  const mx = Math.max(r, g, b),
    mn = Math.min(r, g, b),
    d = mx - mn;
  let h = 0;
  if (d) {
    if (mx === r) h = ((g - b) / d) % 6;
    else if (mx === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h, s: mx ? d / mx : 0, v: mx };
}
function hsvToRgb(h: number, s: number, v: number) {
  const c = v * s,
    x = c * (1 - Math.abs(((h / 60) % 2) - 1)),
    m = v - c;
  let r = 0,
    g = 0,
    b = 0;
  if (h < 60) {
    r = c;
    g = x;
  } else if (h < 120) {
    r = x;
    g = c;
  } else if (h < 180) {
    g = c;
    b = x;
  } else if (h < 240) {
    g = x;
    b = c;
  } else if (h < 300) {
    r = x;
    b = c;
  } else {
    r = c;
    b = x;
  }
  return { r: (r + m) * 255, g: (g + m) * 255, b: (b + m) * 255 };
}

/* ---------- Color picker (type Photoshop) ---------- */
function ColorPicker({
  color,
  onChange,
  onClose,
}: {
  color: string;
  onChange: (hex: string) => void;
  onClose: () => void;
}) {
  const i0 = rgbToHsv(hexToRgb(color).r, hexToRgb(color).g, hexToRgb(color).b);
  const [h, setH] = useState(i0.h);
  const [s, setS] = useState(i0.s);
  const [v, setV] = useState(i0.v);
  const rgb = hsvToRgb(h, s, v);
  const hex = rgbToHex(rgb.r, rgb.g, rgb.b);
  useEffect(() => {
    onChange(hex);
  }, [hex, onChange]);
  const svRef = useRef<HTMLDivElement>(null);
  const hueRef = useRef<HTMLDivElement>(null);
  const drag = (fn: (e: PointerEvent | React.PointerEvent) => void) => (e: React.PointerEvent) => {
    fn(e);
    const mv = (ev: PointerEvent) => fn(ev);
    const up = () => {
      window.removeEventListener('pointermove', mv);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', mv);
    window.addEventListener('pointerup', up);
  };
  const onSV = (e: PointerEvent | React.PointerEvent) => {
    const r = svRef.current!.getBoundingClientRect();
    setS(clamp01((e.clientX - r.left) / r.width));
    setV(1 - clamp01((e.clientY - r.top) / r.height));
  };
  const onHue = (e: PointerEvent | React.PointerEvent) => {
    const r = hueRef.current!.getBoundingClientRect();
    setH(clamp01((e.clientY - r.top) / r.height) * 360);
  };
  const setFromHex = (hx: string) => {
    if (!/^#?[0-9a-fA-F]{6}$/.test(hx)) return;
    const c = hexToRgb(hx);
    const hv = rgbToHsv(c.r, c.g, c.b);
    setH(hv.h);
    setS(hv.s);
    setV(hv.v);
  };
  const setRgb = (r: number, g: number, b: number) => {
    const hv = rgbToHsv(r, g, b);
    setH(hv.h);
    setS(hv.s);
    setV(hv.v);
  };
  return (
    <div
      className="absolute left-2 top-12 z-50 w-64 rounded-xl border border-border bg-surface p-3 shadow-2xl"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex gap-2">
        <div
          ref={svRef}
          onPointerDown={drag(onSV)}
          className="relative h-40 flex-1 cursor-crosshair rounded-lg"
          style={{
            backgroundColor: `hsl(${h},100%,50%)`,
            backgroundImage:
              'linear-gradient(to right,#fff,rgba(255,255,255,0)),linear-gradient(to top,#000,rgba(0,0,0,0))',
          }}
        >
          <div
            className="pointer-events-none absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow"
            style={{ left: `${s * 100}%`, top: `${(1 - v) * 100}%` }}
          />
        </div>
        <div
          ref={hueRef}
          onPointerDown={drag(onHue)}
          className="relative h-40 w-4 cursor-ns-resize rounded"
          style={{
            backgroundImage: 'linear-gradient(to bottom,#f00,#ff0,#0f0,#0ff,#00f,#f0f,#f00)',
          }}
        >
          <div
            className="pointer-events-none absolute left-1/2 h-1.5 w-6 -translate-x-1/2 -translate-y-1/2 rounded-sm border border-white bg-black/20 shadow"
            style={{ top: `${(h / 360) * 100}%` }}
          />
        </div>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <div
          className="h-8 w-8 shrink-0 rounded-md border border-border"
          style={{ background: hex }}
        />
        <input
          value={hex}
          onChange={(e) => setFromHex(e.target.value)}
          className="w-20 rounded-md border border-border bg-surface px-2 py-1 font-mono text-xs outline-none focus:border-accent"
        />
        {(['r', 'g', 'b'] as const).map((k, i) => (
          <input
            key={k}
            type="number"
            min={0}
            max={255}
            value={Math.round([rgb.r, rgb.g, rgb.b][i]!)}
            onChange={(e) => {
              const val = Math.max(0, Math.min(255, Number(e.target.value)));
              const arr = [Math.round(rgb.r), Math.round(rgb.g), Math.round(rgb.b)];
              arr[i] = val;
              setRgb(arr[0]!, arr[1]!, arr[2]!);
            }}
            className="w-12 rounded-md border border-border bg-surface px-1 py-1 text-xs outline-none focus:border-accent"
          />
        ))}
      </div>
      <div className="mt-2 grid grid-cols-12 gap-1">
        {PALETTE.map((c) => (
          <button
            key={c}
            onClick={() => setFromHex(c)}
            className="h-4 w-full rounded border border-border"
            style={{ background: c }}
          />
        ))}
      </div>
      <button
        onClick={onClose}
        className="mt-3 w-full rounded-lg bg-foreground py-1.5 text-xs font-semibold text-white hover:bg-accent"
      >
        Fermer
      </button>
    </div>
  );
}

/* ---------- Icônes d'outils ---------- */
function Ico({ tool }: { tool: Tool | 'undo' | 'redo' | 'clear' }) {
  const c = {
    fill: 'none' as const,
    stroke: 'currentColor',
    strokeWidth: 1.9,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };
  const s = 20;
  switch (tool) {
    case 'move':
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" {...c}>
          <path d="M12 3v18M3 12h18M12 3l-3 3M12 3l3 3M12 21l-3-3M12 21l3-3M3 12l3-3M3 12l3 3M21 12l-3-3M21 12l-3 3" />
        </svg>
      );
    case 'pencil':
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" {...c}>
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
        </svg>
      );
    case 'eraser':
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" {...c}>
          <path d="M20 20H8.5L3 14.5a2 2 0 0 1 0-2.8l7-7a2 2 0 0 1 2.8 0l6 6a2 2 0 0 1 0 2.8L14 20" />
        </svg>
      );
    case 'line':
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" {...c}>
          <path d="M5 19 19 5" />
        </svg>
      );
    case 'rect':
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" {...c}>
          <rect x="4" y="6" width="16" height="12" rx="1.5" />
        </svg>
      );
    case 'ellipse':
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" {...c}>
          <ellipse cx="12" cy="12" rx="9" ry="6.5" />
        </svg>
      );
    case 'arrow':
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" {...c}>
          <path d="M5 19 19 5M12 5h7v7" />
        </svg>
      );
    case 'text':
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" {...c}>
          <path d="M5 6h14M12 6v13M9 19h6" />
        </svg>
      );
    case 'undo':
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" {...c}>
          <path d="M9 14 4 9l5-5" />
          <path d="M4 9h11a5 5 0 0 1 0 10h-4" />
        </svg>
      );
    case 'redo':
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" {...c}>
          <path d="m15 14 5-5-5-5" />
          <path d="M20 9H9a5 5 0 0 0 0 10h4" />
        </svg>
      );
    case 'clear':
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" {...c}>
          <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
        </svg>
      );
  }
}
const TOOLS: { id: Tool; label: string }[] = [
  { id: 'move', label: 'Déplacer' },
  { id: 'pencil', label: 'Crayon' },
  { id: 'eraser', label: 'Gomme' },
  { id: 'line', label: 'Ligne' },
  { id: 'rect', label: 'Rectangle' },
  { id: 'ellipse', label: 'Ellipse' },
  { id: 'arrow', label: 'Flèche' },
  { id: 'text', label: 'Texte' },
];

// Bibliothèque de stencils (icônes vectorielles recolorées → matricées en PNG transparent sur le calque).
const STENCIL_GROUPS = ['Infrastructure', 'Réseau', 'Général'] as const;
const STENCILS: { key: string; label: string; group: string; inner: string }[] = [
  {
    key: 'server',
    label: 'Serveur',
    group: 'Infrastructure',
    inner:
      '<rect x="4" y="3" width="16" height="8" rx="1.5"/><rect x="4" y="13" width="16" height="8" rx="1.5"/><path d="M8 7h.01M8 17h.01M12 7h6M12 17h6"/>',
  },
  {
    key: 'monitor',
    label: 'Écran / PC',
    group: 'Infrastructure',
    inner: '<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>',
  },
  {
    key: 'tower',
    label: 'Tour PC',
    group: 'Infrastructure',
    inner:
      '<rect x="6" y="2" width="12" height="20" rx="2"/><path d="M10 6h4M10 9h4"/><circle cx="12" cy="17" r="1.5"/>',
  },
  {
    key: 'laptop',
    label: 'Portable',
    group: 'Infrastructure',
    inner:
      '<rect x="4" y="4" width="16" height="12" rx="1.5"/><path d="M2 20h20"/><path d="M4 16l-2 4M20 16l2 4"/>',
  },
  {
    key: 'database',
    label: 'Base de données',
    group: 'Infrastructure',
    inner:
      '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v6c0 1.66 3.58 3 8 3s8-1.34 8-3V5"/><path d="M4 11v6c0 1.66 3.58 3 8 3s8-1.34 8-3v-6"/>',
  },
  {
    key: 'hdd',
    label: 'Disque',
    group: 'Infrastructure',
    inner:
      '<rect x="2" y="7" width="20" height="10" rx="2"/><circle cx="17" cy="12" r="1.2"/><path d="M6 17v2M18 17v2M6 7V5"/>',
  },
  {
    key: 'cloud',
    label: 'Cloud',
    group: 'Infrastructure',
    inner: '<path d="M7 18a4.5 4.5 0 0 1-.5-9A6 6 0 0 1 18 8.5a4 4 0 0 1-.5 9.5z"/>',
  },
  {
    key: 'globe',
    label: 'Internet',
    group: 'Infrastructure',
    inner:
      '<circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3c2.5 2.5 3.5 5.5 3.5 9s-1 6.5-3.5 9c-2.5-2.5-3.5-5.5-3.5-9s1-6.5 3.5-9z"/>',
  },
  {
    key: 'router',
    label: 'Routeur',
    group: 'Réseau',
    inner:
      '<rect x="3" y="14" width="18" height="6" rx="1.5"/><path d="M7 17h.01M11 17h.01"/><path d="M16 14v-2M16 12l3-3M16 12l-3-3"/>',
  },
  {
    key: 'switch',
    label: 'Switch',
    group: 'Réseau',
    inner:
      '<rect x="2" y="9" width="20" height="6" rx="1.5"/><path d="M6 12h2M10 12h2M14 12h2M18 12h.5"/>',
  },
  {
    key: 'wifi',
    label: 'Wi-Fi',
    group: 'Réseau',
    inner:
      '<path d="M4.5 12a11 11 0 0 1 15 0"/><path d="M8 15.5a6 6 0 0 1 8 0"/><path d="M12 19h.01"/>',
  },
  {
    key: 'firewall',
    label: 'Pare-feu',
    group: 'Réseau',
    inner:
      '<rect x="3" y="4" width="18" height="16" rx="1.5"/><path d="M3 9.3h18M3 14.6h18M9 4v5.3M15 9.3v5.3M9 14.6V20M15 4v5.3"/>',
  },
  {
    key: 'shield',
    label: 'Sécurité',
    group: 'Réseau',
    inner: '<path d="M12 3l8 3v5.5c0 4.7-3.4 8.2-8 9.5-4.6-1.3-8-4.8-8-9.5V6z"/>',
  },
  {
    key: 'antenna',
    label: 'Antenne',
    group: 'Réseau',
    inner:
      '<path d="M12 21V8"/><path d="M8.5 21h7"/><path d="M6 8a8 8 0 0 1 12 0"/><path d="M8.5 8a5 5 0 0 1 7 0"/>',
  },
  {
    key: 'ethernet',
    label: 'Ethernet',
    group: 'Réseau',
    inner:
      '<rect x="4" y="8" width="16" height="9" rx="1.5"/><path d="M8 8V6h8v2"/><path d="M8 17v2M12 17v2M16 17v2"/>',
  },
  {
    key: 'link',
    label: 'Connexion',
    group: 'Réseau',
    inner:
      '<path d="M9.5 14.5 14.5 9.5"/><path d="M8 11 6 13a3.5 3.5 0 0 0 5 5l2-2"/><path d="M16 13l2-2a3.5 3.5 0 0 0-5-5l-2 2"/>',
  },
  {
    key: 'user',
    label: 'Utilisateur',
    group: 'Général',
    inner: '<circle cx="12" cy="8" r="4"/><path d="M4 20a8 8 0 0 1 16 0"/>',
  },
  {
    key: 'users',
    label: 'Groupe',
    group: 'Général',
    inner:
      '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 19a6.5 6.5 0 0 1 13 0"/><path d="M16 5a3.5 3.5 0 0 1 0 7"/><path d="M18.5 19a6.5 6.5 0 0 0-2.2-4.9"/>',
  },
  {
    key: 'mobile',
    label: 'Mobile',
    group: 'Général',
    inner: '<rect x="7" y="2" width="10" height="20" rx="2.5"/><path d="M11 18h2"/>',
  },
  {
    key: 'printer',
    label: 'Imprimante',
    group: 'Général',
    inner:
      '<path d="M6 9V3h12v6"/><rect x="3" y="9" width="18" height="8" rx="1.5"/><path d="M7 17h10v4H7z"/><path d="M17 12.5h.01"/>',
  },
  {
    key: 'folder',
    label: 'Dossier',
    group: 'Général',
    inner:
      '<path d="M3 7a2 2 0 0 1 2-2h3.5l2 2H19a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  },
  {
    key: 'lock',
    label: 'Verrou',
    group: 'Général',
    inner: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  },
  {
    key: 'key',
    label: 'Clé',
    group: 'Général',
    inner: '<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9"/><path d="M17 6l2 2M14 9l2 2"/>',
  },
  {
    key: 'mail',
    label: 'E-mail',
    group: 'Général',
    inner: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
  },
  {
    key: 'terminal',
    label: 'Terminal',
    group: 'Général',
    inner: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="m7 9 3 3-3 3M13 15h4"/>',
  },
  {
    key: 'gear',
    label: 'Réglages',
    group: 'Général',
    inner:
      '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>',
  },
  {
    key: 'alert',
    label: 'Alerte',
    group: 'Général',
    inner: '<path d="M12 3 2 20h20z"/><path d="M12 10v4"/><path d="M12 17h.01"/>',
  },
  {
    key: 'clock',
    label: 'Horloge',
    group: 'Général',
    inner: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  },
];

export function Draw() {
  const containerRef = useRef<HTMLDivElement>(null);
  const stackRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const topRulerRef = useRef<HTMLCanvasElement>(null);
  const leftRulerRef = useRef<HTMLCanvasElement>(null);
  const canvasMap = useRef<Map<string, HTMLCanvasElement>>(new Map());
  const drawingRef = useRef(false);
  const startRef = useRef<{ x: number; y: number } | null>(null);
  const lastRef = useRef<{ x: number; y: number } | null>(null);
  const moveSnapRef = useRef<HTMLCanvasElement | null>(null);
  const undoRef = useRef<{ layerId: string; img: ImageData }[]>([]);
  const redoRef = useRef<{ layerId: string; img: ImageData }[]>([]);
  const pendingRef = useRef<Map<string, string>>(new Map());
  const thumbsRef = useRef<Map<string, string>>(new Map());
  const dragLayerRef = useRef<string | null>(null);
  const dragIconRef = useRef<string | null>(null);
  const stencilCache = useRef<Map<string, HTMLCanvasElement>>(new Map());
  const boxRef = useRef<HTMLDivElement>(null);
  const dragObjRef = useRef<{
    mode: string;
    sx: number;
    sy: number;
    st: Stencil;
    id: string;
  } | null>(null);
  const liveRectRef = useRef<Stencil | null>(null);

  const [layers, setLayers] = useState<Layer[]>([newLayer('Calque 1')]);
  const [activeId, setActiveId] = useState<string>('');
  const [tool, setTool] = useState<Tool>('pencil');
  const [color, setColor] = useState('#111827');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [fill, setFill] = useState(false);
  const [size, setSize] = useState(4);
  const [name, setName] = useState('Sans titre');
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [list, setList] = useState<Drawing[]>([]);
  const [gallery, setGallery] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [rulers, setRulers] = useState(true);
  const [library, setLibrary] = useState(false);
  const [cacheTick, setCacheTick] = useState(0);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [restoreTick, setRestoreTick] = useState(0);
  const [thumbTick, setThumbTick] = useState(0);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  useEffect(() => {
    if (layers.length && !layers.some((l) => l.id === activeId))
      setActiveId(layers[layers.length - 1]!.id);
  }, [layers, activeId]);

  const setCanvasRef = (id: string) => (el: HTMLCanvasElement | null) => {
    if (el) canvasMap.current.set(id, el);
    else canvasMap.current.delete(id);
  };
  const ctxOf = (id: string) => canvasMap.current.get(id)?.getContext('2d') ?? null;
  const activeLayer = layers.find((l) => l.id === activeId);
  const activeCtx = () => ctxOf(activeId);

  const refreshThumbs = useCallback(() => {
    for (const l of layers) {
      const cv = canvasMap.current.get(l.id);
      if (!cv) continue;
      const t = document.createElement('canvas');
      t.width = 56;
      t.height = 35;
      const x = t.getContext('2d')!;
      x.clearRect(0, 0, 56, 35);
      x.drawImage(cv, 0, 0, 56, 35);
      thumbsRef.current.set(l.id, t.toDataURL('image/png'));
    }
    setThumbTick((t) => t + 1);
  }, [layers]);

  const refreshList = useCallback(() => {
    fetch('/api/draw')
      .then((r) => r.json())
      .then((j) => setList(j.drawings ?? []))
      .catch(() => {});
  }, []);
  useEffect(() => {
    refreshList();
  }, [refreshList]);

  /* ----- Règles ----- */
  const clampZoom = (z: number) => Math.min(5, Math.max(0.2, z));
  const drawRulers = useCallback(() => {
    if (!rulers) return;
    const cont = containerRef.current,
      stack = stackRef.current;
    if (!cont || !stack) return;
    const cr = cont.getBoundingClientRect(),
      sr = stack.getBoundingClientRect();
    const offX = sr.left - cr.left,
      offY = sr.top - cr.top;
    let step = 50;
    while (step * zoom < 48) step *= 2;
    while (step * zoom > 140 && step > 5) step /= 2;
    const paint = (
      cv: HTMLCanvasElement | null,
      axis: 'x' | 'y',
      off: number,
      len: number,
      max: number,
    ) => {
      if (!cv) return;
      cv.width = axis === 'x' ? Math.max(1, cv.clientWidth) : RULER;
      cv.height = axis === 'x' ? RULER : Math.max(1, cv.clientHeight);
      const ctx = cv.getContext('2d')!;
      ctx.fillStyle = '#f2f3f5';
      ctx.fillRect(0, 0, cv.width, cv.height);
      ctx.strokeStyle = '#cbd0d8';
      ctx.fillStyle = '#8a8f99';
      ctx.font = '9px system-ui,sans-serif';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let c = 0; c <= max; c += step) {
        const sc = off + c * zoom;
        if (sc < -30 || sc > len + 30) continue;
        if (axis === 'x') {
          ctx.moveTo(sc + 0.5, RULER);
          ctx.lineTo(sc + 0.5, RULER - 8);
          ctx.fillText(String(c), sc + 2, 9);
        } else {
          ctx.moveTo(RULER, sc + 0.5);
          ctx.lineTo(RULER - 8, sc + 0.5);
          ctx.save();
          ctx.translate(9, sc - 2);
          ctx.rotate(-Math.PI / 2);
          ctx.fillText(String(c), 0, 0);
          ctx.restore();
        }
      }
      ctx.stroke();
    };
    paint(topRulerRef.current, 'x', offX, cont.clientWidth, W);
    paint(leftRulerRef.current, 'y', offY, cont.clientHeight, H);
  }, [rulers, zoom]);
  useEffect(() => {
    drawRulers();
  }, [drawRulers, zoom, rulers, layers, restoreTick]);
  useEffect(() => {
    const on = () => drawRulers();
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, [drawRulers]);
  const fit = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    setZoom(clampZoom(Math.min((el.clientWidth - 48) / W, (el.clientHeight - 48) / H)));
  }, []);
  useEffect(() => {
    fit();
  }, [fit]);
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      setZoom((z) => clampZoom(z * (e.deltaY < 0 ? 1.1 : 0.9)));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  /* ----- Restauration (ouverture) ----- */
  useEffect(() => {
    if (!pendingRef.current.size) return;
    let remaining = pendingRef.current.size;
    pendingRef.current.forEach((src, id) => {
      const cv = canvasMap.current.get(id);
      if (!cv) {
        remaining--;
        return;
      }
      const ctx = cv.getContext('2d')!;
      const img = new Image();
      img.onload = () => {
        ctx.clearRect(0, 0, W, H);
        ctx.drawImage(img, 0, 0, W, H);
        if (--remaining <= 0) {
          refreshThumbs();
          drawRulers();
        }
      };
      img.onerror = () => {
        if (--remaining <= 0) refreshThumbs();
      };
      img.src = src;
      pendingRef.current.delete(id);
    });
  }, [layers, restoreTick, drawRulers, refreshThumbs]);

  /* ----- Undo/redo ----- */
  function pushUndo(id: string) {
    const ctx = ctxOf(id);
    if (!ctx) return;
    undoRef.current.push({ layerId: id, img: ctx.getImageData(0, 0, W, H) });
    if (undoRef.current.length > 30) undoRef.current.shift();
    redoRef.current = [];
    setCanUndo(true);
    setCanRedo(false);
  }
  const undo = useCallback(() => {
    const e = undoRef.current.pop();
    if (!e) return;
    const ctx = ctxOf(e.layerId);
    if (ctx) {
      redoRef.current.push({ layerId: e.layerId, img: ctx.getImageData(0, 0, W, H) });
      ctx.putImageData(e.img, 0, 0);
    }
    setCanUndo(undoRef.current.length > 0);
    setCanRedo(true);
    setDirty(true);
    refreshThumbs();
  }, [refreshThumbs]);
  const redo = useCallback(() => {
    const e = redoRef.current.pop();
    if (!e) return;
    const ctx = ctxOf(e.layerId);
    if (ctx) {
      undoRef.current.push({ layerId: e.layerId, img: ctx.getImageData(0, 0, W, H) });
      ctx.putImageData(e.img, 0, 0);
    }
    setCanRedo(redoRef.current.length > 0);
    setCanUndo(true);
    setDirty(true);
    refreshThumbs();
  }, [refreshThumbs]);

  /* ----- Dessin ----- */
  const pos = (e: React.PointerEvent) => {
    const r = overlayRef.current!.getBoundingClientRect();
    return { x: (e.clientX - r.left) * (W / r.width), y: (e.clientY - r.top) * (H / r.height) };
  };
  function drawArrow(
    ctx: CanvasRenderingContext2D,
    s: { x: number; y: number },
    p: { x: number; y: number },
  ) {
    ctx.beginPath();
    ctx.moveTo(s.x, s.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    const a = Math.atan2(p.y - s.y, p.x - s.x);
    const L = Math.max(12, size * 3.2);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x - L * Math.cos(a - 0.42), p.y - L * Math.sin(a - 0.42));
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x - L * Math.cos(a + 0.42), p.y - L * Math.sin(a + 0.42));
    ctx.stroke();
  }
  function drawShape(
    ctx: CanvasRenderingContext2D,
    t: Tool,
    s: { x: number; y: number },
    p: { x: number; y: number },
  ) {
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = size;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    if (t === 'line') {
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
    } else if (t === 'rect') {
      const x = Math.min(s.x, p.x),
        y = Math.min(s.y, p.y),
        w = Math.abs(p.x - s.x),
        hh = Math.abs(p.y - s.y);
      if (fill) ctx.fillRect(x, y, w, hh);
      ctx.strokeRect(x, y, w, hh);
    } else if (t === 'ellipse') {
      const cx = (s.x + p.x) / 2,
        cy = (s.y + p.y) / 2,
        rx = Math.abs(p.x - s.x) / 2,
        ry = Math.abs(p.y - s.y) / 2;
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
      if (fill) ctx.fill();
      ctx.stroke();
    } else if (t === 'arrow') drawArrow(ctx, s, p);
  }
  const isShape = (t: Tool) => t === 'line' || t === 'rect' || t === 'ellipse' || t === 'arrow';

  function onDown(e: React.PointerEvent) {
    const p = pos(e);
    if (tool === 'move') {
      // sélection d'un objet stencil (du plus haut au plus bas)
      for (let i = layers.length - 1; i >= 0; i--) {
        const l = layers[i]!;
        if (l.stencil && l.visible && !l.locked) {
          const s = l.stencil;
          if (p.x >= s.x && p.x <= s.x + s.w && p.y >= s.y && p.y <= s.y + s.h) {
            if (l.id !== activeId) setActiveId(l.id);
            return;
          }
        }
      }
      if (activeLayer?.stencil) return; // objet actif : manipulé via la boîte à poignées
      const ctx0 = activeCtx();
      if (!ctx0 || activeLayer?.locked) return;
      drawingRef.current = true;
      startRef.current = p;
      lastRef.current = p;
      pushUndo(activeId);
      const src = document.createElement('canvas');
      src.width = W;
      src.height = H;
      src.getContext('2d')!.drawImage(canvasMap.current.get(activeId)!, 0, 0);
      moveSnapRef.current = src;
      overlayRef.current!.setPointerCapture?.(e.pointerId);
      return;
    }
    const ctx = activeCtx();
    if (!ctx || activeLayer?.locked) return;
    if (tool === 'text') {
      const t = window.prompt('Texte à écrire :');
      if (!t) return;
      pushUndo(activeId);
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = color;
      ctx.textBaseline = 'top';
      ctx.font = `${Math.max(12, size * 6)}px system-ui,-apple-system,sans-serif`;
      ctx.fillText(t, p.x, p.y);
      setDirty(true);
      refreshThumbs();
      return;
    }
    drawingRef.current = true;
    startRef.current = p;
    lastRef.current = p;
    if (tool === 'pencil' || tool === 'eraser') {
      pushUndo(activeId);
      ctx.globalCompositeOperation = tool === 'eraser' ? 'destination-out' : 'source-over';
      ctx.strokeStyle = color;
      ctx.lineWidth = tool === 'eraser' ? size * 3 : size;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x + 0.01, p.y);
      ctx.stroke();
    }
    overlayRef.current!.setPointerCapture?.(e.pointerId);
  }
  function onMove(e: React.PointerEvent) {
    if (!drawingRef.current) return;
    const p = pos(e);
    lastRef.current = p;
    const s = startRef.current!;
    const ctx = activeCtx();
    if (!ctx) return;
    if (tool === 'move' && moveSnapRef.current) {
      ctx.clearRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'source-over';
      ctx.drawImage(moveSnapRef.current, p.x - s.x, p.y - s.y);
    } else if (tool === 'pencil' || tool === 'eraser') {
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
    } else if (isShape(tool)) {
      const ov = overlayRef.current!.getContext('2d')!;
      ov.clearRect(0, 0, W, H);
      drawShape(ov, tool, s, p);
    }
  }
  function onUp() {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    const ctx = activeCtx();
    const s = startRef.current;
    const p = lastRef.current;
    if (ctx && s && p && isShape(tool)) {
      pushUndo(activeId);
      ctx.globalCompositeOperation = 'source-over';
      drawShape(ctx, tool, s, p);
    }
    if (ctx) ctx.globalCompositeOperation = 'source-over';
    moveSnapRef.current = null;
    overlayRef.current!.getContext('2d')!.clearRect(0, 0, W, H);
    setDirty(true);
    refreshThumbs();
  }

  /* ----- Bibliothèque de stencils (objets sur calques dédiés) ----- */
  // Rasterise le SVG en haute résolution (mise en cache) puis rend le calque.
  function rasterizeStencil(id: string, inner: string, col: string) {
    const R = 512;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${R}" height="${R}" viewBox="0 0 24 24" fill="none" stroke="${col}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
    const img = new Image();
    img.onload = () => {
      const cv = document.createElement('canvas');
      cv.width = R;
      cv.height = R;
      cv.getContext('2d')!.drawImage(img, 0, 0, R, R);
      stencilCache.current.set(id, cv);
      URL.revokeObjectURL(url);
      setCacheTick((t) => t + 1);
    };
    img.src = url;
  }
  function renderStencil(id: string, rect: Stencil) {
    const cache = stencilCache.current.get(id);
    const cv = canvasMap.current.get(id);
    if (!cache || !cv) return;
    const ctx = cv.getContext('2d')!;
    ctx.clearRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(cache, rect.x, rect.y, rect.w, rect.h);
  }
  // (Re)dessine tous les stencils quand les calques changent ou qu'un cache devient prêt.
  useEffect(() => {
    if (dragObjRef.current) return;
    for (const l of layers)
      if (l.stencil && stencilCache.current.has(l.id)) renderStencil(l.id, l.stencil);
    refreshThumbs();
  }, [layers, cacheTick]);

  function placeStencil(inner: string, cx: number, cy: number, sz = 130) {
    const nid = uid();
    const label = STENCILS.find((s) => s.inner === inner)?.label || 'Image';
    const st: Stencil = { inner, color, x: cx - sz / 2, y: cy - sz / 2, w: sz, h: sz };
    setLayers((ls) => [...ls, { ...newLayer(label), id: nid, stencil: st }]);
    setActiveId(nid);
    setTool('move');
    rasterizeStencil(nid, inner, color);
    setDirty(true);
  }
  function onDropIcon(e: React.DragEvent) {
    e.preventDefault();
    const key = dragIconRef.current;
    dragIconRef.current = null;
    const st = STENCILS.find((s) => s.key === key);
    if (!st) return;
    const r = overlayRef.current!.getBoundingClientRect();
    placeStencil(
      st.inner,
      (e.clientX - r.left) * (W / r.width),
      (e.clientY - r.top) * (H / r.height),
    );
  }

  // Déplacement / redimensionnement de l'objet stencil actif (boîte HTML à poignées).
  function objDown(e: React.PointerEvent, mode: string) {
    e.preventDefault();
    e.stopPropagation();
    const l = layers.find((x) => x.id === activeId);
    if (!l?.stencil) return;
    dragObjRef.current = { mode, sx: e.clientX, sy: e.clientY, st: { ...l.stencil }, id: activeId };
    window.addEventListener('pointermove', objMove);
    window.addEventListener('pointerup', objUp);
  }
  function objMove(e: PointerEvent) {
    const d = dragObjRef.current;
    if (!d) return;
    const k = 1 / zoom;
    const dx = (e.clientX - d.sx) * k;
    const dy = (e.clientY - d.sy) * k;
    let { x, y, w, h } = d.st;
    if (d.mode === 'move') {
      x += dx;
      y += dy;
    } else {
      const m = d.mode;
      if (m.includes('w')) {
        x += dx;
        w -= dx;
      }
      if (m.includes('e')) {
        w += dx;
      }
      if (m.includes('n')) {
        y += dy;
        h -= dy;
      }
      if (m.includes('s')) {
        h += dy;
      }
    }
    w = Math.max(16, w);
    h = Math.max(16, h);
    const rect: Stencil = { ...d.st, x, y, w, h };
    liveRectRef.current = rect;
    renderStencil(d.id, rect);
    if (boxRef.current) {
      const b = boxRef.current.style;
      b.left = `${x * zoom}px`;
      b.top = `${y * zoom}px`;
      b.width = `${w * zoom}px`;
      b.height = `${h * zoom}px`;
    }
  }
  function objUp() {
    const d = dragObjRef.current;
    dragObjRef.current = null;
    window.removeEventListener('pointermove', objMove);
    window.removeEventListener('pointerup', objUp);
    const rect = liveRectRef.current;
    liveRectRef.current = null;
    if (d && rect) {
      setLayers((ls) => ls.map((l) => (l.id === d.id ? { ...l, stencil: rect } : l)));
      setDirty(true);
      refreshThumbs();
    }
  }

  /* ----- Calques ----- */
  function addLayer() {
    const l = newLayer(`Calque ${layers.length + 1}`);
    setLayers((ls) => [...ls, l]);
    setActiveId(l.id);
    setDirty(true);
  }
  function deleteLayer(id: string) {
    setLayers((ls) => (ls.length <= 1 ? ls : ls.filter((l) => l.id !== id)));
    setDirty(true);
  }
  function moveLayer(id: string, dir: -1 | 1) {
    setLayers((ls) => {
      const i = ls.findIndex((l) => l.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= ls.length) return ls;
      const c = [...ls];
      [c[i], c[j]] = [c[j]!, c[i]!];
      return c;
    });
    setDirty(true);
  }
  function duplicateLayer(id: string) {
    const nid = uid();
    const i = layers.findIndex((l) => l.id === id);
    const base = layers.find((l) => l.id === id)!;
    if (base.stencil) {
      const st: Stencil = { ...base.stencil, x: base.stencil.x + 20, y: base.stencil.y + 20 };
      setLayers((ls) => {
        const c = [...ls];
        c.splice(i + 1, 0, { ...base, id: nid, name: `${base.name} copie`, stencil: st });
        return c;
      });
      rasterizeStencil(nid, st.inner, st.color);
    } else {
      const src = canvasMap.current.get(id);
      if (!src) return;
      pendingRef.current.set(nid, src.toDataURL('image/png'));
      setLayers((ls) => {
        const c = [...ls];
        c.splice(i + 1, 0, { ...base, id: nid, name: `${base.name} copie` });
        return c;
      });
      setRestoreTick((t) => t + 1);
    }
    setActiveId(nid);
    setDirty(true);
  }
  const patchLayer = (id: string, p: Partial<Layer>) => {
    setLayers((ls) => ls.map((l) => (l.id === id ? { ...l, ...p } : l)));
    setDirty(true);
  };
  function reorder(srcId: string, targetId: string, after: boolean) {
    if (srcId === targetId) return;
    setLayers((ls) => {
      const arr = [...ls];
      const from = arr.findIndex((l) => l.id === srcId);
      const item = arr.splice(from, 1)[0]!;
      let to = arr.findIndex((l) => l.id === targetId);
      if (to < 0) return ls;
      to = after ? to + 1 : to;
      arr.splice(to, 0, item);
      return arr;
    });
    setDirty(true);
  }
  function mergeDown(id: string) {
    const i = layers.findIndex((l) => l.id === id);
    if (i <= 0) return;
    const below = layers[i - 1]!;
    const top = layers[i]!;
    const bc = canvasMap.current.get(below.id),
      tc = canvasMap.current.get(top.id);
    if (!bc || !tc) return;
    pushUndo(below.id);
    const bx = bc.getContext('2d')!;
    bx.save();
    bx.globalAlpha = top.opacity;
    bx.globalCompositeOperation = (
      top.blend === 'normal' ? 'source-over' : top.blend
    ) as GlobalCompositeOperation;
    bx.drawImage(tc, 0, 0);
    bx.restore();
    setLayers((ls) => ls.filter((l) => l.id !== top.id));
    setActiveId(below.id);
    setDirty(true);
    setTimeout(refreshThumbs, 50);
  }
  function flattenLayers() {
    if (!window.confirm('Aplatir tous les calques en un seul ?')) return;
    const c = flatten();
    const nid = uid();
    pendingRef.current.set(nid, c.toDataURL('image/png'));
    setLayers([newLayer('Fond')].map((l) => ({ ...l, id: nid, name: 'Fond' })));
    setActiveId(nid);
    setRestoreTick((t) => t + 1);
    setDirty(true);
  }

  /* ----- Aplatir / enregistrer / charger ----- */
  function flatten(): HTMLCanvasElement {
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    const x = c.getContext('2d')!;
    x.fillStyle = '#ffffff';
    x.fillRect(0, 0, W, H);
    for (const l of layers) {
      if (!l.visible) continue;
      const cv = canvasMap.current.get(l.id);
      if (!cv) continue;
      x.globalAlpha = l.opacity;
      x.globalCompositeOperation = (
        l.blend === 'normal' ? 'source-over' : l.blend
      ) as GlobalCompositeOperation;
      x.drawImage(cv, 0, 0);
    }
    x.globalAlpha = 1;
    x.globalCompositeOperation = 'source-over';
    return c;
  }
  async function save() {
    setSaving('saving');
    const blob = await new Promise<Blob | null>((res) => flatten().toBlob(res, 'image/png'));
    if (!blob) {
      setSaving('idle');
      return;
    }
    const fd = new FormData();
    fd.append('name', name || 'dessin');
    fd.append('file', blob, `${name || 'dessin'}.png`);
    const res = await fetch('/api/draw', { method: 'POST', body: fd })
      .then((r) => r.json())
      .catch(() => null);
    if (res?.error) {
      alert(res.error);
      setSaving('idle');
      return;
    }
    const project = layers.map((l) => ({
      name: l.name,
      visible: l.visible,
      opacity: l.opacity,
      blend: l.blend,
      locked: l.locked,
      stencil: l.stencil ?? null,
      data: canvasMap.current.get(l.id)?.toDataURL('image/png') ?? '',
    }));
    await fetch('/api/draw/project', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name || 'dessin', layers: project }),
    }).catch(() => {});
    setDirty(false);
    setSaving('saved');
    refreshList();
    window.setTimeout(() => setSaving('idle'), 1500);
  }
  function download() {
    const a = document.createElement('a');
    a.href = flatten().toDataURL('image/png');
    a.download = `${name || 'dessin'}.png`;
    a.click();
  }
  function newDrawing() {
    if (dirty && !window.confirm('Abandonner les modifications non enregistrées ?')) return;
    const l = newLayer('Calque 1');
    pendingRef.current.clear();
    thumbsRef.current.clear();
    stencilCache.current.clear();
    undoRef.current = [];
    redoRef.current = [];
    setCanUndo(false);
    setCanRedo(false);
    setLayers([l]);
    setActiveId(l.id);
    setName('Sans titre');
    setDirty(false);
    setRestoreTick((t) => t + 1);
  }
  async function openDrawing(d: Drawing) {
    if (dirty && !window.confirm('Abandonner les modifications non enregistrées ?')) return;
    setGallery(false);
    const proj = await fetch(`/api/draw/project?name=${encodeURIComponent(d.name)}`)
      .then((r) => r.json())
      .catch(() => ({ layers: null }));
    pendingRef.current.clear();
    thumbsRef.current.clear();
    undoRef.current = [];
    redoRef.current = [];
    setCanUndo(false);
    setCanRedo(false);
    stencilCache.current.clear();
    if (proj.layers && Array.isArray(proj.layers) && proj.layers.length) {
      const ls: Layer[] = proj.layers.map(
        (l: Partial<Layer> & { data: string; stencil?: Stencil | null }) => {
          const id = uid();
          const stencil = l.stencil || undefined;
          if (stencil) rasterizeStencil(id, stencil.inner, stencil.color);
          else pendingRef.current.set(id, l.data);
          return {
            id,
            name: l.name || 'Calque',
            visible: l.visible !== false,
            opacity: typeof l.opacity === 'number' ? l.opacity : 1,
            blend: l.blend || 'normal',
            locked: !!l.locked,
            stencil,
          };
        },
      );
      setLayers(ls);
      setActiveId(ls[ls.length - 1]!.id);
    } else {
      const l = newLayer('Calque 1');
      pendingRef.current.set(l.id, `/api/draw/img?name=${encodeURIComponent(d.name)}&t=${d.mtime}`);
      setLayers([l]);
      setActiveId(l.id);
    }
    setName(d.name.replace(/\.png$/i, ''));
    setDirty(false);
    setRestoreTick((t) => t + 1);
  }
  async function delDrawing(d: Drawing) {
    if (!window.confirm(`Supprimer « ${d.name.replace(/\.png$/i, '')} » ?`)) return;
    await fetch(`/api/draw?name=${encodeURIComponent(d.name)}`, { method: 'DELETE' }).catch(
      () => {},
    );
    refreshList();
  }
  async function renameDrawing(d: Drawing) {
    const nn = window.prompt('Nouveau nom :', d.name.replace(/\.png$/i, ''));
    if (!nn) return;
    await fetch('/api/draw', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: d.name, newName: nn }),
    }).catch(() => {});
    refreshList();
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        save();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo, redo, layers, name]);

  const toolBtn = (
    id: Tool | 'undo' | 'redo' | 'clear',
    active: boolean,
    onClick: () => void,
    disabled = false,
    title?: string,
  ) => (
    <button
      key={id}
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`flex h-10 w-10 items-center justify-center rounded-lg transition ${active ? 'bg-accent text-accent-foreground' : 'text-foreground hover:bg-surface-soft'} disabled:opacity-30`}
    >
      <Ico tool={id} />
    </button>
  );

  return (
    <div className="flex h-full min-h-0 flex-col" onClick={() => setPickerOpen(false)}>
      {/* Barre d'options */}
      <div className="relative flex flex-wrap items-center gap-3 border-b border-border bg-surface px-3 py-2">
        <button
          onClick={(e) => {
            e.stopPropagation();
            setPickerOpen((v) => !v);
          }}
          title="Palette de couleurs"
          className="h-7 w-7 rounded-lg border-2 border-border shadow-sm"
          style={{ background: color }}
        />
        <div className="flex items-center gap-1">
          {PALETTE.map((c) => (
            <button
              key={c}
              onClick={() => setColor(c)}
              title={c}
              className={`h-5 w-5 rounded-full border transition ${color === c ? 'ring-2 ring-accent ring-offset-1' : 'border-border'}`}
              style={{ background: c }}
            />
          ))}
        </div>
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          Épaisseur
          <input
            type="range"
            min={1}
            max={40}
            value={size}
            onChange={(e) => setSize(Number(e.target.value))}
            className="w-24 accent-[color:var(--color-accent)]"
          />
          <span className="w-6 tabular-nums text-foreground">{size}</span>
        </label>
        <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <input
            type="checkbox"
            checked={fill}
            onChange={(e) => setFill(e.target.checked)}
            className="h-3.5 w-3.5 accent-[color:var(--color-accent)]"
          />
          Remplir
        </label>
        <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <input
            type="checkbox"
            checked={rulers}
            onChange={(e) => setRulers(e.target.checked)}
            className="h-3.5 w-3.5 accent-[color:var(--color-accent)]"
          />
          Règle
        </label>
        <div className="ml-auto flex items-center gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nom du dessin"
            className="w-32 rounded-lg border border-border bg-surface px-3 py-1.5 text-sm outline-none focus:border-accent"
          />
          <button
            onClick={save}
            className="rounded-lg bg-foreground px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-accent"
          >
            {saving === 'saving'
              ? 'Enregistrement…'
              : saving === 'saved'
                ? 'Enregistré ✓'
                : 'Enregistrer'}
          </button>
          <button
            onClick={newDrawing}
            className="rounded-lg border border-border px-3 py-1.5 text-sm font-semibold transition hover:border-foreground"
          >
            Nouveau
          </button>
          <button
            onClick={download}
            className="rounded-lg border border-border px-3 py-1.5 text-sm font-semibold transition hover:border-foreground"
          >
            Télécharger
          </button>
          <button
            onClick={() => setGallery(true)}
            className="rounded-lg border border-border px-3 py-1.5 text-sm font-semibold transition hover:border-foreground"
          >
            Mes dessins ({list.length})
          </button>
        </div>
        {pickerOpen && (
          <ColorPicker color={color} onChange={setColor} onClose={() => setPickerOpen(false)} />
        )}
      </div>

      <div className="flex min-h-0 flex-1">
        {/* Palette d'outils */}
        <div className="flex w-14 shrink-0 flex-col items-center gap-1 border-r border-border bg-surface py-2">
          {TOOLS.map((t) => toolBtn(t.id, tool === t.id, () => setTool(t.id), false, t.label))}
          <div className="my-1 h-px w-8 bg-border" />
          {toolBtn('undo', false, undo, !canUndo, 'Annuler')}
          {toolBtn('redo', false, redo, !canRedo, 'Rétablir')}
          {toolBtn(
            'clear',
            false,
            () => {
              if (activeCtx() && !activeLayer?.locked) {
                pushUndo(activeId);
                activeCtx()!.clearRect(0, 0, W, H);
                setDirty(true);
                refreshThumbs();
              }
            },
            false,
            'Effacer le calque',
          )}
          <div className="my-1 h-px w-8 bg-border" />
          <button
            onClick={() => setLibrary((v) => !v)}
            title="Bibliothèque d'images"
            className={`flex h-10 w-10 items-center justify-center rounded-lg transition ${library ? 'bg-accent text-accent-foreground' : 'text-foreground hover:bg-surface-soft'}`}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.9"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <path d="m21 15-5-5L5 21" />
            </svg>
          </button>
        </div>

        {/* Bibliothèque de stencils */}
        {library && (
          <div className="flex w-52 shrink-0 flex-col border-r border-border bg-surface-soft/40">
            <div className="px-3 py-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Bibliothèque
            </div>
            <div className="min-h-0 flex-1 overflow-auto px-2 pb-3">
              {STENCIL_GROUPS.map((g) => (
                <div key={g} className="mb-2">
                  <div className="px-1 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/70">
                    {g}
                  </div>
                  <div className="grid grid-cols-3 gap-1.5">
                    {STENCILS.filter((s) => s.group === g).map((s) => (
                      <button
                        key={s.key}
                        title={s.label}
                        draggable
                        onDragStart={() => {
                          dragIconRef.current = s.key;
                        }}
                        onClick={() => placeStencil(s.inner, W / 2, H / 2)}
                        className="flex aspect-square items-center justify-center rounded-lg border border-border bg-surface text-foreground transition hover:border-accent hover:bg-accent/5"
                      >
                        <svg
                          width="26"
                          height="26"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          dangerouslySetInnerHTML={{ __html: s.inner }}
                        />
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Zone canvas (avec règles) */}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          {rulers && (
            <div className="flex h-[22px] shrink-0">
              <div className="h-[22px] w-[22px] shrink-0 border-b border-r border-border bg-[#f2f3f5]" />
              <canvas
                ref={topRulerRef}
                className="h-[22px] min-w-0 flex-1 border-b border-border"
              />
            </div>
          )}
          <div className="flex min-h-0 min-w-0 flex-1">
            {rulers && (
              <canvas ref={leftRulerRef} className="w-[22px] shrink-0 border-r border-border" />
            )}
            <div
              ref={containerRef}
              onScroll={drawRulers}
              className="flex min-h-0 min-w-0 flex-1 overflow-auto bg-[#e9ebef] p-6"
            >
              <div
                ref={stackRef}
                onDragOver={(e) => e.preventDefault()}
                onDrop={onDropIcon}
                className="relative isolate m-auto rounded-lg shadow-lg"
                style={{ width: W * zoom, height: H * zoom }}
              >
                <div className="absolute inset-0 rounded-lg bg-white" />
                {layers.map((l, i) => (
                  <canvas
                    key={l.id}
                    ref={setCanvasRef(l.id)}
                    width={W}
                    height={H}
                    style={{
                      position: 'absolute',
                      inset: 0,
                      width: W * zoom,
                      height: H * zoom,
                      opacity: l.visible ? l.opacity : 0,
                      mixBlendMode: l.blend as React.CSSProperties['mixBlendMode'],
                      zIndex: i + 1,
                      pointerEvents: 'none',
                    }}
                  />
                ))}
                <canvas
                  ref={overlayRef}
                  width={W}
                  height={H}
                  onPointerDown={onDown}
                  onPointerMove={onMove}
                  onPointerUp={onUp}
                  onPointerLeave={onUp}
                  className="touch-none rounded-lg"
                  style={{
                    position: 'absolute',
                    inset: 0,
                    width: W * zoom,
                    height: H * zoom,
                    zIndex: 1000,
                    cursor: tool === 'move' ? 'move' : tool === 'text' ? 'text' : 'crosshair',
                  }}
                />
                {tool === 'move' && activeLayer?.stencil && (
                  <div
                    ref={boxRef}
                    style={{
                      position: 'absolute',
                      left: activeLayer.stencil.x * zoom,
                      top: activeLayer.stencil.y * zoom,
                      width: activeLayer.stencil.w * zoom,
                      height: activeLayer.stencil.h * zoom,
                      zIndex: 1001,
                      outline: '1.5px solid var(--color-accent)',
                    }}
                  >
                    <div
                      onPointerDown={(e) => objDown(e, 'move')}
                      style={{ position: 'absolute', inset: 0, cursor: 'move' }}
                    />
                    {HANDLES.map((h) => (
                      <div
                        key={h.k}
                        onPointerDown={(e) => objDown(e, h.k)}
                        style={{
                          position: 'absolute',
                          width: 10,
                          height: 10,
                          background: '#fff',
                          border: '1.5px solid var(--color-accent)',
                          borderRadius: 2,
                          cursor: h.cursor,
                          ...h.pos,
                        }}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Panneau calques (Photoshop) */}
        <div className="flex w-56 shrink-0 flex-col border-l border-border bg-surface-soft/50">
          <div className="flex items-center gap-1 px-3 py-2">
            <span className="mr-auto text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Calques
            </span>
            <button
              onClick={() => mergeDown(activeId)}
              title="Fusionner avec le calque dessous"
              className="rounded p-0.5 text-muted-foreground hover:bg-surface hover:text-foreground"
            >
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.9"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 4v10m0 0-4-4m4 4 4-4M5 20h14" />
              </svg>
            </button>
            <button
              onClick={flattenLayers}
              title="Aplatir l'image"
              className="rounded p-0.5 text-muted-foreground hover:bg-surface hover:text-foreground"
            >
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.9"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="4" y="4" width="16" height="16" rx="2" />
                <path d="M4 10h16M4 15h16" />
              </svg>
            </button>
            <button
              onClick={addLayer}
              title="Nouveau calque"
              className="rounded p-0.5 text-muted-foreground hover:bg-surface hover:text-foreground"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
              >
                <path d="M12 5v14M5 12h14" />
              </svg>
            </button>
          </div>
          {/* Réglages du calque actif */}
          {activeLayer && (
            <div className="flex items-center gap-2 border-y border-border px-3 py-1.5">
              <select
                value={activeLayer.blend}
                onChange={(e) => patchLayer(activeId, { blend: e.target.value })}
                className="min-w-0 flex-1 rounded-md border border-border bg-surface px-1.5 py-1 text-xs outline-none focus:border-accent"
              >
                {BLENDS.map((b) => (
                  <option key={b.v} value={b.v}>
                    {b.l}
                  </option>
                ))}
              </select>
              <div className="flex items-center gap-1">
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={Math.round(activeLayer.opacity * 100)}
                  onChange={(e) => patchLayer(activeId, { opacity: Number(e.target.value) / 100 })}
                  className="h-1 w-14 accent-[color:var(--color-accent)]"
                />
                <span className="w-7 text-right text-[10px] tabular-nums text-muted-foreground">
                  {Math.round(activeLayer.opacity * 100)}
                </span>
              </div>
            </div>
          )}
          <div className="flex-1 space-y-1 overflow-auto p-2" data-tick={thumbTick}>
            {[...layers].reverse().map((l) => {
              const active = l.id === activeId;
              const over = dragOverId === l.id;
              return (
                <div
                  key={l.id}
                  draggable
                  onDragStart={() => {
                    dragLayerRef.current = l.id;
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    if (dragOverId !== l.id) setDragOverId(l.id);
                  }}
                  onDragLeave={() => {
                    if (over) setDragOverId(null);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    const src = dragLayerRef.current;
                    setDragOverId(null);
                    dragLayerRef.current = null;
                    if (src) reorder(src, l.id, false);
                  }}
                  onClick={() => setActiveId(l.id)}
                  className={`flex cursor-pointer items-center gap-2 rounded-lg border p-1.5 transition ${over ? 'border-accent ring-1 ring-accent' : active ? 'border-accent bg-accent/10' : 'border-border bg-surface hover:border-foreground/30'}`}
                >
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      patchLayer(l.id, { visible: !l.visible });
                    }}
                    title={l.visible ? 'Masquer' : 'Afficher'}
                    className="shrink-0 text-muted-foreground hover:text-foreground"
                  >
                    {l.visible ? (
                      <svg
                        width="15"
                        height="15"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                      >
                        <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    ) : (
                      <svg
                        width="15"
                        height="15"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                      >
                        <path d="M3 3l18 18M10.6 10.6a3 3 0 0 0 4.2 4.2M9.9 5.1A9.5 9.5 0 0 1 12 5c6.5 0 10 7 10 7a15 15 0 0 1-2.5 3.2M6.6 6.6A15 15 0 0 0 2 12s3.5 7 10 7a9 9 0 0 0 3-.5" />
                      </svg>
                    )}
                  </button>
                  <div
                    className="h-8 w-12 shrink-0 overflow-hidden rounded border border-border bg-white"
                    style={{
                      backgroundImage:
                        'linear-gradient(45deg,#eee 25%,transparent 25%,transparent 75%,#eee 75%),linear-gradient(45deg,#eee 25%,#fff 25%,#fff 75%,#eee 75%)',
                      backgroundSize: '8px 8px',
                      backgroundPosition: '0 0,4px 4px',
                    }}
                  >
                    {thumbsRef.current.get(l.id) && (
                      <img
                        src={thumbsRef.current.get(l.id)}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    )}
                  </div>
                  <span
                    className="flex-1 truncate text-xs font-medium"
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      const nn = window.prompt('Nom du calque :', l.name);
                      if (nn) patchLayer(l.id, { name: nn });
                    }}
                  >
                    {l.name}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      patchLayer(l.id, { locked: !l.locked });
                    }}
                    title={l.locked ? 'Déverrouiller' : 'Verrouiller'}
                    className={`shrink-0 ${l.locked ? 'text-accent' : 'text-muted-foreground hover:text-foreground'}`}
                  >
                    {l.locked ? (
                      <svg
                        width="13"
                        height="13"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <rect x="5" y="11" width="14" height="10" rx="2" />
                        <path d="M8 11V7a4 4 0 0 1 8 0v4" />
                      </svg>
                    ) : (
                      <svg
                        width="13"
                        height="13"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <rect x="5" y="11" width="14" height="10" rx="2" />
                        <path d="M8 11V7a4 4 0 0 1 7.5-2" />
                      </svg>
                    )}
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      moveLayer(l.id, 1);
                    }}
                    title="Monter"
                    className="text-muted-foreground hover:text-foreground"
                  >
                    ↑
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      moveLayer(l.id, -1);
                    }}
                    title="Descendre"
                    className="text-muted-foreground hover:text-foreground"
                  >
                    ↓
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      duplicateLayer(l.id);
                    }}
                    title="Dupliquer"
                    className="text-muted-foreground hover:text-foreground"
                  >
                    ⧉
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteLayer(l.id);
                    }}
                    title="Supprimer"
                    className="text-[#ef4444] hover:opacity-80"
                  >
                    ✕
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Barre du bas */}
      <div className="flex items-center gap-3 border-t border-border bg-surface px-3 py-1.5 text-xs text-muted-foreground">
        <span>
          Outil :{' '}
          <span className="font-medium text-foreground">
            {TOOLS.find((t) => t.id === tool)?.label}
          </span>
        </span>
        <span className="flex items-center gap-1">
          Couleur{' '}
          <span
            className="h-3 w-3 rounded-full border border-border"
            style={{ background: color }}
          />
        </span>
        <span>Épaisseur : {size}</span>
        <span className="hidden sm:inline">
          {W} × {H} px
        </span>
        <span className="hidden md:inline">
          {layers.length} calque{layers.length > 1 ? 's' : ''}
        </span>
        {dirty && <span className="font-medium text-accent">● non enregistré</span>}
        <div className="ml-auto flex items-center gap-1">
          <button
            onClick={() => setZoom((z) => clampZoom(z * 0.8))}
            title="Dézoomer"
            className="flex h-6 w-6 items-center justify-center rounded-md border border-border transition hover:border-foreground"
          >
            −
          </button>
          <button
            onClick={() => setZoom(1)}
            title="Taille réelle (100 %)"
            className="w-14 rounded-md border border-border px-1 py-0.5 text-center font-medium tabular-nums transition hover:border-foreground"
          >
            {Math.round(zoom * 100)}%
          </button>
          <button
            onClick={() => setZoom((z) => clampZoom(z * 1.25))}
            title="Zoomer"
            className="flex h-6 w-6 items-center justify-center rounded-md border border-border transition hover:border-foreground"
          >
            +
          </button>
          <button
            onClick={fit}
            title="Ajuster"
            className="rounded-md border border-border px-2 py-0.5 font-medium transition hover:border-foreground"
          >
            Ajuster
          </button>
        </div>
      </div>

      {/* Galerie (modale) */}
      {gallery && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-6"
          onClick={() => setGallery(false)}
        >
          <div
            className="flex max-h-[85vh] w-full max-w-3xl flex-col rounded-2xl border border-border bg-surface p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-bold">Mes dessins</h2>
              <button
                onClick={() => setGallery(false)}
                className="rounded-full p-1 text-muted-foreground hover:bg-surface-soft"
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                >
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
            {list.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">
                Aucun dessin enregistré
              </p>
            ) : (
              <div className="grid min-h-0 flex-1 grid-cols-2 gap-3 overflow-auto sm:grid-cols-3">
                {list.map((d) => (
                  <div
                    key={d.name}
                    className="group overflow-hidden rounded-xl border border-border bg-surface"
                  >
                    <button onClick={() => openDrawing(d)} className="block w-full">
                      <img
                        src={`/api/draw/img?name=${encodeURIComponent(d.name)}&t=${d.mtime}`}
                        alt={d.name}
                        className="aspect-[16/10] w-full bg-white object-cover"
                        loading="lazy"
                      />
                    </button>
                    <div className="flex items-center gap-1 px-2 py-1.5">
                      <span className="flex-1 truncate text-xs font-medium">
                        {d.name.replace(/\.png$/i, '')}
                      </span>
                      <button
                        onClick={() => renameDrawing(d)}
                        title="Renommer"
                        className="px-1 text-[11px] text-muted-foreground hover:text-foreground"
                      >
                        ✎
                      </button>
                      <button
                        onClick={() => delDrawing(d)}
                        title="Supprimer"
                        className="px-1 text-[11px] text-[#ef4444]"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
