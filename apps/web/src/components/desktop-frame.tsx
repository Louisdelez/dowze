'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { isDesktop } from '@/lib/desktop';
import { DesktopTitlebar } from '@/components/desktop-titlebar';

/**
 * Cadre de l'application de bureau : barre de titre custom (thème Dowze) en haut,
 * le reste occupe la hauteur restante. En navigateur web, passe-plat (aucun changement).
 */
export function DesktopFrame({ children }: { children: ReactNode }) {
  const [desktop, setDesktop] = useState(false);
  useEffect(() => { setDesktop(isDesktop()); }, []);

  if (!desktop) return <>{children}</>;

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-surface">
      <DesktopTitlebar />
      <div className="flex min-h-0 flex-1 overflow-hidden">{children}</div>
    </div>
  );
}
