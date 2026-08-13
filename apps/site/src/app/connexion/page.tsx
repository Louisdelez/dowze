'use client';

import { useState } from 'react';
import { getSupabase, ACADEMIE } from '@/lib/auth';
import { AuthShell, Field, SubmitButton } from '@/components/auth-ui';

export default function Connexion() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function connecter() {
    setErr('');
    setBusy(true);
    try {
      const { error } = await getSupabase().auth.signInWithPassword({ email, password });
      if (error) throw error;
      window.location.href = ACADEMIE; // session posée sur .dowze.ch → connecté partout
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell title="Se connecter">
      <div className="space-y-4">
        <Field
          label="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="toi@exemple.com"
        />
        <Field
          label="Mot de passe"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && email && password && connecter()}
        />
        <SubmitButton onClick={connecter} disabled={busy || !email || !password}>
          {busy ? 'Connexion…' : 'Se connecter'}
        </SubmitButton>
        {err && (
          <p className="border-2 border-dowze-red bg-dowze-red/5 px-3 py-2 text-xs font-bold text-dowze-red">
            {err}
          </p>
        )}
        <p className="text-center text-xs font-bold uppercase italic tracking-tight text-black/60">
          Pas de compte ?{' '}
          <a href="/inscription" className="text-dowze-red hover:underline">
            S’inscrire
          </a>
        </p>
      </div>
    </AuthShell>
  );
}
