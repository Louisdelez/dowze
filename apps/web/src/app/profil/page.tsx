'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { getSupabase } from '@/lib/supabase';
import { useProfile } from '@/lib/use-profile';
import { useSession } from '@/lib/session';
import { getMe, requestReset, updateMyProfile, type MeResult } from '@/lib/api';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardTitle, CardDescription } from '@/components/ui/card';
import { TextField } from '@/components/ui/field';
import { Note } from '@/components/ui/note';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';

export default function ProfilPage() {
  const { profileId, ready, signedIn } = useProfile();
  const setSession = useSession((s) => s.setSession);

  const [me, setMe] = useState<MeResult | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [chargement, setChargement] = useState(true);
  const [message, setMessage] = useState('');
  const [erreur, setErreur] = useState('');
  const [enCours, setEnCours] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const charger = useCallback(async () => {
    setChargement(true);
    setErreur('');
    try {
      const res = await getMe();
      setMe(res);
      setDisplayName(res.profile?.displayName ?? '');
      setBirthDate(res.profile?.birthDate ?? '');
      setPhotoUrl(res.profile?.photoUrl ?? null);
      setEmail(res.account.email);
    } catch (e) {
      setErreur(String(e instanceof Error ? e.message : e));
    } finally {
      setChargement(false);
    }
  }, []);

  useEffect(() => {
    if (signedIn) void charger();
  }, [signedIn, charger]);

  async function enregistrerProfil() {
    setEnCours(true);
    setMessage('');
    setErreur('');
    try {
      const updated = await updateMyProfile({
        displayName: displayName.trim(),
        birthDate: birthDate || null,
        photoUrl,
      });
      if (updated && me) {
        setSession({ accountId: me.account.id, profileId: updated.id, displayName: updated.displayName });
      }
      setMessage('Profil enregistré.');
    } catch (e) {
      setErreur(String(e instanceof Error ? e.message : e));
    } finally {
      setEnCours(false);
    }
  }

  async function changerEmail() {
    setEnCours(true);
    setMessage('');
    setErreur('');
    try {
      const { error } = await getSupabase().auth.updateUser({ email });
      if (error) throw error;
      setMessage('Un email de confirmation vient de t’être envoyé pour valider la nouvelle adresse.');
    } catch (e) {
      setErreur(String(e instanceof Error ? e.message : e));
    } finally {
      setEnCours(false);
    }
  }

  async function changerMotDePasse() {
    setEnCours(true);
    setMessage('');
    setErreur('');
    try {
      const { error } = await getSupabase().auth.updateUser({ password: newPassword });
      if (error) throw error;
      setNewPassword('');
      setMessage('Mot de passe mis à jour.');
    } catch (e) {
      setErreur(String(e instanceof Error ? e.message : e));
    } finally {
      setEnCours(false);
    }
  }

  async function televerserPhoto(file: File) {
    setEnCours(true);
    setMessage('');
    setErreur('');
    try {
      const ext = file.name.split('.').pop() || 'jpg';
      const path = `${profileId}/avatar.${ext}`;
      const supabase = getSupabase();
      const { error } = await supabase.storage
        .from('avatars')
        .upload(path, file, { upsert: true, contentType: file.type });
      if (error) throw error;
      const url = supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl;
      // Cache-buster pour voir la nouvelle image tout de suite.
      const busted = `${url}?v=${Date.now()}`;
      setPhotoUrl(busted);
      const updated = await updateMyProfile({ photoUrl: busted });
      if (updated) setMessage('Photo mise à jour.');
    } catch (e) {
      setErreur(String(e instanceof Error ? e.message : e));
    } finally {
      setEnCours(false);
    }
  }

  if (!ready) return <Skeleton className="h-40" />;
  if (!signedIn) {
    return (
      <EmptyState
        title="Connecte-toi"
        description="Tu dois être connecté·e pour voir ton profil."
        action={<Link href="/connexion" className="text-accent underline-offset-2 hover:underline">Se connecter</Link>}
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Mon profil" subtitle="Tes informations personnelles, à toi de les gérer." />

      {chargement ? (
        <Skeleton className="h-40" />
      ) : (
        <>
          <Card className="space-y-4">
            <CardTitle>Photo &amp; identité</CardTitle>
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 overflow-hidden rounded-full border border-border bg-muted">
                {photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={photoUrl} alt="Photo de profil" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-lg text-muted-foreground">
                    {displayName.slice(0, 1).toUpperCase() || '?'}
                  </div>
                )}
              </div>
              <div>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void televerserPhoto(f);
                  }}
                />
                <Button variant="secondary" onClick={() => fileRef.current?.click()} disabled={enCours}>
                  Changer la photo
                </Button>
              </div>
            </div>
            <TextField
              label="Pseudo"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Comment veux-tu qu’on t’appelle ?"
            />
            <TextField
              label="Date de naissance"
              type="date"
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
              hint="Sert à adapter ton parcours à ton âge."
            />
            <Button onClick={enregistrerProfil} disabled={enCours || !displayName.trim()}>
              {enCours ? 'Enregistrement…' : 'Enregistrer'}
            </Button>
          </Card>

          <Card className="space-y-4">
            <div>
              <CardTitle>Adresse e-mail</CardTitle>
              <CardDescription>Changer ton e-mail demande une confirmation par lien.</CardDescription>
            </div>
            <TextField
              label="E-mail"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
            <Button
              variant="secondary"
              onClick={changerEmail}
              disabled={enCours || !email || email === me?.account.email}
            >
              Mettre à jour l’e-mail
            </Button>
          </Card>

          <Card className="space-y-4">
            <CardTitle>Mot de passe</CardTitle>
            <TextField
              label="Nouveau mot de passe"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="new-password"
              placeholder="Au moins 8 caractères"
            />
            <Button
              variant="secondary"
              onClick={changerMotDePasse}
              disabled={enCours || newPassword.length < 8}
            >
              Changer le mot de passe
            </Button>
          </Card>

          <Card className="space-y-3">
            <div>
              <CardTitle>Code de suivi pour mon responsable</CardTitle>
              <CardDescription>
                Donne ce code à ton parent/responsable pour qu’il puisse suivre ta progression (jamais tes
                échanges privés). Tu sais ainsi exactement ce qu’il peut voir.
              </CardDescription>
            </div>
            {me && (
              <div className="flex items-center gap-2">
                <code className="flex-1 truncate rounded-md border border-border bg-muted px-3 py-2 text-sm">
                  {me.account.id}
                </code>
                <Button
                  variant="secondary"
                  onClick={async () => {
                    await navigator.clipboard.writeText(me.account.id);
                    setMessage('Code de suivi copié.');
                  }}
                >
                  Copier
                </Button>
              </div>
            )}
          </Card>

          <Card className="space-y-3">
            <div>
              <CardTitle>Mon parcours d’entrée</CardTitle>
              <CardDescription>Tu peux refaire ces étapes à tout moment (ton niveau s’ajuste).</CardDescription>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href="/presentation">
                <Button variant="secondary">Refaire ma présentation</Button>
              </Link>
              <Link href="/placement">
                <Button variant="secondary">Refaire mon test d’entrée</Button>
              </Link>
            </div>
          </Card>

          {profileId && <ResetZone profileId={profileId} />}

          {message && <Note tone="info">{message}</Note>}
          {erreur && <Note tone="error">{erreur}</Note>}
        </>
      )}
    </div>
  );
}

function ResetZone({ profileId }: { profileId: string }) {
  const [done, setDone] = useState<string | null>(null);
  async function demander() {
    if (!confirm('Demander la remise à 0 de TOUS tes messages et amis ? Ton compte reste intact.')) return;
    const r = await requestReset(profileId, 'messages');
    setDone(
      r.status === 'pending_parent'
        ? 'Demande envoyée à ton responsable, puis à un modérateur.'
        : 'Demande envoyée à un modérateur pour validation.',
    );
  }
  return (
    <Card className="space-y-2 border-amber-300 bg-amber-50/50">
      <CardTitle>Remise à 0</CardTitle>
      <CardDescription>
        Effacer <strong>tous</strong> tes messages et amis, et repartir de zéro. Ton compte, ta progression et
        tes rangs sont conservés. Une validation par un modérateur est nécessaire.
      </CardDescription>
      {done ? (
        <Note tone="info">{done}</Note>
      ) : (
        <div>
          <Button variant="secondary" onClick={demander}>Demander la remise à 0</Button>
        </div>
      )}
    </Card>
  );
}
