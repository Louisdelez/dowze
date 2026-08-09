'use client';

import { CodexPet } from '@/components/companion/codex-pet';
import { CAM_RATIO } from '@/lib/companion-pet';
import { World } from './companion-worlds';

/**
 * « Cam » du compagnon : une tuile façon visio Discord (bords arrondis) avec un décor (« monde »)
 * derrière le pet, posé au sol. La taille du pet est FIXE (proportionnelle à la tuile) ; seule la
 * tuile se redimensionne. Pastille « en direct » + nom, comme une vignette d'appel.
 */
export function CompanionCam({
  url,
  animId,
  world,
  size,
  name = 'Dowze',
}: {
  url: string;
  animId: string;
  world: string;
  size: number; // largeur de la tuile
  name?: string;
}) {
  const w = size;
  const h = Math.round(size * CAM_RATIO);
  const petH = Math.round(h * 0.62); // pet fixe, ~62 % de la hauteur de la tuile

  return (
    <div
      className="relative overflow-hidden rounded-2xl border border-black/10 shadow-xl ring-1 ring-black/5"
      style={{ width: w, height: h }}
    >
      <World id={world} />
      {/* Le pet, posé au sol, centré */}
      <div className="absolute left-1/2 -translate-x-1/2" style={{ bottom: Math.round(h * 0.05) }}>
        <CodexPet url={url} animId={animId} size={petH} />
      </div>
      {/* Vignette façon appel : pastille « en direct » + nom */}
      <div className="absolute bottom-1.5 left-2 flex items-center gap-1.5 rounded-full bg-black/45 px-2 py-0.5 text-[11px] font-medium text-white backdrop-blur-sm">
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />
        {name?.trim() || 'Dowze'}
      </div>
    </div>
  );
}
