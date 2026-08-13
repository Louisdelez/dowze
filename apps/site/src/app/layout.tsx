import type { Metadata } from 'next';
import { Jost } from 'next/font/google';
import './globals.css';

// Jost = alternative libre à Futura (la police de Supreme). Lourde + oblique pour le même caractère.
const jost = Jost({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800', '900'],
  style: ['normal', 'italic'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Dowze — apprendre, bouger, vivre',
  description:
    "L'écosystème Dowze : un seul compagnon pour toute ta vie. Apprends sans plafond, avec l'IA.",
  metadataBase: new URL('https://dowze.ch'),
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={jost.className}>
      <body className="bg-white text-black">{children}</body>
    </html>
  );
}
