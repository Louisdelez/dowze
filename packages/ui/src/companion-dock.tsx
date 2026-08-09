'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  CompanionApi,
  type CompanionAgent,
  type DowzeClient,
} from '@dowze/api-client';
import { CodexPet, curatedSheetUrl } from './codex-pet';

/**
 * CompanionDock — le compagnon COMMUN à toutes les apps Dowze.
 *
 * Bouton flottant (le compagnon) qui ouvre la messagerie de la « ruche » : on parle au compagnon
 * principal (orchestrateur), à un compagnon-agent (IA + mémoire), ou au relais Claude Code / Codex.
 * Autonome : ne dépend que d'un `DowzeClient` (auth de la session partagée `.dowze.ch`). Aucune
 * dépendance à l'académie — le même compagnon te suit dans academie, fitness, sports, alimentations…
 */

type Msg = { id: number; from: 'me' | 'them'; text: string; meta?: boolean };

export function CompanionDock({ client, corner = 'br' }: { client: DowzeClient; corner?: 'br' | 'bl' }) {
  const api = useRef<CompanionApi | null>(null);
  if (!api.current) api.current = new CompanionApi(client);

  const [open, setOpen] = useState(false);
  const [agents, setAgents] = useState<CompanionAgent[]>([]);
  const [sel, setSel] = useState<string | null>(null);
  const [convs, setConvs] = useState<Record<string, Msg[]>>({});
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const mid = useRef(1);
  const loaded = useRef(false);

  // Charge tous les compagnons (Maison + open-spaces) à la première ouverture.
  useEffect(() => {
    if (!open || loaded.current) return;
    loaded.current = true;
    (async () => {
      try {
        const spaces = await api.current!.spaces().catch(() => []);
        const lists = await Promise.all([api.current!.listAgents('home'), ...spaces.map((s) => api.current!.listAgents(s.id))]);
        const map = new Map<string, CompanionAgent>();
        for (const l of lists) for (const a of l) map.set(a.id, a);
        const all = [...map.values()];
        setAgents(all);
        const primary = all.find((a) => a.isPrimary) ?? all[0];
        if (primary) {
          setSel(primary.id);
          setConvs((prev) => (prev[primary.id] ? prev : { ...prev, [primary.id]: [{ id: mid.current++, from: 'them', text: primary.personality?.greeting || 'Coucou ! Je suis là, pour tout ce que tu veux.' }] }));
        }
      } catch { /* réseau */ }
    })();
  }, [open]);

  // Historique persistant (agents IA + relais) quand on ouvre un fil.
  useEffect(() => {
    if (!sel) return;
    const a = agents.find((x) => x.id === sel);
    // Mémoire persistante : abeilles IA, relais, et compagnons de la Maison (leaders, sauf le principal).
    if (!a || !(a.mode === 'agent' || a.mode === 'relay' || (a.space === 'home' && !a.isPrimary))) return;
    api.current!.messages(sel).then((msgs) => {
      if (!msgs.length) return;
      setConvs((prev) => ({ ...prev, [sel]: msgs.map((m, i) => ({ id: i + 1, from: (m.sender === 'me' ? 'me' : 'them') as 'me' | 'them', text: m.text })) }));
    }).catch(() => {});
  }, [sel, agents]);

  // Relais : sonde le fil ouvert (messages poussés par Claude Code / Codex) toutes les 5 s.
  useEffect(() => {
    if (!open || !sel) return;
    const a = agents.find((x) => x.id === sel);
    if (!a || a.mode !== 'relay') return;
    let live = true;
    const iv = window.setInterval(() => {
      api.current!.messages(sel).then((msgs) => {
        if (!live || !msgs.length) return;
        setConvs((prev) => ({ ...prev, [sel]: msgs.map((m, i) => ({ id: i + 1, from: (m.sender === 'me' ? 'me' : 'them') as 'me' | 'them', text: m.text })) }));
      }).catch(() => {});
    }, 5000);
    return () => { live = false; window.clearInterval(iv); };
  }, [open, sel, agents]);

  const push = useCallback((id: string, text: string, from: 'me' | 'them', meta?: boolean) => {
    setConvs((prev) => ({ ...prev, [id]: [...(prev[id] ?? []), { id: mid.current++, from, text, meta }] }));
  }, []);

  const send = useCallback(() => {
    const txt = draft.trim(); if (!txt || !sel) return;
    const a = agents.find((x) => x.id === sel); if (!a) return;
    setDraft('');
    push(sel, txt, 'me');
    setBusy(true);
    const done = () => setBusy(false);
    const err = () => { push(sel, '(Je ne peux pas répondre là — vérifie la clé IA du Copilote.)', 'them'); done(); };
    if (a.mode === 'relay') {
      api.current!.relaySay(txt).then(done).catch(() => { push(sel, '(Instruction non transmise, réessaie.)', 'them'); done(); });
    } else if (a.space === 'home') {
      // Compagnon de la MAISON = LEADER : il répond lui-même OU mobilise/crée des abeilles des open-spaces.
      api.current!.orchestrate(txt, a.isPrimary ? undefined : a.id).then((r) => {
        push(sel, r.reply, 'them');
        if (r.created?.length) push(sel, `a créé : ${r.created.join(', ')}`, 'them', true);
        if (r.delegates?.length) push(sel, `a mobilisé : ${r.delegates.map((d) => d.name).join(', ')}`, 'them', true);
        done();
      }).catch(err);
    } else if (a.mode === 'agent') {
      // Abeille d'open-space (travailleuse) : conversation individuelle directe.
      api.current!.chat(a.id, txt).then((r) => { push(sel, r.reply, 'them'); done(); }).catch(err);
    } else {
      window.setTimeout(() => { push(sel, 'Bien reçu, je m’en occupe !', 'them'); done(); }, 500);
    }
  }, [draft, sel, agents, push]);

  const selAgent = agents.find((a) => a.id === sel);
  const primaryUrl = (agents.find((a) => a.isPrimary)?.skinUrl) || curatedSheetUrl('super-nono-v2');
  const pos = corner === 'bl' ? 'left-4' : 'right-4';

  return (
    <div className={`fixed bottom-4 z-[900] ${pos}`}>
      {open && (
        <div className="mb-3 flex h-[520px] max-h-[80vh] w-[min(92vw,380px)] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
          {/* En-tête + sélecteur de compagnon */}
          <div className="flex items-center gap-2 border-b border-slate-100 px-3 py-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-100">
              {selAgent?.skinUrl && <span className="scale-[0.42]"><CodexPet url={selAgent.skinUrl} size={96} /></span>}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold text-slate-800">{selAgent?.name ?? 'Compagnon'}</div>
              <div className="truncate text-[11px] text-slate-400">{selAgent?.isPrimary ? 'Ta ruche — je mobilise l’équipe' : selAgent?.role || (selAgent?.mode === 'relay' ? 'Relais Claude Code / Codex' : 'Compagnon')}</div>
            </div>
            <button onClick={() => setOpen(false)} aria-label="Fermer" className="rounded-full p-1.5 text-slate-400 transition hover:bg-slate-100">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
            </button>
          </div>
          {agents.length > 1 && (
            <div className="flex shrink-0 gap-1.5 overflow-x-auto border-b border-slate-100 px-3 py-2">
              {agents.map((a) => (
                <button key={a.id} onClick={() => setSel(a.id)} title={a.name} className={`flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 transition ${sel === a.id ? 'border-slate-800' : 'border-transparent bg-slate-100 hover:border-slate-300'}`}>
                  {a.skinUrl ? <span className="scale-[0.4]"><CodexPet url={a.skinUrl} size={96} /></span> : <span className="text-[11px] font-bold text-slate-500">{a.name.slice(0, 2)}</span>}
                </button>
              ))}
            </div>
          )}
          {/* Fil */}
          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto bg-slate-50 px-3 py-3">
            {(sel ? convs[sel] ?? [] : []).map((m) => (
              m.meta ? (
                <div key={m.id} className="text-center text-[10px] italic text-slate-400">· {m.text} ·</div>
              ) : (
                <div key={m.id} className={`flex ${m.from === 'me' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] rounded-2xl px-3 py-1.5 text-sm ${m.from === 'me' ? 'bg-slate-800 text-white' : 'bg-white text-slate-700 shadow-sm'}`}>{m.text}</div>
                </div>
              )
            ))}
            {busy && <div className="flex justify-start"><div className="rounded-2xl bg-white px-3 py-1.5 text-sm text-slate-400 shadow-sm">…</div></div>}
          </div>
          {/* Saisie */}
          <div className="flex items-center gap-2 border-t border-slate-100 px-3 py-2">
            <input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); send(); } }} placeholder="Écris à ton compagnon…" className="min-w-0 flex-1 rounded-full bg-slate-100 px-4 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none" />
            <button onClick={send} disabled={!draft.trim()} aria-label="Envoyer" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-800 text-white transition hover:bg-slate-700 disabled:opacity-40">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 21.7a.5.5 0 0 0 .9 0l6.5-19a.5.5 0 0 0-.6-.6l-19 6.5a.5.5 0 0 0 0 .9l7.9 3.2a2 2 0 0 1 1.1 1.1z" /><path d="m21.9 2.1-11 11" /></svg>
            </button>
          </div>
        </div>
      )}
      {/* Bouton flottant = le compagnon */}
      <button onClick={() => setOpen((v) => !v)} aria-label="Mon compagnon" className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-white shadow-xl ring-1 ring-slate-200 transition hover:scale-105">
        <span className="scale-[0.6]"><CodexPet url={primaryUrl} size={96} /></span>
      </button>
    </div>
  );
}
