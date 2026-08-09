'use client';

// Moteur de rendu GPU (PixiJS / WebGL) pour les OPEN-SPACES — l'équivalent 2D de ce que fait epicube en 3D (Three.js).
// Sol + murs = Mesh iso tuilé (une géométrie GPU → 64/128/256 sans coût). Compagnons = sprites animés BATCHÉS sur le GPU
// (des milliers à 60 fps, contrairement au DOM). Pan/zoom, clic, nametags gérés dans la scène. Additif : n'affecte pas la Maison.

import { useEffect, useRef, useState } from 'react';
import {
  Application,
  Container,
  Mesh,
  Geometry,
  Texture,
  Assets,
  Sprite,
  Text,
  Graphics,
  Rectangle,
  Ticker,
} from 'pixi.js';

// Géométrie iso (mêmes constantes que la salle DOM).
const TW = 72,
  TH = 36,
  WALL = 96;
const FRAME_W = 192,
  FRAME_H = 208;
// Animations de la planche Codex (ligne = animation).
const ANIMS: Record<string, { row: number; frames: number; ms: number }> = {
  idle: { row: 0, frames: 6, ms: 1100 },
  'running-right': { row: 1, frames: 8, ms: 1060 },
  'running-left': { row: 2, frames: 8, ms: 1060 },
};

export interface PixiCompanion {
  id: string;
  name: string;
  skinUrl: string;
  size: number;
}

interface Bee {
  id: string;
  name: string;
  sprite: Sprite;
  label: Text;
  bubble: Container;
  bubbleBg: Graphics;
  bubbleText: Text;
  bubbleStr: string;
  c: number;
  r: number;
  tc: number | null;
  tr: number | null;
  facing: 'left' | 'right';
  nextAt: number;
  anim: string;
  frame: number;
  frameAt: number;
  baseTex: Texture | null;
  hold?: boolean; // « retenu » (rassemblement autour du leader) : ne repart pas en wander
}

// Skin de secours (existe sur CHAQUE hôte dowze-web, en same-origin).
const FALLBACK_SKIN = '/pets/super-nono-v2.webp';

/**
 * Normalise une URL d'asset en SAME-ORIGIN. Les skins sont parfois stockés en absolu
 * (`https://academie.dowze.ch/pets/x.webp`) ; or Pixi/WebGL ne peut pas charger une texture
 * cross-origin sans en-têtes CORS → sprite invisible. Les assets /pets, /textures, /furniture
 * existent au même chemin sur l'hôte courant → on charge le chemin relatif.
 */
function sameOriginAsset(url: string): string {
  if (!url) return FALLBACK_SKIN;
  try {
    const u = new URL(url, window.location.origin);
    if (u.hostname.endsWith('.dowze.ch') && /\/(pets|textures|furniture)\//.test(u.pathname))
      return u.pathname;
    return url;
  } catch {
    return url;
  }
}

/** Teinte multiplicative jour/nuit du décor selon l'heure (0-24) : blanc le jour → bleu foncé la nuit. */
function tintForHour(h: number): number {
  // nuit pleine ~0-5 et ~21-24 ; jour ~9-17.
  const night = h < 6 ? 1 - h / 6 : h > 18 ? (h - 18) / 6 : 0;
  const n = Math.max(0, Math.min(1, night));
  const lerp = (a: number, b: number) => Math.round(a + (b - a) * n);
  const r = lerp(255, 90),
    g = lerp(255, 100),
    b = lerp(255, 160);
  return (r << 16) | (g << 8) | b;
}

export function PixiOpenspace({
  size,
  floorTex,
  wallTex,
  companions,
  speeches,
  hour,
  selectedId,
  roomKey,
  furniture,
  editing,
  gather,
  onPlaceTile,
  onCompanionClick,
}: {
  size: number;
  floorTex: string;
  wallTex?: string;
  companions: PixiCompanion[];
  speeches?: Record<string, string | null>;
  hour?: number;
  selectedId?: string | null;
  roomKey?: string;
  furniture?: { id: string; c: number; r: number }[];
  editing?: boolean;
  /** Rassemblement (believabilité) : les membres marchent autour du leader (hand-off visible), puis repartent quand null. */
  gather?: { leaderId: string; memberIds: string[] } | null;
  onPlaceTile?: (c: number, r: number) => void;
  onCompanionClick?: (id: string) => void;
}) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const appRef = useRef<Application | null>(null);
  const worldRef = useRef<Container | null>(null);
  const beesRef = useRef<Map<string, Bee>>(new Map());
  const furnRef = useRef<Map<string, Sprite>>(new Map()); // meubles posés : clé "id@c,r" → sprite
  const compRef = useRef<PixiCompanion[]>(companions);
  const clickRef = useRef(onCompanionClick);
  const sizeRef = useRef(size);
  const speechRef = useRef<Record<string, string | null>>(speeches ?? {});
  const hourRef = useRef(hour ?? 12);
  const decorRef = useRef<Mesh<Geometry>[]>([]);
  const ringRef = useRef<Graphics | null>(null);
  const winHandlersRef = useRef<{
    onPointerUp: (e: PointerEvent) => void;
    onPointerMove: (e: PointerEvent) => void;
  } | null>(null);
  const selectedRef = useRef<string | null>(selectedId ?? null);
  const editingRef = useRef(editing ?? false);
  const placeRef = useRef(onPlaceTile);
  const [ready, setReady] = useState(false);
  compRef.current = companions;
  clickRef.current = onCompanionClick;
  sizeRef.current = size;
  speechRef.current = speeches ?? {};
  hourRef.current = hour ?? 12;
  selectedRef.current = selectedId ?? null;
  editingRef.current = editing ?? false;
  placeRef.current = onPlaceTile;

  // Init de l'application Pixi (une seule fois).
  useEffect(() => {
    let destroyed = false;
    const app = new Application();
    (async () => {
      await app.init({
        backgroundAlpha: 0,
        antialias: true,
        resizeTo: hostRef.current ?? undefined,
      });
      if (destroyed) {
        app.destroy(true);
        return;
      }
      appRef.current = app;
      app.canvas.style.background = 'transparent';
      hostRef.current?.appendChild(app.canvas);
      const world = new Container();
      world.sortableChildren = true;
      app.stage.addChild(world);
      worldRef.current = world;

      // Pan (clic-glisser) + zoom (molette), gérés sur le canvas.
      let dragging = false,
        lastX = 0,
        lastY = 0,
        moved = 0;
      const el = app.canvas;
      el.style.cursor = 'grab';
      // Handlers nommés → retirés au démontage (sinon fuite + multi-déclenchement à chaque changement de salle).
      const onPointerUp = (e: PointerEvent) => {
        // Clic (peu de déplacement) en mode ÉDITION → pose un meuble sur la case visée.
        if (dragging && editingRef.current && placeRef.current && moved < 6) {
          const rect = el.getBoundingClientRect();
          const wx = (e.clientX - rect.left - world.x) / world.scale.x;
          const wy = (e.clientY - rect.top - world.y) / world.scale.y;
          const a = wx / (TW / 2),
            b = wy / (TH / 2);
          const c = Math.round((a + b) / 2),
            r = Math.round((b - a) / 2);
          const N = sizeRef.current;
          if (c >= 0 && c < N && r >= 0 && r < N) placeRef.current(c, r);
        }
        dragging = false;
        el.style.cursor = editingRef.current ? 'crosshair' : 'grab';
      };
      const onPointerMove = (e: PointerEvent) => {
        if (!dragging) return;
        moved += Math.abs(e.clientX - lastX) + Math.abs(e.clientY - lastY);
        world.x += e.clientX - lastX;
        world.y += e.clientY - lastY;
        lastX = e.clientX;
        lastY = e.clientY;
      };
      el.addEventListener('pointerdown', (e) => {
        dragging = true;
        lastX = e.clientX;
        lastY = e.clientY;
        moved = 0;
        el.style.cursor = 'grabbing';
      });
      window.addEventListener('pointerup', onPointerUp);
      window.addEventListener('pointermove', onPointerMove);
      winHandlersRef.current = { onPointerUp, onPointerMove };
      el.addEventListener(
        'wheel',
        (e) => {
          e.preventDefault();
          const f = e.deltaY < 0 ? 1.1 : 0.9;
          world.scale.set(Math.max(0.03, Math.min(2.5, world.scale.x * f)));
        },
        { passive: false },
      );

      // Anneau de sélection (ellipse au sol sous le compagnon suivi). Dessiné petit puis contre-mis-à-l'échelle
      // dans le ticker pour garder une TAILLE CONSTANTE À L'ÉCRAN (sinon invisible aux gros dézooms 64/128/256).
      const ring = new Graphics();
      ring
        .ellipse(0, 0, 30, 15)
        .fill({ color: 0x38bdf8, alpha: 0.22 })
        .stroke({ color: 0x0ea5e9, width: 3.5, alpha: 1 });
      ring.visible = false;
      world.addChild(ring);
      ringRef.current = ring;

      // Boucle d'animation + wander.
      const tick = (t: Ticker) => {
        const now = performance.now();
        const dt = Math.min(0.05, t.deltaMS / 1000);
        // Teinte jour/nuit du décor (multiplicative sur le sol + murs).
        const tint = tintForHour(hourRef.current);
        for (const m of decorRef.current) m.tint = tint;
        for (const s of furnRef.current.values()) s.tint = tint;
        // Anneau sous le compagnon sélectionné (celui qui te suit) — pulse doux.
        const ringG = ringRef.current;
        if (ringG) {
          const sel = selectedRef.current ? beesRef.current.get(selectedRef.current) : null;
          if (sel) {
            const rx = (sel.c - sel.r) * (TW / 2),
              ry = (sel.c + sel.r) * (TH / 2);
            const ws = world.scale.x || 1; // contre-échelle → l'anneau garde ~30px à l'écran quel que soit le zoom
            ringG.visible = true;
            ringG.x = rx;
            ringG.y = ry;
            ringG.zIndex = Math.round((sel.c + sel.r) * 100) - 1;
            ringG.scale.set((1 / ws) * (1 + Math.sin(now / 300) * 0.08));
          } else ringG.visible = false;
        }
        for (const b of beesRef.current.values()) {
          // wander (les bees « retenus » = rassemblés autour du leader ne repartent pas d'eux-mêmes)
          if (b.tc == null) {
            if (!b.hold && now >= b.nextAt) {
              const N = sizeRef.current;
              b.tc = Math.floor(Math.random() * N);
              b.tr = Math.floor(Math.random() * N);
              b.facing = b.tc - b.tr - (b.c - b.r) >= 0 ? 'right' : 'left';
            }
          } else {
            const dc = (b.tc ?? b.c) - b.c,
              dr = (b.tr ?? b.r) - b.r;
            const d = Math.hypot(dc, dr) || 1;
            if (d < 0.06) {
              b.c = b.tc!;
              b.r = b.tr!;
              b.tc = null;
              b.tr = null;
              b.nextAt = b.hold ? Infinity : now + 2500 + Math.random() * 6000;
            } else {
              const step = Math.min(d, 2.6 * dt);
              b.c += (dc / d) * step;
              b.r += (dr / d) * step;
            }
          }
          const moving = b.tc != null;
          const anim = moving ? (b.facing === 'right' ? 'running-right' : 'running-left') : 'idle';
          const spec = ANIMS[anim] ?? ANIMS.idle!;
          if (b.anim !== anim) {
            b.anim = anim;
            b.frame = 0;
            b.frameAt = now;
          }
          if (now - b.frameAt >= spec.ms / spec.frames) {
            b.frame = (b.frame + 1) % spec.frames;
            b.frameAt = now;
          }
          // position iso + tri de profondeur
          const x = (b.c - b.r) * (TW / 2),
            y = (b.c + b.r) * (TH / 2);
          b.sprite.x = x;
          b.sprite.y = y;
          b.sprite.zIndex = Math.round((b.c + b.r) * 100);
          b.label.x = x;
          b.label.y = y - b.sprite.height - 6;
          b.label.zIndex = b.sprite.zIndex + 1;
          // frame courante
          if (b.baseTex) {
            const fr = new Rectangle(b.frame * FRAME_W, spec.row * FRAME_H, FRAME_W, FRAME_H);
            if (b.sprite.texture.frame.x !== fr.x || b.sprite.texture.frame.y !== fr.y) {
              const tex = new Texture({ source: b.baseTex.source, frame: fr });
              b.sprite.texture = tex;
            }
          }
          // Bulle de dialogue (réponse chat / réplique PNJ) au-dessus du nametag.
          const str = (speechRef.current[b.id] ?? '').slice(0, 140);
          if (str !== b.bubbleStr) {
            b.bubbleStr = str;
            b.bubble.visible = !!str;
            if (str) {
              b.bubbleText.text = str;
              const w = Math.min(240, b.bubbleText.width) + 16,
                h = b.bubbleText.height + 12;
              b.bubbleText.x = -w / 2 + 8;
              b.bubbleText.y = -h + 6;
              b.bubbleBg.clear();
              b.bubbleBg
                .roundRect(-w / 2, -h, w, h, 8)
                .fill(0xffffff)
                .stroke({ color: 0x000000, alpha: 0.12, width: 1 });
            }
          }
          if (b.bubble.visible) {
            b.bubble.x = x;
            b.bubble.y = y - b.sprite.height - 20;
            b.bubble.zIndex = b.sprite.zIndex + 2;
          }
        }
      };
      app.ticker.add(tick);
      setReady(true); // Pixi prêt → les effets décor/compagnons peuvent construire la scène
    })();
    return () => {
      destroyed = true;
      setReady(false);
      const h = winHandlersRef.current;
      if (h) {
        window.removeEventListener('pointerup', h.onPointerUp);
        window.removeEventListener('pointermove', h.onPointerMove);
        winHandlersRef.current = null;
      }
      const a = appRef.current;
      appRef.current = null;
      if (a) {
        try {
          a.destroy(true, { children: true });
        } catch {
          /* */
        }
      }
      beesRef.current.clear();
      furnRef.current.clear();
      decorRef.current = [];
    };
  }, []);

  // (Re)construit le décor (sol + murs) quand la taille / textures changent.
  useEffect(() => {
    const app = appRef.current,
      world = worldRef.current;
    if (!ready || !app || !world) return;
    let cancelled = false;
    (async () => {
      // retire ET DÉTRUIT l'ancien décor (sinon fuite mémoire GPU à chaque changement de salle/texture)
      for (const ch of [...world.children]) {
        if ((ch as Container).label === 'decor') {
          try {
            (ch as Container).destroy({ children: true });
          } catch {
            /* */
          }
        }
      }
      decorRef.current = [];
      const decor = new Container();
      decor.label = 'decor';
      decor.zIndex = -1_000_000;
      world.addChildAt(decor, 0);

      // ---- SOL : Mesh iso tuilé (une géométrie GPU) ----
      const N = size;
      const positions: number[] = [],
        uvs: number[] = [],
        indices: number[] = [];
      for (let r = 0; r <= N; r++)
        for (let c = 0; c <= N; c++) {
          positions.push((c - r) * (TW / 2), (c + r) * (TH / 2));
          uvs.push(c, r);
        }
      const stride = N + 1;
      for (let r = 0; r < N; r++)
        for (let c = 0; c < N; c++) {
          const a = r * stride + c;
          indices.push(a, a + 1, a + stride, a + 1, a + stride + 1, a + stride);
        }
      const geo = new Geometry({
        attributes: {
          aPosition: { buffer: new Float32Array(positions), format: 'float32x2' },
          aUV: { buffer: new Float32Array(uvs), format: 'float32x2' },
        },
        indexBuffer: new Uint32Array(indices),
      });
      const ftex = await Assets.load(`/textures/${floorTex}.png`).catch(() => Texture.WHITE);
      if (cancelled) return;
      if (ftex !== Texture.WHITE) ftex.source.wrapMode = 'repeat';
      const floor = new Mesh({ geometry: geo, texture: ftex });
      decor.addChild(floor);
      decorRef.current = [floor]; // meshes teintés jour/nuit

      // ---- MURS : deux quads inclinés texturés (tuilés) ----
      if (wallTex) {
        const wtex = await Assets.load(`/textures/${wallTex}.png`).catch(() => Texture.WHITE);
        if (cancelled) return;
        if (wtex !== Texture.WHITE) wtex.source.wrapMode = 'repeat';
        const wall = (left: boolean) => {
          const sx = left ? -1 : 1;
          // 4 coins (haut-arrière → haut-avant → bas-avant → bas-arrière), origine tuile (0,0).
          const P = left
            ? [
                [0, -WALL],
                [-N * (TW / 2), N * (TH / 2) - WALL],
                [-N * (TW / 2), N * (TH / 2)],
                [0, 0],
              ]
            : [
                [0, -WALL],
                [N * (TW / 2), N * (TH / 2) - WALL],
                [N * (TW / 2), N * (TH / 2)],
                [0, 0],
              ];
          const pos: number[] = [];
          for (const [x, y] of P) pos.push(x!, y!);
          // UV : tuilé le long du mur (N segments) × hauteur (WALL/TH tuiles).
          const uvH = WALL / TH;
          const uv = left ? [0, 0, N, 0, N, uvH, 0, uvH] : [0, 0, N, 0, N, uvH, 0, uvH];
          const g = new Geometry({
            attributes: {
              aPosition: { buffer: new Float32Array(pos), format: 'float32x2' },
              aUV: { buffer: new Float32Array(uv), format: 'float32x2' },
            },
            indexBuffer: new Uint32Array([0, 1, 2, 0, 2, 3]),
          });
          const m = new Mesh({ geometry: g, texture: wtex });
          m.zIndex = -2_000_000 + (left ? 0 : 1);
          void sx;
          return m;
        };
        const wl = wall(true),
          wr = wall(false);
        decor.addChild(wl);
        decor.addChild(wr);
        decorRef.current.push(wl, wr);
      }

      // Cadre la caméra pour montrer tout le losange (murs inclus), centré.
      const vw = app.renderer.width || hostRef.current?.clientWidth || 1000;
      const vh = app.renderer.height || hostRef.current?.clientHeight || 800;
      const sc = Math.max(
        0.03,
        Math.min(1.2, Math.min(vw / (N * TW + 1), vh / (N * TH + WALL + 1)) * 0.85),
      );
      world.scale.set(sc);
      world.x = vw / 2;
      world.y = vh / 2 - ((N * TH) / 2) * sc;
    })();
    return () => {
      cancelled = true;
    };
  }, [ready, size, floorTex, wallTex]);

  // À CHAQUE changement de salle : le compagnon suivi « entre » (apparaît à la porte, marche vers le centre) ;
  // les autres sont bornés à la nouvelle salle (une salle plus petite ne doit pas les laisser hors-champ).
  useEffect(() => {
    if (!ready) return;
    const N = sizeRef.current;
    for (const b of beesRef.current.values()) {
      b.c = Math.min(b.c, N - 1);
      b.r = Math.min(b.r, N - 1);
      if (b.tc != null) b.tc = Math.min(b.tc, N - 1);
      if (b.tr != null) b.tr = Math.min(b.tr, N - 1);
    }
    const sel = selectedRef.current ? beesRef.current.get(selectedRef.current) : null;
    if (sel) {
      sel.c = N - 1;
      sel.r = N - 1;
      sel.tc = Math.floor(N / 2);
      sel.tr = Math.floor(N / 2);
      sel.facing = 'left';
      sel.nextAt = 0;
    }
  }, [ready, roomKey]);

  // BELIEVABILITÉ SPATIALE : quand le leader mobilise des membres, ils viennent se rassembler autour de
  // lui (le hand-off se VOIT), puis repartent quand `gather` repasse à null (fin de l'échange).
  useEffect(() => {
    if (!ready) return;
    const bees = beesRef.current;
    const now = performance.now();
    if (!gather) {
      // Libération : chacun reprend son wander.
      for (const b of bees.values()) {
        if (b.hold) {
          b.hold = false;
          b.tc = null;
          b.tr = null;
          b.nextAt = now + Math.random() * 1200;
        }
      }
      return;
    }
    const leader = bees.get(gather.leaderId);
    if (!leader) return;
    const N = sizeRef.current;
    leader.hold = true;
    leader.tc = null;
    leader.tr = null;
    leader.nextAt = Infinity; // le leader reste en place
    const ids = gather.memberIds.filter((id) => bees.has(id) && id !== gather.leaderId);
    ids.forEach((id, i) => {
      const b = bees.get(id)!;
      const ang = (i / Math.max(1, ids.length)) * Math.PI * 2;
      const rad = 1.15 + (i % 2) * 0.35; // huddle SERRÉ autour du leader (léger décalage pour éviter la superposition)
      const tc = Math.max(0, Math.min(N - 1, Math.round(leader.c + Math.cos(ang) * rad)));
      const tr = Math.max(0, Math.min(N - 1, Math.round(leader.r + Math.sin(ang) * rad)));
      b.hold = true;
      b.tc = tc;
      b.tr = tr;
      b.facing = tc - tr - (b.c - b.r) >= 0 ? 'right' : 'left';
    });
  }, [ready, gather]);

  // Synchronise les compagnons (ajout/retrait) avec la scène.
  useEffect(() => {
    const app = appRef.current,
      world = worldRef.current;
    if (!ready || !app || !world) return;
    let cancelled = false;
    (async () => {
      const bees = beesRef.current;
      const wanted = new Set(companions.map((c) => c.id));
      // retire les partis
      for (const [id, b] of [...bees]) {
        if (!wanted.has(id)) {
          b.sprite.destroy();
          b.label.destroy();
          b.bubble.destroy({ children: true });
          bees.delete(id);
        }
      }
      // ajoute les nouveaux
      for (const comp of companions) {
        if (bees.has(comp.id)) continue;
        // Same-origin d'abord (Pixi = WebGL, pas de cross-origin sans CORS) ; repli sur le skin robot si échec.
        let base = await Assets.load(sameOriginAsset(comp.skinUrl)).catch(() => null);
        if (!base) base = await Assets.load(FALLBACK_SKIN).catch(() => null);
        if (cancelled) return;
        const spr = new Sprite(
          base
            ? new Texture({
                source: (base as Texture).source,
                frame: new Rectangle(0, 0, FRAME_W, FRAME_H),
              })
            : Texture.WHITE,
        );
        spr.anchor.set(0.5, 0.95);
        const sc = ((comp.size || 84) / FRAME_H) * 1.1;
        spr.scale.set(sc);
        spr.eventMode = 'static';
        spr.cursor = 'pointer';
        spr.on('pointertap', () => clickRef.current?.(comp.id));
        const label = new Text({
          text: comp.name,
          style: {
            fontFamily: 'Inter, sans-serif',
            fontSize: 22,
            fill: '#ffffff',
            stroke: { color: 'rgba(0,0,0,0.55)', width: 6 },
          },
        });
        label.anchor.set(0.5, 1);
        // bulle de dialogue (cachée par défaut)
        const bubble = new Container();
        bubble.visible = false;
        const bubbleBg = new Graphics();
        const bubbleText = new Text({
          text: '',
          style: {
            fontFamily: 'Inter, sans-serif',
            fontSize: 18,
            fill: '#334155',
            wordWrap: true,
            wordWrapWidth: 224,
          },
        });
        bubble.addChild(bubbleBg);
        bubble.addChild(bubbleText);
        world.addChild(spr);
        world.addChild(label);
        world.addChild(bubble);
        bees.set(comp.id, {
          id: comp.id,
          name: comp.name,
          sprite: spr,
          label,
          bubble,
          bubbleBg,
          bubbleText,
          bubbleStr: '',
          c: Math.random() * size,
          r: Math.random() * size,
          tc: null,
          tr: null,
          facing: 'right',
          nextAt: 0,
          anim: 'idle',
          frame: 0,
          frameAt: 0,
          baseTex: base as Texture | null,
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ready, companions, size]);

  // Synchronise les MEUBLES posés (sprites statiques ancrés au sol).
  useEffect(() => {
    const world = worldRef.current;
    if (!ready || !world) return;
    let cancelled = false;
    (async () => {
      const map = furnRef.current;
      const list = furniture ?? [];
      const wanted = new Set(list.map((f) => `${f.id}@${f.c},${f.r}`));
      for (const [key, spr] of [...map]) {
        if (!wanted.has(key)) {
          spr.destroy();
          map.delete(key);
        }
      }
      for (const f of list) {
        const key = `${f.id}@${f.c},${f.r}`;
        if (map.has(key)) continue;
        const tex = await Assets.load(`/furniture/${f.id}.png`).catch(() => null);
        if (cancelled) return;
        const spr = new Sprite((tex as Texture) ?? Texture.WHITE);
        spr.anchor.set(0.5, 0.9);
        spr.scale.set((TW * 1.35) / (spr.texture.width || 256));
        const x = (f.c - f.r) * (TW / 2),
          y = (f.c + f.r) * (TH / 2);
        spr.x = x;
        spr.y = y;
        spr.zIndex = Math.round((f.c + f.r) * 100);
        world.addChild(spr);
        map.set(key, spr);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ready, furniture, size, roomKey]);

  return <div ref={hostRef} className="absolute inset-0" style={{ touchAction: 'none' }} />;
}
