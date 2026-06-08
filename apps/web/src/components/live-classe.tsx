'use client';

import { useEffect, useRef, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { getSupabase } from '@/lib/supabase';
import { Card, CardTitle } from './ui/card';
import { Button } from './ui/button';

interface LiveMsg {
  authorId: string;
  body: string;
  at: string;
}

/**
 * Chat de classe en **direct** + **présence** (« qui est en ligne ») via
 * Supabase Realtime. Nécessite une instance Supabase qui tourne.
 */
export function LiveClasse({ classeId, profileId }: { classeId: string; profileId: string }) {
  const [messages, setMessages] = useState<LiveMsg[]>([]);
  const [online, setOnline] = useState(0);
  const [text, setText] = useState('');
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    if (!classeId) return;
    const supabase = getSupabase();
    const channel = supabase.channel(`classe:${classeId}`, {
      config: { presence: { key: profileId || 'anon' } },
    });
    channel
      .on('broadcast', { event: 'message' }, ({ payload }) =>
        setMessages((m) => [...m, payload as LiveMsg]),
      )
      .on('presence', { event: 'sync' }, () =>
        setOnline(Object.keys(channel.presenceState()).length),
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') void channel.track({ online: true });
      });
    channelRef.current = channel;
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [classeId, profileId]);

  function envoyer() {
    const msg: LiveMsg = {
      authorId: profileId || 'anon',
      body: text,
      at: new Date().toISOString(),
    };
    void channelRef.current?.send({ type: 'broadcast', event: 'message', payload: msg });
    setMessages((m) => [...m, msg]);
    setText('');
  }

  return (
    <Card className="space-y-3">
      <div className="flex items-center justify-between">
        <CardTitle>Classe en direct</CardTitle>
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <span className="inline-block h-2 w-2 rounded-full bg-accent" />
          {online} en ligne
        </span>
      </div>

      <div className="max-h-56 space-y-2 overflow-auto">
        {messages.map((m, i) => (
          <div key={`${m.at}-${i}`} className="rounded-md bg-muted p-2 text-sm">
            <span className="font-mono text-[10px] text-muted-foreground">{m.authorId}</span>
            <p>{m.body}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <input
          className="flex-1 rounded-md border border-border px-3 py-2 text-sm"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="message en direct…"
        />
        <Button onClick={envoyer} disabled={!text}>
          Envoyer
        </Button>
      </div>
    </Card>
  );
}
