import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';
import { SiteHeader } from '@/components/site-header';

export const metadata: Metadata = {
  title: 'Dowze — le système d’éducation 2.0',
  description:
    'Apprendre toute sa vie avec une IA-tuteur, sans école, lieu ni diplôme. Un commun ouvert.',
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, title: 'Dowze', statusBarStyle: 'default' },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr">
      <body>
        <SiteHeader />
        <main className="mx-auto max-w-5xl px-6 py-10">{children}</main>
      </body>
    </html>
  );
}
