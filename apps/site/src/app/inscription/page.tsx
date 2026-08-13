'use client';

import { useState } from 'react';
import { getSupabase, registerAccount, ageFromBirthDate, ACADEMIE } from '@/lib/auth';
import { AuthShell, Field, SubmitButton } from '@/components/auth-ui';

export default function Inscription() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [guardianEmail, setGuardianEmail] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const age = ageFromBirthDate(birthDate);
  const guardianRequired = age !== null && age < 18;
  const showGuardian = age !== null;
  const guardianLabel =
    age !== null && age >= 18
      ? 'Contact de confiance (facultatif)'
      : 'E-mail d’un parent / responsable';

  async function inscrire() {
    setErr('');
    setBusy(true);
    try {
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
      window.location.href = ACADEMIE; // compte créé + session partagée .dowze.ch
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell title="Créer un compte">
      <div className="space-y-4">
        <Field
          label="Prénom ou pseudo"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="Comment on t’appelle ?"
        />
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
          placeholder="Au moins 8 caractères"
        />
        <Field
          label="Date de naissance"
          type="date"
          value={birthDate}
          onChange={(e) => setBirthDate(e.target.value)}
          hint="Sert à adapter ton parcours à ton âge — rien de plus."
        />
        {showGuardian && (
          <Field
            label={guardianLabel}
            type="email"
            value={guardianEmail}
            onChange={(e) => setGuardianEmail(e.target.value)}
            placeholder="parent@exemple.com"
            hint={
              guardianRequired
                ? 'Obligatoire pour les mineurs. Ton parent devra valider ton compte.'
                : 'Facultatif — un proche qui pourra veiller sur ton compte.'
            }
          />
        )}
        <SubmitButton
          onClick={inscrire}
          disabled={
            busy ||
            !email ||
            !password ||
            !displayName ||
            (guardianRequired && !guardianEmail.trim())
          }
        >
          {busy ? 'Création…' : 'Créer mon compte'}
        </SubmitButton>
        {err && (
          <p className="border-2 border-dowze-red bg-dowze-red/5 px-3 py-2 text-xs font-bold text-dowze-red">
            {err}
          </p>
        )}
        <p className="text-center text-xs font-bold uppercase italic tracking-tight text-black/60">
          Déjà un compte ?{' '}
          <a href="/connexion" className="text-dowze-red hover:underline">
            Se connecter
          </a>
        </p>
      </div>
    </AuthShell>
  );
}
