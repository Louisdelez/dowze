import type { ReactNode } from 'react';

/**
 * Décors (« mondes ») de la cam, rendus en SVG (zéro asset externe, net à toute taille, cohérent
 * clair/sombre). Chaque scène remplit la tuile (viewBox 4:3, `slice`). Le pet est posé devant, au sol.
 */
const SCENES: Record<string, ReactNode> = {
  'salle-de-classe': (
    <>
      <rect width="100" height="75" fill="#eef2f7" />
      <rect x="0" y="53" width="100" height="22" fill="#c9a37a" />
      <rect x="0" y="52" width="100" height="1.5" fill="#a9855f" />
      <rect x="7" y="8" width="50" height="30" rx="1.5" fill="#2f5d50" stroke="#20423a" strokeWidth="1" />
      <path d="M13 16 h20 M13 22 h30 M13 28 h16" stroke="#dfe9e4" strokeWidth="0.8" strokeLinecap="round" />
      <rect x="70" y="9" width="23" height="27" rx="1" fill="#bcd8f0" stroke="#8fb4d6" strokeWidth="1.2" />
      <path d="M81.5 9 v27 M70 22.5 h23" stroke="#8fb4d6" strokeWidth="0.9" />
    </>
  ),
  plage: (
    <>
      <defs>
        <linearGradient id="w-beach-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#79c6f5" />
          <stop offset="1" stopColor="#dcf1ff" />
        </linearGradient>
      </defs>
      <rect width="100" height="75" fill="url(#w-beach-sky)" />
      <circle cx="80" cy="15" r="8" fill="#ffe08a" />
      <rect x="0" y="44" width="100" height="15" fill="#3fa9d6" />
      <path d="M0 47 q8 -2 16 0 t16 0 t16 0 t16 0 t16 0 t16 0" fill="none" stroke="#bfe6f5" strokeWidth="0.7" />
      <rect x="0" y="58" width="100" height="17" fill="#f2dca0" />
      <path d="M0 60 q8 2 16 0 t16 0 t16 0 t16 0 t16 0 t16 0" fill="none" stroke="#e6c98a" strokeWidth="0.7" />
    </>
  ),
  piscine: (
    <>
      <rect width="100" height="75" fill="#e2f2fa" />
      <rect x="0" y="33" width="100" height="7" fill="#eef3f6" />
      <rect x="0" y="40" width="100" height="35" fill="#4fc3e8" />
      <path d="M0 47 h100 M0 55 h100 M0 63 h100 M25 40 v35 M50 40 v35 M75 40 v35" stroke="#79d4f0" strokeWidth="0.6" />
    </>
  ),
  espace: (
    <>
      <defs>
        <linearGradient id="w-space" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0b1030" />
          <stop offset="1" stopColor="#2a1e50" />
        </linearGradient>
      </defs>
      <rect width="100" height="75" fill="url(#w-space)" />
      <g fill="#ffffff">
        <circle cx="12" cy="12" r="0.7" />
        <circle cx="30" cy="8" r="0.5" />
        <circle cx="48" cy="16" r="0.8" />
        <circle cx="22" cy="26" r="0.5" />
        <circle cx="60" cy="10" r="0.6" />
        <circle cx="88" cy="40" r="0.7" />
        <circle cx="14" cy="46" r="0.6" />
        <circle cx="42" cy="52" r="0.5" />
        <circle cx="70" cy="48" r="0.6" />
      </g>
      <circle cx="78" cy="20" r="9" fill="#8b7fd6" />
      <ellipse cx="78" cy="20" rx="15" ry="3.5" fill="none" stroke="#c9bff0" strokeWidth="1.1" />
    </>
  ),
  foret: (
    <>
      <defs>
        <linearGradient id="w-forest" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#bfe6f2" />
          <stop offset="1" stopColor="#eaf7ee" />
        </linearGradient>
      </defs>
      <rect width="100" height="75" fill="url(#w-forest)" />
      <rect x="0" y="55" width="100" height="20" fill="#74be6f" />
      {[12, 34, 66, 88].map((x, i) => (
        <g key={x}>
          <rect x={x - 1} y={i % 2 ? 40 : 44} width="2" height={i % 2 ? 16 : 12} fill="#8a5a3b" />
          <path d={`M${x - 8} ${i % 2 ? 44 : 48} L${x} ${i % 2 ? 22 : 30} L${x + 8} ${i % 2 ? 44 : 48} Z`} fill="#3f9b5a" />
          <path d={`M${x - 6} ${i % 2 ? 36 : 40} L${x} ${i % 2 ? 20 : 28} L${x + 6} ${i % 2 ? 36 : 40} Z`} fill="#4fae67" />
        </g>
      ))}
    </>
  ),
  cafe: (
    <>
      <defs>
        <linearGradient id="w-cafe-win" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1c2550" />
          <stop offset="1" stopColor="#3a4a86" />
        </linearGradient>
      </defs>
      <rect width="100" height="75" fill="#f1e2cd" />
      <rect x="0" y="50" width="100" height="25" fill="#7a5230" />
      <rect x="0" y="49" width="100" height="1.5" fill="#5f3f24" />
      <rect x="9" y="9" width="34" height="28" rx="1" fill="url(#w-cafe-win)" stroke="#caa877" strokeWidth="1.4" />
      <circle cx="35" cy="17" r="3.2" fill="#f4ecc6" />
      <path d="M26 9 v28 M9 23 h34" stroke="#caa877" strokeWidth="1" />
      <rect x="66" y="6" width="10" height="7" rx="1.5" fill="#d9b98a" />
      <rect x="70" y="13" width="2" height="6" fill="#b8925f" />
    </>
  ),
};

export function World({ id }: { id: string }) {
  return (
    <svg
      viewBox="0 0 100 75"
      preserveAspectRatio="xMidYMid slice"
      className="pointer-events-none absolute inset-0 h-full w-full"
      aria-hidden="true"
    >
      {SCENES[id] ?? SCENES['salle-de-classe']}
    </svg>
  );
}
