'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getSupabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardTitle } from '@/components/ui/card';

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
        <Button onClick={connecter} disabled={enCours || !email || !password}>
          {enCours ? 'Connexion…' : 'Se connecter'}
        </Button>
        {erreur && <p className="text-sm text-red-700">{erreur}</p>}
        <p className="text-sm text-muted-foreground">
          Pas encore de compte ? <Link href="/inscription" className="underline">S’inscrire</Link>
        </p>
      </Card>
    </div>
  );
}
