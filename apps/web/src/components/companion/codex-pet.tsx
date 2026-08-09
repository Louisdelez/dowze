'use client';

import { useEffect, useState } from 'react';
import { CODEX_ANIMS, FRAME_H, FRAME_W, SHEET_H, SHEET_W } from '@/lib/companion-pet';

/**
 * Rejoue une planche « Codex » (frames 192×208, une animation = une ligne) en CSS `steps()`.
 * Les dimensions de la planche sont **auto-détectées** depuis l'image : ainsi n'importe quelle
 * planche au standard Codex marche (1536×1872, 1536×2288, …) quel que soit le site d'origine.
 * `prefers-reduced-motion` → frame fixe (géré en CSS). Décoratif (`aria-hidden`).
 */
export function CodexPet({ url, animId, size }: { url: string; animId: string; size: number }) {
  const a = CODEX_ANIMS[animId] ?? CODEX_ANIMS.idle!;
  const scale = size / FRAME_H;
  const w = FRAME_W * scale;

  // Dimensions natives de la planche (pour caler background-size). Défaut = standard 1536×1872.
  const [sheet, setSheet] = useState({ w: SHEET_W, h: SHEET_H });
  useEffect(() => {
    let alive = true;
    const img = new Image();
    img.onload = () => {
      if (alive && img.naturalWidth && img.naturalHeight) {
        setSheet({ w: img.naturalWidth, h: img.naturalHeight });
      }
    };
    img.src = url;
    return () => {
      alive = false;
    };
  }, [url]);

  return (
    <div style={{ width: w, height: size }} aria-hidden="true">
      <div
        key={`${url}:${animId}`} // redémarre l'animation quand l'état (ou la planche) change
        className="codex-pet-frame"
        style={{
          width: FRAME_W,
          height: FRAME_H,
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
          imageRendering: 'pixelated',
          backgroundImage: `url("${url}")`,
          backgroundRepeat: 'no-repeat',
          backgroundSize: `${sheet.w}px ${sheet.h}px`,
          backgroundPositionY: `${-a.row * FRAME_H}px`,
          animation: `codex-play ${a.durationMs}ms steps(${a.frames}) infinite`,
          ['--codex-endx' as string]: `${-a.frames * FRAME_W}px`,
        }}
      />
    </div>
  );
}
