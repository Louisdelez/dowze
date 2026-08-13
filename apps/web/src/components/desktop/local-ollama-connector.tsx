'use client';

import { useEffect } from 'react';
import { getSupabase } from '@/lib/supabase';
import { isDesktop } from '@/lib/desktop';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:3001';

type TauriWindow = Window & {
  __TAURI__?: {
    core?: { invoke: (command: string, args?: Record<string, unknown>) => Promise<unknown> };
  };
};

/**
 * Relais sortant : le desktop interroge Dowze avec la session du compte, exécute sur
 * 127.0.0.1 via IPC Rust, puis remet le résultat. Le serveur ne contacte jamais le LAN du client.
 */
export function LocalOllamaConnector() {
  useEffect(() => {
    if (!isDesktop()) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const poll = async () => {
      try {
        const { data } = await getSupabase().auth.getSession();
        const token = data.session?.access_token;
        const invoke = (window as TauriWindow).__TAURI__?.core?.invoke;
        if (!token || !invoke) return;
        const response = await fetch(`${API_BASE}/copilote/local/jobs/next`, {
          headers: { authorization: `Bearer ${token}` },
        });
        if (!response.ok) return;
        const { job } = (await response.json()) as {
          job: { id: string; payload: Record<string, unknown> } | null;
        };
        if (!job) return;
        let body: { result?: unknown; error?: string };
        try {
          body = { result: await invoke('ollama_request', { payload: job.payload }) };
        } catch (error) {
          body = { error: error instanceof Error ? error.message : String(error) };
        }
        await fetch(`${API_BASE}/copilote/local/jobs/${job.id}/result`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
          body: JSON.stringify(body),
        });
      } finally {
        if (!stopped) timer = setTimeout(poll, 750);
      }
    };
    void poll();
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
    };
  }, []);
  return null;
}
