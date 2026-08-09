import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Inter } from 'next/font/google';
import './globals.css';
import { AppShell } from '@/components/app-shell';
import { DesktopFrame } from '@/components/desktop-frame';
import { SessionHydrator } from '@/components/session-hydrator';
import { SwUpdater } from '@/components/sw-updater';
import { CompanionProvider } from '@/components/companion/companion-provider';

// Inter = substitut open-source de « NotionInter » (cf. DESIGN.md).
const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });

export const metadata: Metadata = {
  title: 'Dowze — le système d’éducation 2.0',
  description:
    'Apprendre toute sa vie avec une IA-tuteur, sans école, lieu ni diplôme. Un commun ouvert.',
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, title: 'Dowze', statusBarStyle: 'default' },
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  // Build DESKTOP (export statique) = toujours le hub Dowze. Build WEB = on lit le domaine côté serveur
  // pour rendre le BON chrome (hub Dowze vs service Académie) dès le premier octet, sans flash.
  const desktopBuild = process.env.DESKTOP_BUILD === '1';
  let initialHost = '';
  if (!desktopBuild) {
    const { headers } = await import('next/headers');
    initialHost = (await headers()).get('host') ?? '';
  }
  return (
    <html lang="fr" className={inter.variable}>
      <body>
        <SwUpdater />
        <SessionHydrator />
        <CompanionProvider>
          <DesktopFrame>
            <AppShell initialHost={initialHost} forceHub={desktopBuild}>
              {children}
            </AppShell>
          </DesktopFrame>
        </CompanionProvider>
      </body>
    </html>
  );
}
