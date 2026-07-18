'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getSupabase } from '@/lib/supabase';
import { useSession } from '@/lib/session';
import { registerAccount } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardTitle, CardDescription } from '@/components/ui/card';
import { TextField } from '@/components/ui/field';
import { Note } from '@/components/ui/note';

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
        <div>
          <CardTitle>Rejoindre Dowze</CardTitle>
          <CardDescription>
            Quelques secondes suffisent. Aucune carte, aucun engagement.
          </CardDescription>
        </div>
        <TextField
          label="Prénom ou pseudo"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="Comment veux-tu qu’on t’appelle ?"
        />
        <TextField
          label="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="toi@exemple.com"
        />
        <TextField
          label="Mot de passe"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Au moins 8 caractères"
        />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={isMinor} onChange={(e) => setIsMinor(e.target.checked)} />
          Je suis mineur·e
        </label>
        {isMinor && (
          <TextField
            label="Email du responsable légal"
            type="email"
            value={guardianEmail}
            onChange={(e) => setGuardianEmail(e.target.value)}
            hint="Il recevra un bilan bienveillant, jamais le contenu privé de tes échanges."
            placeholder="parent@exemple.com"
          />
        )}
        <Button
          onClick={inscrire}
          disabled={enCours || !email || !password || !displayName}
          className="w-full"
        >
          {enCours ? 'Création…' : 'Créer mon compte'}
        </Button>
        {erreur && <Note tone="error">{erreur}</Note>}
        <p className="text-center text-sm text-muted-foreground">
          Déjà un compte ?{' '}
          <Link
            href="/connexion"
            className="font-medium text-accent underline-offset-2 hover:underline"
          >
            Se connecter
          </Link>
        </p>
      </Card>
    </div>
  );
}
