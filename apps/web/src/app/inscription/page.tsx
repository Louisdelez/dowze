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

/** Âge en années révolues, ou null si la date est vide/invalide. */
function ageFromBirthDate(birthDate: string): number | null {
  if (!birthDate) return null;
  const born = new Date(birthDate);
  if (Number.isNaN(born.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - born.getFullYear();
  const m = now.getMonth() - born.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < born.getDate())) age -= 1;
  return age;
}

export default function InscriptionPage() {
  const router = useRouter();
  const setSession = useSession((s) => s.setSession);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [guardianEmail, setGuardianEmail] = useState('');
  const [erreur, setErreur] = useState('');
  const [enCours, setEnCours] = useState(false);

  // Le statut mineur se déduit de la date de naissance (plus de case à cocher).
  const age = ageFromBirthDate(birthDate);
  const tier: 'enfant' | 'mineur' | 'majeur' | null =
    age === null ? null : age <= 12 ? 'enfant' : age < 18 ? 'mineur' : 'majeur';
  const guardianRequired = age !== null && age < 18; // email parent obligatoire pour tout mineur
  const showGuardian = age !== null; // champ affiché pour tout le monde (optionnel pour les majeurs)

  // Libellé + aide selon le palier (wording issu de la recherche : « contact de confiance » pour les majeurs).
  const guardianLabel =
    tier === 'majeur'
      ? 'E-mail d’un contact de confiance (facultatif)'
      : 'E-mail d’un parent / responsable';
  const guardianHint =
    tier === 'enfant'
      ? 'Obligatoire en dessous de 13 ans. Ton parent recevra un e-mail et devra valider ton compte avant que tu puisses tout utiliser.'
      : tier === 'mineur'
        ? 'Obligatoire. Ton parent sera informé par e-mail. Il pourra, s’il le souhaite, suivre tes progrès et veiller sur tes échanges.'
        : 'Facultatif. Ajoute un proche qui pourra suivre ta progression et être alerté en cas de souci (harcèlement…). Il n’aura jamais accès à ton compte, et tu peux le retirer quand tu veux.';

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
        isMinor: age !== null && age < 18,
        displayName,
        locale: 'fr',
        timezone: tz,
        birthDate: birthDate || null,
        guardianEmail: guardianEmail.trim() || null,
      });
      setSession({ accountId: res.account.id, profileId: res.profile.id, displayName });
      router.push('/presentation');
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
        <TextField
          label="Date de naissance"
          type="date"
          value={birthDate}
          onChange={(e) => setBirthDate(e.target.value)}
          hint="Elle nous sert à adapter ton parcours à ton âge — et rien de plus."
        />
        {showGuardian && (
          <TextField
            label={guardianLabel}
            type="email"
            value={guardianEmail}
            onChange={(e) => setGuardianEmail(e.target.value)}
            hint={guardianHint}
            placeholder="parent@exemple.com"
          />
        )}
        <Button
          onClick={inscrire}
          disabled={
            enCours ||
            !email ||
            !password ||
            !displayName ||
            (guardianRequired && !guardianEmail.trim())
          }
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
