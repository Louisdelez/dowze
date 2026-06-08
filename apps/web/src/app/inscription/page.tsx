'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabase } from '@/lib/supabase';
import { useSession } from '@/lib/session';
import { registerAccount } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardTitle } from '@/components/ui/card';

export default function InscriptionPage() {
  const router = useRouter();
  const setSession = useSession((s) => s.setSession);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [isMinor, setIsMinor] = useState(false);
  const [guardianEmail, setGuardianEmail] = useState('');
  const [erreur, setErreur] = useState('');
  const [enCours, setEnCours] = useState(false);

  async function inscrire() {
    setErreur('');
    setEnCours(true);
    try {
      const { data, error } = await getSupabase().auth.signUp({ email, password });
      if (error) throw error;
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Zurich';
      const res = await registerAccount({
        email,
        authUserId: data.user?.id ?? null,
        isMinor,
        displayName,
        locale: 'fr',
        timezone: tz,
        guardianEmail: isMinor ? guardianEmail : null,
      });
      setSession({ accountId: res.account.id, profileId: res.profile.id, displayName });
      router.push('/dashboard');
    } catch (e) {
      setErreur(String(e instanceof Error ? e.message : e));
    } finally {
      setEnCours(false);
    }
  }

  return (
    <div className="mx-auto max-w-md">
      <Card className="space-y-4">
        <CardTitle>Rejoindre Dowze</CardTitle>
        <input
          className="w-full rounded-md border border-border px-3 py-2 text-sm"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="Prénom / pseudo"
        />
        <input
          className="w-full rounded-md border border-border px-3 py-2 text-sm"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="email"
        />
        <input
          className="w-full rounded-md border border-border px-3 py-2 text-sm"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="mot de passe"
        />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={isMinor} onChange={(e) => setIsMinor(e.target.checked)} />
          Je suis mineur·e
        </label>
        {isMinor && (
          <input
            className="w-full rounded-md border border-border px-3 py-2 text-sm"
            type="email"
            value={guardianEmail}
            onChange={(e) => setGuardianEmail(e.target.value)}
            placeholder="email du responsable légal"
          />
        )}
        <Button onClick={inscrire} disabled={enCours || !email || !password || !displayName}>
          {enCours ? 'Création…' : 'Créer mon compte'}
        </Button>
        {erreur && <p className="text-sm text-red-700">{erreur}</p>}
      </Card>
    </div>
  );
}
