'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import QRCode from 'qrcode';
import type { Friend, SocialOverview } from '@dowze/schemas';
import { useProfile } from '@/lib/use-profile';
import {
  acceptFriend,
  blockUser,
  getFriends,
  removeFriend,
  reportUser,
  requestFriend,
  searchProfiles,
  startDirect,
} from '@/lib/api';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardTitle } from '@/components/ui/card';
import { TextField } from '@/components/ui/field';
import { EmptyState } from '@/components/ui/empty-state';
import { Avatar } from '@/components/messenger';
import { IconMore } from '@/components/ui/icons';

export default function AmisPage() {
  const { profileId, ready, signedIn } = useProfile();
  const [ov, setOv] = useState<SocialOverview | null>(null);
  const [q, setQ] = useState('');
  const [results, setResults] = useState<Friend[]>([]);
  const [copied, setCopied] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const router = useRouter();
  const adopted = useRef(false);

  const charger = useCallback(async () => {
    if (!profileId) return;
    setOv(await getFriends(profileId));
  }, [profileId]);

  useEffect(() => {
    if (signedIn) void charger();
  }, [signedIn, charger]);

  useEffect(() => {
    if (!profileId || adopted.current || typeof window === 'undefined') return;
    const add = new URLSearchParams(window.location.search).get('add');
    if (!add || add === profileId) return;
    adopted.current = true;
    void (async () => {
      await requestFriend(profileId, add).catch(() => {});
      router.replace('/amis');
      void charger();
    })();
  }, [profileId, router, charger]);

  useEffect(() => {
    if (!profileId || q.trim().length < 2) {
      setResults([]);
      return;
    }
    const t = setTimeout(async () => setResults(await searchProfiles(profileId, q)), 300);
    return () => clearTimeout(t);
  }, [q, profileId, ov]);

  const inviteLink = useMemo(
    () => (typeof window !== 'undefined' && profileId ? `${window.location.origin}/amis?add=${profileId}` : ''),
    [profileId],
  );
  const myCode = ov ? `${ov.meName}${ov.meTag ? `#${ov.meTag}` : ''}` : '';

  async function toggleQr() {
    if (qr) return setQr(null);
    if (inviteLink) setQr(await QRCode.toDataURL(inviteLink, { margin: 1, width: 200 }));
  }
  function copy(value: string, key: string) {
    navigator.clipboard?.writeText(value).then(() => {
      setCopied(key);
      setTimeout(() => setCopied(null), 1500);
    });
  }

  if (!ready) return null;
  if (!signedIn || !profileId) {
    return (
      <EmptyState
        title="Connecte-toi pour retrouver tes amis"
        description="Ajoute des amis et discute en individuel ou en groupe."
        action={<Link href="/connexion" className="text-accent underline-offset-2 hover:underline">Se connecter</Link>}
      />
    );
  }

  async function refresh(fn: Promise<SocialOverview>) {
    setOv(await fn);
  }
  async function message(friendId: string) {
    const { conversationId } = await startDirect(profileId!, friendId);
    router.push(`/messages/${conversationId}`);
  }
  async function bloquer(friendId: string, name: string) {
    if (!confirm(`Bloquer ${name} ?`)) return;
    await blockUser(profileId!, friendId);
    await charger();
  }
  async function signaler(friendId: string) {
    const reason = prompt('Signaler — que se passe-t-il ?');
    if (!reason || reason.trim().length < 3) return;
    await reportUser(profileId!, friendId, reason.trim(), null);
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <PageHeader title="Mes amis" subtitle="Ajoute des amis, discute en individuel ou en groupe." />

      {/* Ajouter un ami */}
      <Card className="space-y-3">
        <CardTitle>Ajouter un ami</CardTitle>
        <TextField
          label=""
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Rechercher un pseudo (Nom#1234)"
        />
        {results.length > 0 && (
          <div className="space-y-1.5">
            {results.map((r) => (
              <Line key={r.profileId} f={r}>
                {r.status === 'friends' ? (
                  <Button variant="secondary" onClick={() => message(r.profileId)}>Message</Button>
                ) : r.status === 'outgoing' ? (
                  <span className="text-xs text-muted-foreground">Envoyée</span>
                ) : r.status === 'incoming' ? (
                  <Button onClick={() => refresh(acceptFriend(profileId!, r.profileId))}>Accepter</Button>
                ) : (
                  <Button onClick={() => refresh(requestFriend(profileId!, r.profileId))}>Ajouter</Button>
                )}
              </Line>
            ))}
          </div>
        )}
        {/* Partage : pseudo, lien, QR */}
        <div className="flex flex-wrap items-center gap-2 border-t border-border/60 pt-3 text-sm">
          <button onClick={() => copy(myCode, 'code')} className="rounded-full border border-border px-3 py-1.5 hover:bg-muted">
            {copied === 'code' ? 'Copié !' : myCode || '…'}
          </button>
          <button onClick={() => copy(inviteLink, 'link')} className="rounded-full border border-border px-3 py-1.5 hover:bg-muted">
            {copied === 'link' ? 'Lien copié !' : 'Lien'}
          </button>
          <button onClick={toggleQr} className="rounded-full border border-border px-3 py-1.5 hover:bg-muted">
            {qr ? 'Masquer le QR' : 'QR'}
          </button>
        </div>
        {qr && (
          <div className="flex justify-center pt-1">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qr} alt="QR d'invitation" width={180} height={180} className="rounded-lg border border-border" />
          </div>
        )}
      </Card>

      {/* Demandes reçues */}
      {ov && ov.incoming.length > 0 && (
        <Card className="space-y-2">
          <CardTitle>Demandes reçues</CardTitle>
          {ov.incoming.map((f) => (
            <Line key={f.profileId} f={f}>
              <Button onClick={() => refresh(acceptFriend(profileId!, f.profileId))}>Accepter</Button>
              <Button variant="secondary" onClick={() => refresh(removeFriend(profileId!, f.profileId))}>Refuser</Button>
            </Line>
          ))}
        </Card>
      )}

      {/* Liste d'amis */}
      <Card className="space-y-2">
        <CardTitle>Amis {ov ? `(${ov.friends.length})` : ''}</CardTitle>
        {!ov || ov.friends.length === 0 ? (
          <p className="py-2 text-sm text-muted-foreground">Pas encore d'amis — ajoute quelqu'un ci-dessus.</p>
        ) : (
          ov.friends.map((f) => (
            <Line key={f.profileId} f={f}>
              <Button variant="secondary" onClick={() => message(f.profileId)}>Message</Button>
              <Overflow
                onRetirer={() => refresh(removeFriend(profileId!, f.profileId))}
                onBloquer={() => bloquer(f.profileId, f.name)}
                onSignaler={() => signaler(f.profileId)}
              />
            </Line>
          ))
        )}
      </Card>

      {ov && ov.outgoing.length > 0 && (
        <Card className="space-y-2">
          <CardTitle>Demandes envoyées</CardTitle>
          {ov.outgoing.map((f) => (
            <Line key={f.profileId} f={f}>
              <span className="text-xs text-muted-foreground">En attente</span>
            </Line>
          ))}
        </Card>
      )}
    </div>
  );
}

function Line({ f, children }: { f: Friend; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 rounded-lg px-1 py-1.5">
      <Avatar name={f.name} size={38} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">
          {f.name}
          {f.tag ? <span className="text-muted-foreground">#{f.tag}</span> : null}
        </p>
        <p className="text-xs text-muted-foreground">Niveau {f.level}</p>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">{children}</div>
    </div>
  );
}

function Overflow({ onRetirer, onBloquer, onSignaler }: { onRetirer: () => void; onBloquer: () => void; onSignaler: () => void }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, [open]);
  return (
    <div className="relative">
      <button
        onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}
        aria-label="Options"
        className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
      >
        <IconMore width={18} height={18} />
      </button>
      {open && (
        <div onClick={(e) => e.stopPropagation()} className="absolute right-0 top-full z-40 mt-1 w-40 overflow-hidden rounded-lg border border-border bg-background py-1 text-sm shadow-lg">
          <button onClick={() => { setOpen(false); onRetirer(); }} className="block w-full px-3 py-2 text-left hover:bg-muted">Retirer</button>
          <button onClick={() => { setOpen(false); onSignaler(); }} className="block w-full px-3 py-2 text-left hover:bg-muted">Signaler</button>
          <button onClick={() => { setOpen(false); onBloquer(); }} className="block w-full px-3 py-2 text-left text-red-600 hover:bg-muted">Bloquer</button>
        </div>
      )}
    </div>
  );
}
