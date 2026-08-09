'use client';

import { useState } from 'react';
import { getSupabase } from '@/lib/supabase';
import { registerAccount } from '@/lib/api';

/** Âge en années révolues, ou null si vide/invalide. */
function ageFrom(birthDate: string): number | null {
  if (!birthDate) return null;
  const b = new Date(birthDate);
  if (Number.isNaN(b.getTime())) return null;
  const n = new Date();
  let a = n.getFullYear() - b.getFullYear();
  const m = n.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && n.getDate() < b.getDate())) a -= 1;
  return a;
}

/**
 * Connexion / inscription GLOBALE Dowze (le lanceur). La session Supabase est posée sur `.dowze.ch`
 * → un seul compte pour TOUS les services. On ne quitte jamais le lanceur (pas de renvoi vers Académie).
 */
export function DowzeAuthModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [guardianEmail, setGuardianEmail] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const age = ageFrom(birthDate);
  const guardianRequired = age !== null && age < 18;

  async function submit() {
    setErr(''); setBusy(true);
    try {
      if (mode === 'login') {
        const { error } = await getSupabase().auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { data, error } = await getSupabase().auth.signUp({ email, password });
        if (error) throw error;
        await registerAccount({
          email,
          authUserId: data.user?.id ?? null,
          isMinor: age !== null && age < 18,
          displayName,
          locale: 'fr',
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Zurich',
          birthDate: birthDate || null,
          guardianEmail: guardianEmail.trim() || null,
        });
      }
      onDone(); // la session se propage à tous les services ; on reste dans le lanceur
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  const canSubmit = mode === 'login'
    ? !!email && !!password
    : !!email && !!password && !!displayName && (!guardianRequired || !!guardianEmail.trim());

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-3xl border border-border bg-surface p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-1 text-xs font-bold uppercase tracking-widest text-accent">Dowze</div>
        <h2 className="text-2xl font-black tracking-tight">{mode === 'login' ? 'Se connecter' : 'Créer un compte'}</h2>
        <p className="mt-1 text-sm text-muted-foreground">Un seul compte pour tous tes services.</p>

        <div className="mt-5 space-y-3">
          {mode === 'register' && (
            <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Prénom ou pseudo"
              className="w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm outline-none focus:border-accent" />
          )}
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email"
            className="w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm outline-none focus:border-accent" />
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mot de passe"
            onKeyDown={(e) => e.key === 'Enter' && canSubmit && submit()}
            className="w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm outline-none focus:border-accent" />
          {mode === 'register' && (
            <>
              <input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)}
                className="w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm outline-none focus:border-accent" />
              {age !== null && (
                <input type="email" value={guardianEmail} onChange={(e) => setGuardianEmail(e.target.value)}
                  placeholder={guardianRequired ? 'E-mail d’un parent (obligatoire)' : 'Contact de confiance (facultatif)'}
                  className="w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm outline-none focus:border-accent" />
              )}
            </>
          )}

          <button onClick={submit} disabled={busy || !canSubmit}
            className="w-full rounded-full bg-accent px-4 py-3 text-sm font-semibold text-accent-foreground transition hover:bg-accent-active disabled:opacity-40">
            {busy ? '…' : mode === 'login' ? 'Se connecter' : 'Créer mon compte'}
          </button>
          {err && <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs font-medium text-[#ef4444]">{err}</p>}

          <button onClick={() => { setErr(''); setMode(mode === 'login' ? 'register' : 'login'); }}
            className="w-full text-center text-xs font-medium text-muted-foreground transition hover:text-foreground">
            {mode === 'login' ? 'Pas de compte ? Créer un compte' : 'Déjà un compte ? Se connecter'}
          </button>
        </div>
      </div>
    </div>
  );
}
