'use client';

import { useEffect, useState } from 'react';

/**
 * CodexPet (version partagée `@dowze/ui`) — rejoue une planche « Codex » (une ligne = une animation)
 * en CSS `steps()`. Autonome : constantes inlinées, keyframes injectés une fois, URLs de planche
 * normalisées en ABSOLU (les assets sont hébergés par l'académie) pour fonctionner sur n'importe quel
 * sous-domaine `.dowze.ch`. Décoratif (`aria-hidden`).
 */

const FRAME_W = 192;
const FRAME_H = 208;
const SHEET_W = 1536; // défaut avant détection
const SHEET_H = 1872;
const IDLE = { row: 0, frames: 6, durationMs: 1100 };

/** Hôte qui sert les planches de pets (public/pets de l'académie). */
const PET_HOST = 'https://academie.dowze.ch';

/** URL d'une planche « curated » (absolue → marche depuis toutes les apps). */
export function curatedSheetUrl(slug: string): string {
  return `${PET_HOST}/pets/${slug}.webp`;
}

/** Normalise une skinUrl : un chemin relatif `/pets/...` est résolu sur l'académie. */
function absUrl(url: string): string {
  if (!url) return curatedSheetUrl('super-nono-v2');
  return url.startsWith('/') ? `${PET_HOST}${url}` : url;
}

let stylesInjected = false;
function ensureStyles() {
  if (stylesInjected || typeof document === 'undefined') return;
  stylesInjected = true;
  const el = document.createElement('style');
  el.dataset.dowzeCodexPet = '1';
  el.textContent = `@keyframes dowze-codex-play{from{background-position-x:0}to{background-position-x:var(--codex-endx)}}@media (prefers-reduced-motion: reduce){.dowze-codex-frame{animation:none!important;background-position-x:0!important}}`;
  document.head.appendChild(el);
}

export function CodexPet({ url, animId = 'idle', size }: { url: string; animId?: string; size: number }) {
  const a = IDLE; // le socle n'a besoin que d'idle ; les autres anims restent côté jeu (académie)
  void animId;
  const scale = size / FRAME_H;
  const w = FRAME_W * scale;
  const src = absUrl(url);

  const [sheet, setSheet] = useState({ w: SHEET_W, h: SHEET_H });
  useEffect(() => {
    ensureStyles();
    let alive = true;
    const img = new Image();
    img.onload = () => {
      if (alive && img.naturalWidth && img.naturalHeight) setSheet({ w: img.naturalWidth, h: img.naturalHeight });
    };
    img.src = src;
    return () => {
      alive = false;
    };
  }, [src]);

  return (
    <div style={{ width: w, height: size }} aria-hidden="true">
      <div
        key={`${src}:${a.row}`}
        className="dowze-codex-frame"
        style={{
          width: FRAME_W,
          height: FRAME_H,
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
          imageRendering: 'pixelated',
          backgroundImage: `url("${src}")`,
          backgroundRepeat: 'no-repeat',
          backgroundSize: `${sheet.w}px ${sheet.h}px`,
          backgroundPositionY: `${-a.row * FRAME_H}px`,
          animation: `dowze-codex-play ${a.durationMs}ms steps(${a.frames}) infinite`,
          ['--codex-endx' as string]: `${-a.frames * FRAME_W}px`,
        }}
      />
    </div>
  );
}
