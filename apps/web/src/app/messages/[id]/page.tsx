import { ConversationClient } from './route-client';

// Requis pour l'export statique (build desktop) : la route est rendue côté client (useParams),
// la navigation vers un id se fait en client-side. En web (serveur), les autres ids sont rendus à la volée.
export function generateStaticParams() {
  // Une entrée placeholder suffit à l'export (l'id réel est lu au runtime via useParams ;
  // la navigation vers une vraie conversation se fait en client-side).
  return [{ id: 'placeholder' }];
}

export default function ConversationPage() {
  return <ConversationClient />;
}
