'use client';

import { useEffect, useState } from 'react';
import { useSession } from '@/lib/session';

/**
 * Identité de l'élève, tirée de la session (jamais d'UUID à saisir).
 * `ready` passe à true après hydratation → évite tout décalage serveur/client
 * et permet d'afficher un état vide « connecte-toi » plutôt qu'un champ brut.
 */
export function useProfile() {
  const profileId = useSession((s) => s.profileId);
  const accountId = useSession((s) => s.accountId);
  const displayName = useSession((s) => s.displayName);
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  return { profileId, accountId, displayName, ready, signedIn: ready && !!profileId };
}
