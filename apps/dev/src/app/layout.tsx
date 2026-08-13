import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Dowze Dev — Atelier de prompts assets',
  description: 'Prompts optimisés pour générer les assets PNG du jeu isométrique du compagnon.',
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
