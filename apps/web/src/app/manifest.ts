import type { MetadataRoute } from 'next';

// Manifeste statique (nécessaire pour l'export statique du build desktop ; sans effet sur le web).
export const dynamic = 'force-static';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Dowze — école 2.0',
    short_name: 'Dowze',
    description: 'Apprendre toute sa vie avec une IA-tuteur. Un commun ouvert.',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#2f6f4f',
    lang: 'fr',
  };
}
