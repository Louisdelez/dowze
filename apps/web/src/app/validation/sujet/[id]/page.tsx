import { SujetPartageClient } from './route-client';

// Requis pour l'export statique (build desktop) : rendu côté client (useParams), navigation client-side.
// En web (serveur), les autres ids sont rendus à la volée.
export function generateStaticParams() {
  return [{ id: 'placeholder' }];
}

export default function SujetPartagePage() {
  return <SujetPartageClient />;
}
