'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getSupabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardTitle } from '@/components/ui/card';
import { TextField } from '@/components/ui/field';
import { Note } from '@/components/ui/note';

export default function ConnexionPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [erreur, setErreur] = useState('');
  const [enCours, setEnCours] = useState(false);

  async function connecter() {
    setErreur('');
    setEnCours(true);
    try {
      const { error } = await getSupabase().auth.signInWithPassword({ email, password });
      if (error) throw error;
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
        <CardTitle>Se connecter</CardTitle>
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
          onKeyDown={(e) => e.key === 'Enter' && email && password && connecter()}
        />
        <Button onClick={connecter} disabled={enCours || !email || !password} className="w-full">
          {enCours ? 'Connexion…' : 'Se connecter'}
        </Button>
        {erreur && <Note tone="error">{erreur}</Note>}
        <p className="text-center text-sm text-muted-foreground">
          Pas encore de compte ?{' '}
          <Link
            href="/inscription"
            className="font-medium text-accent underline-offset-2 hover:underline"
          >
            S’inscrire
          </Link>
        </p>
      </Card>
    </div>
  );
}
