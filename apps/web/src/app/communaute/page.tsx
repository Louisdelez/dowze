'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import type { LanguageClass } from '@dowze/schemas';
import { getLanguageClasses, getMyClass } from '@/lib/api';
import { useProfile } from '@/lib/use-profile';
import { Chat, Avatar } from '@/components/messenger';
import { cn } from '@/lib/cn';

interface ClassItem {
  key: string;
  title: string;
  channelId: string | null;
  botLang?: string; // classe de langue → bot Dowze via `/`
}

/**
 * « Ma classe » — layout façon WhatsApp/Messages : liste verticale des groupes à gauche (classe
 * académique + un canal par langue apprise, « langue cible only ») et le chat du groupe sélectionné
 * à droite.
 */
export default function MaClassePage() {
  const { profileId, ready, signedIn } = useProfile();
  const [items, setItems] = useState<ClassItem[]>([]);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!signedIn || !profileId) return;
    let cancelled = false;
    void (async () => {
      try {
        const [c, langs] = await Promise.all([
          getMyClass(profileId),
          getLanguageClasses(profileId).catch(() => [] as LanguageClass[]),
        ]);
        if (cancelled) return;
        const list: ClassItem[] = [
          { key: 'classe', title: 'Classe principale', channelId: c.channelId },
          ...langs.map((l) => ({
            key: `lang-${l.targetLang}`,
            title: l.targetLangName,
            channelId: l.channelId,
            botLang: l.targetLang,
          })),
        ];
        setItems(list);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [signedIn, profileId]);

  const active = useMemo(() => items.find((i) => i.key === activeKey) ?? null, [items, activeKey]);

  if (!ready) return null;
  if (!signedIn) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-center text-sm text-muted-foreground">
        <div>
          Connecte-toi pour accéder à ta classe.{' '}
          <Link href="/connexion" className="text-accent underline-offset-2 hover:underline">Se connecter</Link>
        </div>
      </div>
    );
  }
  if (loading) {
    return <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Chargement…</div>;
  }

  return (
    <div className="flex h-full min-h-0">
      <aside
        className={cn(
          'flex w-full min-h-0 flex-col border-r border-border bg-surface md:w-80 md:shrink-0',
          active ? 'hidden md:flex' : 'flex',
        )}
      >
        <div className="min-h-0 flex-1 overflow-y-auto">
          {items.map((it) => (
            <button
              key={it.key}
              onClick={() => setActiveKey(it.key)}
              className={cn(
                'flex w-full items-center gap-3 px-3 py-3 text-left hover:bg-muted/60',
                it.key === activeKey && 'bg-muted',
              )}
            >
              <Avatar name={it.title} />
              <span className="min-w-0 flex-1 truncate font-medium">{it.title}</span>
            </button>
          ))}
        </div>
      </aside>

      <section className={cn('min-w-0 flex-1 flex-col', active ? 'flex' : 'hidden md:flex')}>
        {!active ? (
          <div className="flex h-full w-full items-center justify-center text-sm text-muted-foreground">
            Sélectionne une classe
          </div>
        ) : (
          <>
            <button
              onClick={() => setActiveKey(null)}
              className="border-b border-border px-4 py-2 text-left text-sm text-accent md:hidden"
            >
              ← Mes classes
            </button>
            <div className="min-h-0 flex-1">
              {active.channelId ? (
                <Chat key={active.key} conversationId={active.channelId} titleOverride={active.title} botLang={active.botLang} />
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                  Ta classe se prépare…
                </div>
              )}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
