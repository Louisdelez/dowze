import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Inter } from 'next/font/google';
import './globals.css';
import { AppShell } from '@/components/app-shell';
import { SessionHydrator } from '@/components/session-hydrator';

// Inter = substitut open-source de « NotionInter » (cf. DESIGN.md).
const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });

export const metadata: Metadata = {
  title: 'Dowze — le système d’éducation 2.0',
  description:
    'Apprendre toute sa vie avec une IA-tuteur, sans école, lieu ni diplôme. Un commun ouvert.',
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, title: 'Dowze', statusBarStyle: 'default' },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr" className={inter.variable}>
      <body>
        <SessionHydrator />
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
