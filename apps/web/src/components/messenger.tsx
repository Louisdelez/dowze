'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { ChatMessage, ConversationSummary, ConversationView } from '@dowze/schemas';
import { useProfile } from '@/lib/use-profile';
import {
  blockUser,
  getAccessToken,
  getConversation,
  getInbox,
  getPresence,
  heartbeatPresence,
  languageChatbot,
  realtimeStreamUrl,
  removeFriend,
  reportUser,
  sendMessage,
  sendTyping,
  startDirect,
  translateMessage,
} from '@/lib/api';
import { cn } from '@/lib/cn';
import { IconSend, IconMessage, IconSettings } from '@/components/ui/icons';

const AUTO_MS = 60 * 60 * 1000;
const PALETTE = [
  '#2563eb',
  '#7c3aed',
  '#db2777',
  '#059669',
  '#d97706',
  '#0891b2',
  '#dc2626',
  '#4f46e5',
];

function color(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length]!;
}
function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '?') + (parts[1]?.[0] ?? '')).toUpperCase();
}
function hhmm(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
function myLang(): string {
  if (typeof navigator !== 'undefined' && navigator.language)
    return navigator.language.split('-')[0] || 'fr';
  return 'fr';
}

export function Avatar({ name, size = 40 }: { name: string; size?: number }) {
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-full font-semibold text-white"
      style={{ width: size, height: size, background: color(name), fontSize: size * 0.4 }}
    >
      {initials(name)}
    </span>
  );
}

/**
 * Une conversation (autonome, temps réel) — bulles, en-tête, barre d'envoi collée en bas, menu
 * clic-droit. Utilisée par Messages (volet droit) et par « Ma classe » (plein écran).
 */
export function Chat({
  conversationId,
  titleOverride,
  showBack = false,
  onActivity,
  botLang,
}: {
  conversationId: string;
  titleOverride?: string;
  showBack?: boolean;
  onActivity?: () => void;
  /** Si défini (code langue), tape `/` pour parler avec le bot Dowze en langue cible (privé). */
  botLang?: string;
}) {
  const { profileId, signedIn } = useProfile();
  const router = useRouter();
  const [conv, setConv] = useState<ConversationView | null>(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [typingName, setTypingName] = useState<string | null>(null);
  const [online, setOnline] = useState(false);
  const [menu, setMenu] = useState<{ x: number; y: number; m: ChatMessage } | null>(null);
  const [translations, setTranslations] = useState<Record<string, string>>({});
  const [autoUntil, setAutoUntil] = useState<number | null>(null);
  const [now, setNow] = useState(0);
  const [tokens, setTokens] = useState(0);
  const [costUsd, setCostUsd] = useState(0);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const lastTyping = useRef(0);
  const inFlight = useRef<Set<string>>(new Set());
  const bottomRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    if (!profileId || !conversationId) return;
    setConv(await getConversation(profileId, conversationId));
  }, [profileId, conversationId]);

  useEffect(() => {
    setConv(null);
    setTranslations({});
    if (signedIn) void load();
  }, [signedIn, conversationId, load]);

  useEffect(() => {
    if (!signedIn || !profileId) return;
    let es: EventSource | null = null;
    let cancelled = false;
    let tt: ReturnType<typeof setTimeout> | null = null;
    (async () => {
      const token = await getAccessToken();
      if (cancelled) return;
      es = new EventSource(realtimeStreamUrl(profileId, token));
      es.onmessage = (ev) => {
        try {
          const e = JSON.parse(ev.data) as { type: string; conversationId?: string; name?: string };
          if (e.type === 'message' && e.conversationId === conversationId) {
            void load();
            onActivity?.();
          }
          if (e.type === 'typing' && e.conversationId === conversationId) {
            setTypingName(e.name ?? 'Quelqu’un');
            if (tt) clearTimeout(tt);
            tt = setTimeout(() => setTypingName(null), 4000);
          }
        } catch {
          /* ping */
        }
      };
    })();
    const fb = setInterval(load, 30000);
    return () => {
      cancelled = true;
      if (tt) clearTimeout(tt);
      clearInterval(fb);
      es?.close();
    };
  }, [signedIn, profileId, conversationId, load, onActivity]);

  useEffect(() => {
    if (!signedIn || !profileId) return;
    void heartbeatPresence(profileId);
    const hb = setInterval(() => void heartbeatPresence(profileId), 30000);
    const other = conv?.otherId;
    let pr: ReturnType<typeof setInterval> | null = null;
    if (other) {
      const check = async () => setOnline((await getPresence(profileId, [other]))[other] ?? false);
      void check();
      pr = setInterval(check, 20000);
    }
    return () => {
      clearInterval(hb);
      if (pr) clearInterval(pr);
    };
  }, [signedIn, profileId, conv?.otherId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conv?.messages.length, conversationId]);

  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, [menu]);

  useEffect(() => {
    if (!settingsOpen) return;
    const close = () => setSettingsOpen(false);
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, [settingsOpen]);

  const traduire = useCallback(
    async (id: string, body: string) => {
      if (!profileId || translations[id] || inFlight.current.has(id) || !body.trim()) return;
      inFlight.current.add(id);
      try {
        const r = await translateMessage(profileId, body, myLang());
        setTranslations((p) => ({ ...p, [id]: r.text }));
        if (!r.cached) {
          setTokens((t) => t + r.promptTokens + r.completionTokens);
          setCostUsd((c) => c + r.costUsd);
        }
      } catch {
        setTranslations((p) => ({ ...p, [id]: 'Traduction indisponible.' }));
      } finally {
        inFlight.current.delete(id);
      }
    },
    [profileId, translations],
  );

  useEffect(() => {
    if (autoUntil == null) return;
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [autoUntil]);
  useEffect(() => {
    if (autoUntil == null) return;
    if (Date.now() >= autoUntil) return setAutoUntil(null);
    for (const m of conv?.messages ?? []) {
      if (!m.mine && m.status === 'active' && !translations[m.id]) void traduire(m.id, m.body);
    }
  }, [autoUntil, now, conv?.messages, translations, traduire]);

  async function envoyer() {
    const raw = text.trim();
    if (!raw || !profileId) return;

    // Bot Dowze : `/` dans un salon de langue → Dowze répond DANS LE CANAL, visible par tout le groupe.
    if (botLang && raw.startsWith('/')) {
      const q = raw.replace(/^\/(dowze)?\s*/i, '').trim();
      if (!q) {
        setText('');
        return;
      }
      setText('');
      setBusy(true);
      try {
        await sendMessage(profileId, conversationId, q); // le message de l'élève (public)
        await load();
        await languageChatbot(profileId, conversationId, botLang, q); // Dowze poste sa réponse (public)
        await load();
        onActivity?.();
      } finally {
        setBusy(false);
      }
      return;
    }

    setBusy(true);
    try {
      await sendMessage(profileId, conversationId, raw);
      setText('');
      await load();
      onActivity?.();
    } finally {
      setBusy(false);
    }
  }

  async function actMessageIndividuel(senderId: string) {
    if (!profileId) return;
    const { conversationId: cid } = await startDirect(profileId, senderId);
    router.push(`/messages/${cid}`);
  }
  async function actBloquer(senderId: string, name: string) {
    if (!profileId || !confirm(`Bloquer ${name} ?`)) return;
    await blockUser(profileId, senderId);
    if (conv?.type === 'direct') router.push('/messages');
    else await load();
  }
  async function actSignaler(senderId: string) {
    if (!profileId) return;
    const reason = prompt('Signaler — que se passe-t-il ?');
    if (!reason || reason.trim().length < 3) return;
    await reportUser(profileId, senderId, reason.trim(), conversationId);
  }
  async function actRetirer(senderId: string, name: string) {
    if (!profileId || !confirm(`Retirer ${name} de tes amis ?`)) return;
    await removeFriend(profileId, senderId);
  }

  const remain = autoUntil ? Math.max(0, autoUntil - now) : 0;
  const mmss = `${String(Math.floor(remain / 60000)).padStart(2, '0')}:${String(Math.floor((remain % 60000) / 1000)).padStart(2, '0')}`;
  const title = titleOverride ?? conv?.title ?? '…';

  return (
    <div className="flex h-full min-h-0 w-full flex-col">
      <header className="flex items-center gap-3 border-b border-border px-3 py-2.5">
        {showBack && (
          <Link
            href="/messages"
            className="rounded-md p-1.5 hover:bg-muted md:hidden"
            aria-label="Retour"
          >
            ←
          </Link>
        )}
        <Avatar name={title} size={36} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{title}</p>
          {conv?.otherId ? (
            <p className="text-xs text-muted-foreground">{online ? 'en ligne' : 'hors ligne'}</p>
          ) : null}
        </div>
        <div className="relative">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setSettingsOpen((o) => !o);
            }}
            aria-label="Paramètres"
            className={cn(
              'flex h-9 w-9 items-center justify-center rounded-full hover:bg-muted',
              autoUntil && 'text-red-600',
            )}
          >
            <IconSettings width={18} height={18} />
          </button>
          {settingsOpen && (
            <div
              onClick={(e) => e.stopPropagation()}
              className="absolute right-0 top-full z-40 mt-1 w-56 overflow-hidden rounded-lg border border-border bg-background py-1 text-sm shadow-lg"
            >
              <button
                onClick={() => {
                  setAutoUntil(autoUntil ? null : Date.now() + AUTO_MS);
                  setSettingsOpen(false);
                }}
                className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-muted"
              >
                <span>Traduire automatiquement</span>
                <span
                  className={cn(
                    'h-4 w-4 rounded-full border',
                    autoUntil ? 'border-red-600 bg-red-600' : 'border-border',
                  )}
                />
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Bandeau rouge pleine largeur (entre la top-bar et les messages) quand l'auto-traduction est active. */}
      {autoUntil && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-red-700 bg-red-600 px-4 py-2 text-sm text-white">
          <span className="flex items-center gap-2 font-semibold">
            <span
              className="inline-block h-2 w-2 animate-pulse rounded-full bg-white"
              aria-hidden
            />
            Traduction automatique — {mmss}
          </span>
          <span className="text-xs opacity-90">
            {tokens} tokens · ≈ {costUsd.toFixed(4)} $ (estimation). Se désactive seule pour éviter
            des coûts non voulus.
          </span>
        </div>
      )}

      <div className="min-h-0 flex-1 space-y-1 overflow-y-auto bg-muted/20 px-3 py-3">
        {conv && conv.messages.length === 0 && (
          <p className="py-10 text-center text-sm text-muted-foreground">
            Aucun message — dis bonjour !
          </p>
        )}
        {conv?.messages.map((m, i) => {
          const prev = conv.messages[i - 1];
          const showName = !m.mine && conv.type !== 'direct' && prev?.senderId !== m.senderId;
          return (
            <div key={m.id} className={m.mine ? 'flex justify-end' : 'flex justify-start'}>
              <div
                onContextMenu={(e) => {
                  e.preventDefault();
                  setMenu({ x: e.clientX, y: e.clientY, m });
                }}
                className={cn(
                  'max-w-[78%] cursor-default rounded-2xl px-3 py-1.5 text-sm shadow-sm',
                  m.mine ? 'rounded-br-md bg-accent text-white' : 'rounded-bl-md bg-surface',
                )}
              >
                {showName && (
                  <p
                    className="mb-0.5 text-xs font-semibold"
                    style={{ color: color(m.senderName) }}
                  >
                    {m.senderName}
                  </p>
                )}
                {m.kind === 'subject_share' && m.meta?.subjectId ? (
                  <Link
                    href={`/validation/sujet/${String(m.meta.subjectId)}`}
                    className="underline underline-offset-2"
                  >
                    {m.body}
                  </Link>
                ) : (
                  <p className="whitespace-pre-wrap break-words">{m.body}</p>
                )}
                {translations[m.id] && (
                  <div
                    className={cn(
                      'mt-1 border-t pt-1',
                      m.mine ? 'border-white/25' : 'border-border',
                    )}
                  >
                    <p className="whitespace-pre-wrap break-words">{translations[m.id]}</p>
                  </div>
                )}
                <p
                  className={cn(
                    'mt-0.5 text-right text-[10px]',
                    m.mine ? 'text-white/70' : 'text-muted-foreground',
                  )}
                >
                  {hhmm(m.createdAt)}
                  {m.held && m.mine ? ' · en attente' : ''}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {typingName && (
        <p className="px-4 pb-1 text-xs italic text-muted-foreground">{typingName} écrit…</p>
      )}

      <div className="flex items-center gap-2 border-t border-border px-3 py-2.5">
        <input
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            const t = Date.now();
            if (profileId && t - lastTyping.current > 3000) {
              lastTyping.current = t;
              void sendTyping(profileId, conversationId);
            }
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              void envoyer();
            }
          }}
          placeholder="Écris un message…"
          className="min-w-0 flex-1 rounded-full border border-border bg-background px-4 py-2 text-sm outline-none focus:border-accent"
        />
        <button
          onClick={envoyer}
          disabled={busy || !text.trim()}
          aria-label="Envoyer"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent text-white disabled:opacity-40"
        >
          <IconSend width={18} height={18} />
        </button>
      </div>

      {menu && (
        <div
          className="fixed z-50 w-52 overflow-hidden rounded-lg border border-border bg-background py-1 text-sm shadow-lg"
          style={{
            top: Math.min(menu.y, (typeof window !== 'undefined' ? window.innerHeight : 0) - 210),
            left: Math.min(menu.x, (typeof window !== 'undefined' ? window.innerWidth : 0) - 220),
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {menu.m.kind !== 'subject_share' && (
            <MenuItem
              onClick={() => {
                void traduire(menu.m.id, menu.m.body);
                setMenu(null);
              }}
            >
              Traduire
            </MenuItem>
          )}
          {!menu.m.mine && (
            <>
              {conv?.type !== 'direct' && (
                <MenuItem
                  onClick={() => {
                    void actMessageIndividuel(menu.m.senderId);
                    setMenu(null);
                  }}
                >
                  Message individuel
                </MenuItem>
              )}
              <MenuItem
                onClick={() => {
                  void actRetirer(menu.m.senderId, menu.m.senderName);
                  setMenu(null);
                }}
              >
                Retirer l’ami
              </MenuItem>
              <MenuItem
                onClick={() => {
                  void actSignaler(menu.m.senderId);
                  setMenu(null);
                }}
              >
                Signaler
              </MenuItem>
              <MenuItem
                danger
                onClick={() => {
                  void actBloquer(menu.m.senderId, menu.m.senderName);
                  setMenu(null);
                }}
              >
                Bloquer
              </MenuItem>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/** Messages : liste des conversations (individuelles/groupes) + conversation ouverte. */
export function Messenger({ activeId }: { activeId: string | null }) {
  const { profileId, ready, signedIn } = useProfile();
  const router = useRouter();
  const [inbox, setInbox] = useState<ConversationSummary[]>([]);

  const loadInbox = useCallback(async () => {
    if (!profileId) return;
    setInbox(await getInbox(profileId));
  }, [profileId]);

  useEffect(() => {
    if (signedIn) void loadInbox();
  }, [signedIn, loadInbox, activeId]);

  // Rafraîchit la liste en temps réel (nouveau message dans n'importe quelle conversation).
  useEffect(() => {
    if (!signedIn || !profileId) return;
    let es: EventSource | null = null;
    let cancelled = false;
    (async () => {
      const token = await getAccessToken();
      if (cancelled) return;
      es = new EventSource(realtimeStreamUrl(profileId, token));
      es.onmessage = (ev) => {
        try {
          const e = JSON.parse(ev.data) as { type: string };
          if (e.type === 'message') void loadInbox();
        } catch {
          /* ping */
        }
      };
    })();
    return () => {
      cancelled = true;
      es?.close();
    };
  }, [signedIn, profileId, loadInbox]);

  if (!ready) return null;
  if (!signedIn) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-center text-sm text-muted-foreground">
        <div>
          Connecte-toi pour accéder à tes messages.{' '}
          <Link href="/connexion" className="text-accent underline-offset-2 hover:underline">
            Se connecter
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0">
      <aside
        className={cn(
          'flex w-full min-h-0 flex-col border-r border-border bg-surface md:w-80 md:shrink-0',
          activeId ? 'hidden md:flex' : 'flex',
        )}
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h1 className="text-lg font-semibold">Messages</h1>
          <Link href="/amis" className="text-xs text-accent underline-offset-2 hover:underline">
            Amis
          </Link>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {inbox.length === 0 ? (
            <p className="px-4 py-6 text-sm text-muted-foreground">
              Aucune conversation. Ajoute un ami pour discuter.
            </p>
          ) : (
            inbox.map((c) => (
              <button
                key={c.id}
                onClick={() => router.push(`/messages/${c.id}`)}
                className={cn(
                  'flex w-full items-center gap-3 px-3 py-3 text-left hover:bg-muted/60',
                  c.id === activeId && 'bg-muted',
                )}
              >
                <Avatar name={c.title} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate font-medium">{c.title}</span>
                    <span className="shrink-0 text-[11px] text-muted-foreground">
                      {hhmm(c.lastMessageAt)}
                    </span>
                  </div>
                  <p className="truncate text-sm text-muted-foreground">
                    {c.lastBody ?? 'Nouvelle conversation'}
                  </p>
                </div>
                {c.unread && (
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full bg-accent"
                    aria-label="non lu"
                  />
                )}
              </button>
            ))
          )}
        </div>
      </aside>

      <section className={cn('min-w-0 flex-1', activeId ? 'flex' : 'hidden md:flex')}>
        {!activeId ? (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-muted-foreground">
            <IconMessage width={40} height={40} className="opacity-40" />
            <p className="text-sm">Sélectionne une conversation</p>
          </div>
        ) : (
          <Chat key={activeId} conversationId={activeId} showBack onActivity={loadInbox} />
        )}
      </section>
    </div>
  );
}

function MenuItem({
  children,
  onClick,
  danger,
}: {
  children: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn('block w-full px-3 py-2 text-left hover:bg-muted', danger && 'text-red-600')}
    >
      {children}
    </button>
  );
}
