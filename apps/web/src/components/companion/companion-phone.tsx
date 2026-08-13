'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { CodexPet } from '@/components/companion/codex-pet';
import {
  getCompanionAgents,
  getCompanionSpaces,
  chatCompanionAgent,
  getCompanionAgentMessages,
  orchestrateCompanion,
  relaySayCompanion,
  getCompanionVoiceSettings,
  type CompanionAgent,
  type CompanionVoiceSettings,
} from '@/lib/api';
import { isDesktop, webSearch, wikipediaSearch, openExternal, type WebResult } from '@/lib/desktop';
import {
  speakCompanionNaturally,
  stopCompanionVoice,
  transcribeRecordedVoice,
} from '@/lib/companion-voice';
import {
  COMPANION_DEVICE_APPS,
  getCompanionDeviceApp,
  type CompanionDeviceApp,
} from '@/components/companion/device-apps';

/* ---------- Icônes (Lucide inline, cohérent avec le reste du jeu) ---------- */
const I: Record<string, ReactNode> = {
  message: <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />,
  mail: (
    <>
      <rect width="20" height="16" x="2" y="4" rx="2" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </>
  ),
  x: <path d="M18 6 6 18M6 6l12 12" />,
  back: <path d="m15 18-6-6 6-6" />,
  send: (
    <>
      <path d="M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z" />
      <path d="m21.854 2.147-10.94 10.939" />
    </>
  ),
  signal: (
    <>
      <path d="M2 20h.01" />
      <path d="M7 20v-4" />
      <path d="M12 20v-8" />
      <path d="M17 20V8" />
      <path d="M22 4v16" />
    </>
  ),
  battery: (
    <>
      <rect width="16" height="10" x="2" y="7" rx="2" />
      <line x1="22" x2="22" y1="11" y2="13" />
      <rect width="10" height="6" x="4" y="9" rx="1" fill="currentColor" stroke="none" />
    </>
  ),
  grid: (
    <>
      <rect width="7" height="7" x="3" y="3" rx="1" />
      <rect width="7" height="7" x="14" y="3" rx="1" />
      <rect width="7" height="7" x="14" y="14" rx="1" />
      <rect width="7" height="7" x="3" y="14" rx="1" />
    </>
  ),
  users: (
    <>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </>
  ),
  globe: (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
      <path d="M2 12h20" />
    </>
  ),
  book: (
    <>
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </>
  ),
  external: (
    <>
      <path d="M15 3h6v6" />
      <path d="M10 14 21 3" />
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    </>
  ),
  mic: (
    <>
      <rect x="9" y="2" width="6" height="12" rx="3" />
      <path d="M5 10a7 7 0 0 0 14 0M12 17v5M8 22h8" />
    </>
  ),
};
const Ic = ({ k, size = 20 }: { k: string; size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    {I[k]}
  </svg>
);

type Msg = { id: number; from: 'me' | 'them'; text: string; at: number; meta?: boolean };
type Traits = string[];

/** Libellés lisibles des outils mobilisés par une abeille (boucle ReAct) → caption « a utilisé : … ». */
const TOOL_LABELS: Record<string, string> = {
  calculatrice: 'la calculatrice',
  date_heure: 'la date/heure',
  chercher_connaissances: 'tes connaissances',
};
const toolCaption = (used?: string[]): string | null =>
  used && used.length ? `a utilisé : ${used.map((t) => TOOL_LABELS[t] ?? t).join(', ')}` : null;

/** Réponse « message » (un peu plus longue que la bulle, style humain, zéro IA). */
function deviceReply(traits: Traits, nm: string, msg: string): string {
  const pick = (a: string[]) => a[Math.floor(Math.random() * a.length)]!;
  const has = (...k: string[]) => k.some((x) => traits.some((t) => t.toLowerCase().includes(x)));
  const m = msg.toLowerCase();
  if (/(bonjour|salut|coucou|hello|hey|yo)/.test(m))
    return pick([
      'Coucou ! Content de te lire.',
      'Salut ! Ça roule de ton côté ?',
      'Hé ! Je suis là si besoin.',
    ]);
  if (/(ça va|ca va|comment vas|la forme|tu vas)/.test(m))
    return pick([
      'Ça va super, merci ! Et toi, ça avance ?',
      'Nickel ! Je gambadais un peu.',
      'Au top. Tu veux qu’on fasse un truc ?',
    ]);
  if (/merci/.test(m))
    return pick([
      'Avec plaisir, quand tu veux !',
      'De rien !',
      'C’est normal, on est une équipe !',
    ]);
  if (/(bravo|super|génial|genial|trop bien|bien jou)/.test(m))
    return pick([
      'Merci beaucoup ! Ça motive.',
      'Héhé, j’ai fait de mon mieux !',
      'Trop cool que ça te plaise !',
    ]);
  if (/(ok|d'accord|daccord|entendu|compris|reçu|recu)/.test(m))
    return pick(['Reçu 5 sur 5 !', 'C’est noté, je m’en occupe.', 'Parfait, je m’y mets.']);
  if (/(fais|peux-tu|tu peux|va voir|regarde|occupe)/.test(m))
    return pick([
      'Je m’en occupe et je te tiens au courant.',
      'C’est parti, je reviens vers toi.',
      'Ok, je regarde ça et je te dis.',
    ]);
  if (m.trim().endsWith('?'))
    return pick([
      'Bonne question ! Laisse-moi voir…',
      'Hmm, je dirais oui, mais je vérifie.',
      'À creuser — je te réponds vite !',
    ]);
  if (has('taquin', 'malicieu', 'espiègle'))
    return pick([
      'Héhé, tu sais que tu me manquais ?',
      'Devine ce que j’ai vu tout à l’heure…',
      'Toujours partant pour une bêtise !',
    ]);
  if (has('calme', 'zen'))
    return pick([
      'Tranquille de mon côté, tout est en ordre.',
      'Je prends mon temps, mais c’est carré.',
    ]);
  if (has('énergi', 'sporti', 'vif'))
    return pick(['Allez, on avance, j’ai la pêche !', 'Prêt à tout, dis-moi quoi faire !']);
  return pick([
    'Je suis là si tu as besoin de moi !',
    `Dis-m’en plus, ${nm} t’écoute.`,
    'On continue quand tu veux !',
  ]);
}

/** Un « email » d'intro plus long (format humain, un seul bloc). */
function seedEmail(nm: string, traits: Traits): { subject: string; body: string } {
  const trait = traits[0] ? ` (plutôt ${traits[0]})` : '';
  return {
    subject: `Bien installé dans la maison`,
    body: `Salut !\n\nC'est ${nm}${trait}. Je voulais juste te dire que je suis bien arrivé et prêt à donner un coup de main quand tu veux. Pour l'instant je prends mes marques, je fais connaissance avec les autres et je repère un peu les lieux.\n\nDis-moi ce sur quoi tu veux que je me concentre, et je m'en occupe. Je te tiendrai au courant de l'avancement, ici ou en message rapide selon l'urgence.\n\nÀ très vite,\n${nm}`,
  };
}

/** Skin par défaut universel (robot « Nono ») : chaque compagnon a toujours un skin. */
const ROBOT_SKIN_URL = '/pets/super-nono-v2.webp';

interface BrowserSpeechRecognition {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult:
    | ((event: { results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean }> }) => void)
    | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
type BrowserSpeechRecognitionConstructor = new () => BrowserSpeechRecognition;

function recognitionConstructor(): BrowserSpeechRecognitionConstructor | null {
  if (typeof window === 'undefined') return null;
  const speechWindow = window as typeof window & {
    SpeechRecognition?: BrowserSpeechRecognitionConstructor;
    webkitSpeechRecognition?: BrowserSpeechRecognitionConstructor;
  };
  return speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition ?? null;
}

function browserVoiceStyle(companion: CompanionAgent): { rate: number; pitch: number } {
  const traits = companion.personality?.traits?.join(' ').toLowerCase() ?? '';
  return {
    rate: traits.includes('calme') ? 0.9 : traits.includes('énergi') ? 1.08 : 1,
    pitch: traits.includes('joyeu') ? 1.08 : 1,
  };
}

function Avatar({ a, size = 40 }: { a: CompanionAgent; size?: number }) {
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-200"
      style={{ width: size, height: size }}
    >
      <span style={{ transform: `scale(${(size / 96) * 0.9})` }}>
        <CodexPet url={a.skinUrl || ROBOT_SKIN_URL} animId="idle" size={96} />
      </span>
    </span>
  );
}

/** Barre de statut « OS ». */
function StatusBar() {
  const t = new Date();
  return (
    <div className="flex items-center justify-between px-5 py-1.5 text-[12px] font-semibold text-slate-800">
      <span className="tabular-nums">
        {t.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
      </span>
      <div className="flex items-center gap-1.5">
        <Ic k="signal" size={14} />
        <Ic k="battery" size={16} />
      </div>
    </div>
  );
}

function DeviceAppIcon({ app, compact = false }: { app: CompanionDeviceApp; compact?: boolean }) {
  return (
    <span
      className={`flex items-center justify-center font-black text-white shadow-lg ${compact ? 'h-10 w-10 rounded-xl text-sm' : 'h-14 w-14 rounded-2xl text-lg'}`}
      style={{
        background: `linear-gradient(145deg, ${app.color}, color-mix(in srgb, ${app.color} 72%, black))`,
      }}
    >
      {app.glyph}
    </span>
  );
}

function DesktopStatusBar() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);
  return (
    <div className="flex h-9 shrink-0 items-center justify-between bg-slate-950/90 px-4 text-xs text-white backdrop-blur">
      <div className="flex items-center gap-2 font-semibold">
        <span className="text-sky-400">◆</span> Dowze OS
      </div>
      <div className="text-white/75">Compagnon connecté</div>
      <div>{now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</div>
    </div>
  );
}

function EmbeddedDowzeApp({
  app,
  desktop,
  onHome,
}: {
  app: CompanionDeviceApp;
  desktop: boolean;
  onHome: () => void;
}) {
  return (
    <div className={`flex h-full flex-col bg-slate-100 ${desktop ? 'p-3 pt-2' : ''}`}>
      <div
        className={`flex shrink-0 items-center gap-2 border-b border-slate-200 bg-white px-3 py-2 ${desktop ? 'rounded-t-xl border-x border-t' : ''}`}
      >
        <button
          onClick={onHome}
          aria-label="Retour aux applications"
          className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
        >
          <Ic k="grid" size={17} />
        </button>
        <DeviceAppIcon app={app} compact />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold text-slate-800">{app.label}</div>
          {desktop && <div className="text-[10px] text-emerald-600">Application active</div>}
        </div>
        {desktop && (
          <div className="flex gap-1">
            <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
          </div>
        )}
      </div>
      <iframe
        src={`${app.href}${app.href.includes('?') ? '&' : '?'}device=companion`}
        title={app.label}
        className={`min-h-0 flex-1 bg-white ${desktop ? 'rounded-b-xl border-x border-b border-slate-200 shadow-2xl' : ''}`}
      />
    </div>
  );
}

/** Smartphone, tablette ou PC virtuel : même catalogue, présentation adaptée à l'appareil. */
export function CompanionDevice({
  mode,
  onClose,
  initialApp,
}: {
  mode: 'phone' | 'tablet' | 'desktop';
  onClose: () => void;
  initialApp?: string;
}) {
  const tablet = mode !== 'phone';
  const pc = mode === 'desktop';
  const [agents, setAgents] = useState<CompanionAgent[]>([]);
  const [app, setApp] = useState(initialApp ?? 'home');
  const nativeDesktop = isDesktop();
  const [convs, setConvs] = useState<Record<string, Msg[]>>({});
  const [sel, setSel] = useState<string | null>(null); // id agent sélectionné (messages) ou email
  const [draft, setDraft] = useState('');
  const [voiceMode, setVoiceMode] = useState(false);
  const [voiceSettings, setVoiceSettings] = useState<CompanionVoiceSettings | null>(null);
  const midRef = useState(() => ({ n: 1 }))[0];

  useEffect(() => {
    (async () => {
      try {
        const spaces = await getCompanionSpaces();
        const lists = await Promise.all([
          getCompanionAgents('home'),
          ...spaces.map((s) => getCompanionAgents(s.id)),
        ]);
        const map = new Map<string, CompanionAgent>();
        for (const l of lists) for (const a of l) map.set(a.id, a);
        setAgents([...map.values()]);
      } catch {
        /* réseau */
      }
    })();
  }, []);

  useEffect(() => {
    getCompanionVoiceSettings().then(setVoiceSettings).catch(() => {});
  }, []);

  // Conversations : chaque compagnon a un message d'accueil.
  useEffect(() => {
    if (!agents.length) return;
    setConvs((prev) => {
      const next = { ...prev };
      for (const a of agents) {
        if (!next[a.id]) {
          const traits = a.personality?.traits ?? [];
          const intro =
            a.mode === 'relay'
              ? 'Connecte ton Claude Code / Codex (bouton « Relais » dans Ma famille) et je t’afficherai son avancement ici — et tu pourras lui répondre.'
              : a.personality?.greeting || deviceReply(traits, a.name, 'bonjour');
          next[a.id] = [{ id: midRef.n++, from: 'them', text: intro, at: Date.now() - 3600_000 }];
        }
      }
      return next;
    });
    if (!sel && agents[0]) setSel(agents[0].id);
  }, [agents]);

  const send = useCallback(
    (voiceText?: string) => {
      const txt = (voiceText ?? draft).trim();
      if (!txt || !sel) return;
      setDraft('');
      const a = agents.find((x) => x.id === sel);
      if (!a) return;
      setConvs((prev) => ({
        ...prev,
        [sel]: [
          ...(prev[sel] ?? []),
          { id: midRef.n++, from: 'me', text: txt, at: Date.now() },
          {
            id: midRef.n++,
            from: 'them',
            text: `${a.name} réfléchit…`,
            at: Date.now(),
            meta: true,
          },
        ],
      }));
      const thinkingText = `${a.name} réfléchit…`;
      const push = (text: string, meta?: boolean) => {
        setConvs((prev) => ({
          ...prev,
          [sel]: [
            ...(prev[sel] ?? []).filter((message) => message.text !== thinkingText),
            { id: midRef.n++, from: 'them', text, at: Date.now(), meta },
          ],
        }));
        if (voiceMode && !meta && voiceSettings) {
          const style = browserVoiceStyle(a);
          void speakCompanionNaturally(text, voiceSettings, style.rate, style.pitch).catch(() => {});
        }
      };
      const aiErr = (e: unknown) =>
        push(
          /clé|BYOK|crédits|disponible|Service/i.test(String((e as Error)?.message))
            ? '(Je ne peux pas répondre : configure une clé IA dans les réglages du Copilote.)'
            : '(Oups, je n’ai pas pu répondre, réessaie.)',
        );
      if (a.mode === 'relay') {
        // Relais : l'instruction est mise en file ; TON Claude Code / Codex la lira via `dowze_get_messages`.
        relaySayCompanion(txt)
          .then(() => push('Instruction transmise au relais.', true))
          .catch(() => push('(Instruction non transmise, réessaie.)'));
      } else if (a.space === 'home') {
        // Compagnon de la MAISON = LEADER : il répond lui-même OU mobilise/crée des abeilles des open-spaces.
        orchestrateCompanion(txt, a.isPrimary ? undefined : a.id, {
          service: 'academie',
          route: window.location.pathname,
          page: document.title,
        })
          .then((r) => {
            push(r.reply);
            if (r.created?.length)
              push(
                `a créé ${r.created.length > 1 ? 'de nouvelles abeilles' : 'une nouvelle abeille'} : ${r.created.join(', ')}`,
                true,
              );
            if (r.delegates?.length)
              push(`a mobilisé : ${r.delegates.map((d) => d.name).join(', ')}`, true);
            const tc = toolCaption(r.toolsUsed);
            if (tc) push(tc, true);
          })
          .catch(aiErr);
      } else if (a.mode === 'agent') {
        // Abeille d'open-space (travailleuse) : conversation individuelle directe (mémoire + apprentissage + outils).
        chatCompanionAgent(a.id, txt)
          .then((r) => {
            push(r.reply);
            const tc = toolCaption(r.toolsUsed);
            if (tc) push(tc, true);
          })
          .catch(aiErr);
      } else {
        window.setTimeout(
          () => push(deviceReply(a.personality?.traits ?? [], a.name, txt)),
          700 + Math.random() * 700,
        );
      }
    },
    [draft, sel, agents, midRef, convs, voiceMode, voiceSettings],
  );

  // Charge l'historique PERSISTANT quand on ouvre la conversation d'un compagnon-agent OU du relais (mémoire).
  const loadedRef = useState(() => new Set<string>())[0];
  useEffect(() => {
    if (!sel) return;
    const a = agents.find((x) => x.id === sel);
    // Historique persistant : abeilles IA, relais, et compagnons de la Maison (leaders, sauf le principal qui n'a pas de mémoire).
    const hasMemory =
      a && (a.mode === 'agent' || a.mode === 'relay' || (a.space === 'home' && !a.isPrimary));
    if (!a || !hasMemory || loadedRef.has(sel)) return;
    loadedRef.add(sel);
    getCompanionAgentMessages(sel)
      .then((msgs) => {
        if (!msgs.length) return; // pas d'historique → on garde le message d'accueil
        setConvs((prev) => ({
          ...prev,
          [sel]: msgs.map((m, i) => ({
            id: i + 1,
            from: (m.sender === 'me' ? 'me' : 'them') as 'me' | 'them',
            text: m.text,
            at: m.at,
          })),
        }));
      })
      .catch(() => {});
  }, [sel, agents, loadedRef, midRef]);

  // Relais : sonde régulièrement le fil ouvert pour afficher en direct les messages poussés par Claude Code / Codex.
  useEffect(() => {
    if (app !== 'messages' || !sel) return;
    const a = agents.find((x) => x.id === sel);
    if (!a || a.mode !== 'relay') return;
    let live = true;
    const tick = () =>
      getCompanionAgentMessages(sel)
        .then((msgs) => {
          if (!live || !msgs.length) return;
          setConvs((prev) => ({
            ...prev,
            [sel]: msgs.map((m, i) => ({
              id: i + 1,
              from: (m.sender === 'me' ? 'me' : 'them') as 'me' | 'them',
              text: m.text,
              at: m.at,
            })),
          }));
        })
        .catch(() => {});
    const iv = window.setInterval(tick, 5000);
    return () => {
      live = false;
      window.clearInterval(iv);
    };
  }, [app, sel, agents]);

  const emails = useMemo(
    () => agents.map((a) => ({ a, ...seedEmail(a.name, a.personality?.traits ?? []) })),
    [agents],
  );

  const frame = pc
    ? 'h-[88vh] max-h-[900px] w-[96vw] max-w-6xl rounded-[16px] p-2'
    : tablet
      ? 'h-[84vh] max-h-[820px] w-[92vw] max-w-4xl rounded-[26px] p-2.5'
      : 'h-[86vh] max-h-[780px] w-[min(92vw,392px)] rounded-[44px] p-2.5';

  const selAgent = agents.find((a) => a.id === sel);
  const selEmail = emails.find((e) => e.a.id === sel);
  const deviceApp = getCompanionDeviceApp(app);

  return (
    <div
      className="absolute inset-0 z-50 flex items-center justify-center bg-black/50 p-3"
      onClick={onClose}
      onWheel={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div
        className={`relative bg-slate-900 shadow-2xl ${frame}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className={`flex h-full w-full flex-col overflow-hidden bg-white ${pc ? 'rounded-[10px]' : tablet ? 'rounded-[18px]' : 'rounded-[36px]'}`}
        >
          {pc ? <DesktopStatusBar /> : <StatusBar />}
          {/* Contenu de l'app */}
          <div className="min-h-0 flex-1">
            {app === 'home' && !pc && (
              <div
                className="flex h-full flex-col"
                style={{ background: 'linear-gradient(160deg,#6ea8e6,#8f7fe0)' }}
              >
                <div className="h-16 shrink-0" />
                <div className="grid flex-1 content-start grid-cols-4 gap-4 overflow-y-auto p-6 pt-3">
                  {[
                    { k: 'message', label: 'Messages', bg: '#22c55e', to: 'messages' as const },
                    { k: 'mail', label: 'Email', bg: '#0ea5e9', to: 'email' as const },
                    // « Recherche » = outils locaux de l'app de bureau (SearXNG/Wikipédia) — masqué sur le web.
                    ...(nativeDesktop
                      ? [{ k: 'search', label: 'Recherche', bg: '#8b5cf6', to: 'search' as const }]
                      : []),
                    ...COMPANION_DEVICE_APPS.map((item) => ({
                      k: item.id,
                      label: item.shortLabel,
                      bg: item.color,
                      to: item.id,
                      deviceApp: item,
                    })),
                  ].map((ap) => (
                    <button
                      key={ap.k}
                      onClick={() => {
                        setApp(ap.to);
                      }}
                      className="flex flex-col items-center gap-1"
                    >
                      <span
                        className="flex h-14 w-14 items-center justify-center rounded-2xl text-white shadow-lg"
                        style={{ background: ap.bg }}
                      >
                        {'deviceApp' in ap && ap.deviceApp ? (
                          ap.deviceApp.glyph
                        ) : (
                          <Ic k={ap.k} size={26} />
                        )}
                      </span>
                      <span className="text-[11px] font-medium text-white drop-shadow">
                        {ap.label}
                      </span>
                    </button>
                  ))}
                </div>
                <div className="flex justify-center pb-2">
                  <div className="h-1 w-28 rounded-full bg-white/60" />
                </div>
              </div>
            )}

            {app === 'home' && pc && (
              <div className="relative flex h-full flex-col overflow-hidden bg-[radial-gradient(circle_at_70%_20%,#38bdf8_0,#2563eb_28%,#172554_72%,#020617_100%)]">
                <div className="grid w-fit grid-cols-2 gap-x-5 gap-y-4 p-6">
                  {COMPANION_DEVICE_APPS.map((item) => (
                    <button
                      key={item.id}
                      onDoubleClick={() => setApp(item.id)}
                      onClick={() => setApp(item.id)}
                      className="flex w-24 flex-col items-center gap-1 rounded-xl p-2 text-white transition hover:bg-white/15"
                    >
                      <DeviceAppIcon app={item} />
                      <span className="text-center text-xs font-medium drop-shadow">
                        {item.shortLabel}
                      </span>
                    </button>
                  ))}
                </div>
                <div className="mt-auto flex justify-center pb-4">
                  <div className="flex items-center gap-2 rounded-2xl border border-white/20 bg-slate-950/55 p-2 shadow-2xl backdrop-blur-xl">
                    <button
                      onClick={() => setApp('messages')}
                      title="Messages"
                      className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500 text-white"
                    >
                      <Ic k="message" size={23} />
                    </button>
                    <button
                      onClick={() => setApp('email')}
                      title="Email"
                      className="flex h-12 w-12 items-center justify-center rounded-xl bg-sky-500 text-white"
                    >
                      <Ic k="mail" size={23} />
                    </button>
                    {COMPANION_DEVICE_APPS.slice(0, 4).map((item) => (
                      <button key={item.id} onClick={() => setApp(item.id)} title={item.label}>
                        <DeviceAppIcon app={item} compact />
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {app === 'messages' && (
              <div className="flex h-full">
                {/* Liste des conversations (toujours en tablette ; en tél. seulement si aucune sélection) */}
                {(tablet || !sel || false) && (
                  <div
                    className={`flex flex-col ${tablet ? 'w-64 shrink-0 border-r border-slate-200' : 'hidden'}`}
                  >
                    <ConvHeader onHome={() => setApp('home')} title="Messages" />
                    <ConvList agents={agents} convs={convs} sel={sel} onSel={setSel} />
                  </div>
                )}
                {/* Fil actif */}
                <div className="flex min-w-0 flex-1 flex-col">
                  {!tablet &&
                    (!sel ? (
                      <>
                        <ConvHeader onHome={() => setApp('home')} title="Messages" />
                        <ConvList agents={agents} convs={convs} sel={sel} onSel={setSel} />
                      </>
                    ) : (
                      <Thread
                        agent={selAgent}
                        msgs={sel ? (convs[sel] ?? []) : []}
                        draft={draft}
                        setDraft={setDraft}
                        send={send}
                        voiceMode={voiceMode}
                        setVoiceMode={setVoiceMode}
                        voiceSettings={voiceSettings}
                        onBack={() => setSel(null)}
                      />
                    ))}
                  {tablet &&
                    (selAgent ? (
                      <Thread
                        agent={selAgent}
                        msgs={sel ? (convs[sel] ?? []) : []}
                        draft={draft}
                        setDraft={setDraft}
                        send={send}
                        voiceMode={voiceMode}
                        setVoiceMode={setVoiceMode}
                        voiceSettings={voiceSettings}
                        onBack={null}
                      />
                    ) : (
                      <div className="flex flex-1 items-center justify-center text-sm text-slate-400">
                        Choisis une conversation
                      </div>
                    ))}
                </div>
              </div>
            )}

            {app === 'email' && (
              <div className="flex h-full">
                {(tablet || !sel) && (
                  <div
                    className={`flex flex-col ${tablet ? 'w-72 shrink-0 border-r border-slate-200' : 'w-full'}`}
                  >
                    <ConvHeader onHome={() => setApp('home')} title="Boîte de réception" />
                    <div className="min-h-0 flex-1 overflow-y-auto">
                      {emails.map((e) => (
                        <button
                          key={e.a.id}
                          onClick={() => setSel(e.a.id)}
                          className={`flex w-full items-start gap-3 border-b border-slate-100 px-4 py-3 text-left transition hover:bg-slate-50 ${sel === e.a.id ? 'bg-sky-50' : ''}`}
                        >
                          <Avatar a={e.a} size={38} />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-baseline justify-between gap-2">
                              <span className="truncate text-sm font-semibold text-slate-800">
                                {e.a.name}
                              </span>
                              <span className="shrink-0 text-[10px] text-slate-400">maint.</span>
                            </div>
                            <div className="truncate text-[13px] font-medium text-slate-700">
                              {e.subject}
                            </div>
                            <div className="truncate text-xs text-slate-400">
                              {e.body.split('\n')[0]}
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {(tablet || sel) && (
                  <div className="flex min-w-0 flex-1 flex-col">
                    {selEmail ? (
                      <>
                        <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-2.5">
                          {!tablet && (
                            <button
                              onClick={() => setSel(null)}
                              className="rounded-full p-1 text-slate-500 hover:bg-slate-100"
                            >
                              <Ic k="back" size={18} />
                            </button>
                          )}
                          <Avatar a={selEmail.a} size={32} />
                          <div className="min-w-0">
                            <div className="truncate text-sm font-semibold text-slate-800">
                              {selEmail.subject}
                            </div>
                            <div className="truncate text-xs text-slate-500">{selEmail.a.name}</div>
                          </div>
                        </div>
                        <div className="min-h-0 flex-1 overflow-y-auto whitespace-pre-line px-5 py-4 text-[14px] leading-relaxed text-slate-700">
                          {selEmail.body}
                        </div>
                      </>
                    ) : (
                      <div className="flex flex-1 items-center justify-center text-sm text-slate-400">
                        Choisis un email
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {app === 'search' && <SearchApp onHome={() => setApp('home')} />}
            {deviceApp && (
              <EmbeddedDowzeApp app={deviceApp} desktop={pc} onHome={() => setApp('home')} />
            )}
          </div>
        </div>
        {/* Fermer (hors écran, sur le cadre) */}
        <button
          onClick={onClose}
          aria-label="Fermer"
          className="absolute -right-2 -top-2 flex h-9 w-9 items-center justify-center rounded-full bg-white text-slate-700 shadow-lg ring-1 ring-black/10 transition hover:bg-slate-100"
        >
          <Ic k="x" size={18} />
        </button>
      </div>
    </div>
  );
}

/** Mini-app « Recherche » (desktop uniquement) : outils locaux SearXNG/DuckDuckGo + Wikipédia. */
function SearchApp({ onHome }: { onHome: () => void }) {
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<'web' | 'wiki'>('web');
  const [results, setResults] = useState<WebResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const run = useCallback(() => {
    const q = query.trim();
    if (!q || loading) return;
    setLoading(true);
    setError(null);
    setDone(false);
    const p = mode === 'wiki' ? wikipediaSearch(q) : webSearch(q);
    p.then((r) => {
      setResults(r);
      setDone(true);
    })
      .catch((e) => setError(String((e as Error)?.message || e)))
      .finally(() => setLoading(false));
  }, [query, mode, loading]);

  const badge = (src: string) =>
    src === 'wikipedia'
      ? 'Wikipédia'
      : src === 'searxng'
        ? 'Web'
        : src === 'duckduckgo'
          ? 'Web'
          : src;

  return (
    <div className="flex h-full flex-col bg-white">
      <ConvHeader onHome={onHome} title="Recherche" />
      <div className="border-b border-slate-100 px-3 pb-3 pt-2">
        <div className="mb-2 flex gap-1 rounded-lg bg-slate-100 p-1 text-[13px] font-medium">
          <button
            onClick={() => setMode('web')}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 ${mode === 'web' ? 'bg-white text-violet-600 shadow-sm' : 'text-slate-500'}`}
          >
            <Ic k="globe" size={15} /> Web
          </button>
          <button
            onClick={() => setMode('wiki')}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 ${mode === 'wiki' ? 'bg-white text-violet-600 shadow-sm' : 'text-slate-500'}`}
          >
            <Ic k="book" size={15} /> Wikipédia
          </button>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-2">
          <span className="text-slate-400">
            <Ic k="search" size={16} />
          </span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') run();
            }}
            placeholder={mode === 'wiki' ? 'Chercher dans Wikipédia…' : 'Chercher sur le web…'}
            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400"
            autoFocus
          />
          <button
            onClick={run}
            disabled={loading}
            className="rounded-full bg-violet-600 px-3 py-1 text-xs font-semibold text-white disabled:opacity-50"
          >
            {loading ? '…' : 'OK'}
          </button>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {error && (
          <div className="m-3 rounded-lg bg-rose-50 px-3 py-2 text-[13px] text-rose-600">
            {error}
          </div>
        )}
        {!error && done && results.length === 0 && (
          <div className="p-6 text-center text-sm text-slate-400">Aucun résultat.</div>
        )}
        {results.map((r, i) => (
          <button
            key={i}
            onClick={() => openExternal(r.url).catch(() => {})}
            className="block w-full border-b border-slate-100 px-4 py-3 text-left transition hover:bg-slate-50"
          >
            <div className="mb-0.5 flex items-center gap-2">
              <span className="rounded bg-violet-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-violet-600">
                {badge(r.source)}
              </span>
              <span className="truncate text-[13px] font-semibold text-slate-800">{r.title}</span>
              <span className="ml-auto shrink-0 text-slate-300">
                <Ic k="external" size={13} />
              </span>
            </div>
            {r.snippet && (
              <div className="line-clamp-2 text-xs leading-snug text-slate-500">{r.snippet}</div>
            )}
            <div className="mt-0.5 truncate text-[11px] text-slate-400">{r.url}</div>
          </button>
        ))}
        {!done && !loading && !error && (
          <div className="p-6 text-center text-sm text-slate-400">
            Cherche sur le web ou dans Wikipédia — les résultats s’ouvrent dans ton navigateur.
          </div>
        )}
      </div>
    </div>
  );
}

function ConvHeader({ onHome, title }: { onHome: () => void; title: string }) {
  return (
    <div className="flex items-center gap-2 border-b border-slate-200 px-3 py-2.5">
      <button
        onClick={onHome}
        aria-label="Accueil"
        className="rounded-full p-1 text-slate-500 hover:bg-slate-100"
      >
        <Ic k="grid" size={16} />
      </button>
      <span className="text-base font-bold text-slate-800">{title}</span>
    </div>
  );
}

function ConvList({
  agents,
  convs,
  sel,
  onSel,
}: {
  agents: CompanionAgent[];
  convs: Record<string, Msg[]>;
  sel: string | null;
  onSel: (id: string) => void;
}) {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      {agents.length === 0 && (
        <p className="p-6 text-center text-sm text-slate-400">Aucun compagnon.</p>
      )}
      {agents.map((a) => {
        const last = (convs[a.id] ?? [])[(convs[a.id]?.length ?? 1) - 1];
        return (
          <button
            key={a.id}
            onClick={() => onSel(a.id)}
            className={`flex w-full items-center gap-3 border-b border-slate-100 px-3 py-2.5 text-left transition hover:bg-slate-50 ${sel === a.id ? 'bg-emerald-50' : ''}`}
          >
            <Avatar a={a} size={42} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold text-slate-800">{a.name}</div>
              <div className="truncate text-xs text-slate-500">
                {last ? (last.from === 'me' ? 'Toi : ' : '') + last.text : ''}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

function Thread({
  agent,
  msgs,
  draft,
  setDraft,
  send,
  voiceMode,
  setVoiceMode,
  voiceSettings,
  onBack,
}: {
  agent: CompanionAgent | undefined;
  msgs: Msg[];
  draft: string;
  setDraft: (v: string) => void;
  send: (voiceText?: string) => void;
  voiceMode: boolean;
  setVoiceMode: (enabled: boolean) => void;
  voiceSettings: CompanionVoiceSettings | null;
  onBack: (() => void) | null;
}) {
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const voiceSupported = Boolean(
    voiceSettings &&
      (voiceSettings.sttProvider === 'browser'
        ? recognitionConstructor() !== null
        : voiceSettings.sttProvider !== 'local' || isDesktop()) &&
      (voiceSettings.sttProvider === 'browser' ||
        (typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia)),
  );

  async function listen() {
    if (listening) {
      if (voiceSettings?.sttProvider === 'browser') recognitionRef.current?.stop();
      else recorderRef.current?.stop();
      return;
    }
    if (!voiceSettings) return;
    stopCompanionVoice();
    setVoiceMode(true);
    setListening(true);
    if (voiceSettings.sttProvider !== 'browser') {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        streamRef.current = stream;
        const chunks: BlobPart[] = [];
        const recorder = new MediaRecorder(stream);
        recorderRef.current = recorder;
        recorder.ondataavailable = (event) => {
          if (event.data.size) chunks.push(event.data);
        };
        recorder.onstop = () => {
          const audio = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' });
          stream.getTracks().forEach((track) => track.stop());
          streamRef.current = null;
          recorderRef.current = null;
          setListening(false);
          void transcribeRecordedVoice(audio, voiceSettings)
            .then((transcript) => {
              if (transcript) send(transcript);
            })
            .catch(() => {});
        };
        recorder.onerror = () => {
          stream.getTracks().forEach((track) => track.stop());
          setListening(false);
        };
        recorder.start();
      } catch {
        setListening(false);
      }
      return;
    }
    const Recognition = recognitionConstructor();
    if (!Recognition) {
      setListening(false);
      return;
    }
    // L'utilisateur reprend la parole : le compagnon se tait immédiatement, comme dans une vraie
    // conversation. Le nouveau tour vocal remplace proprement la synthèse en cours.
    const recognition = new Recognition();
    recognitionRef.current = recognition;
    recognition.lang = 'fr-FR';
    recognition.interimResults = false;
    recognition.continuous = false;
    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .filter((result) => result.isFinal)
        .map((result) => result[0].transcript)
        .join(' ')
        .trim();
      if (transcript) send(transcript);
    };
    recognition.onend = () => {
      recognitionRef.current = null;
      setListening(false);
    };
    recognition.onerror = () => {
      recognitionRef.current = null;
      setListening(false);
    };
    recognition.start();
  }
  useEffect(
    () => () => {
      recognitionRef.current?.abort();
      recorderRef.current?.stop();
      streamRef.current?.getTracks().forEach((track) => track.stop());
      stopCompanionVoice();
    },
    [],
  );
  if (!agent)
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-slate-400">
        Choisis une conversation
      </div>
    );
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-2 border-b border-slate-200 px-3 py-2">
        {onBack && (
          <button
            onClick={onBack}
            aria-label="Retour"
            className="rounded-full p-1 text-slate-500 hover:bg-slate-100"
          >
            <Ic k="back" size={18} />
          </button>
        )}
        <Avatar a={agent} size={32} />
        <span className="text-sm font-semibold text-slate-800">{agent.name}</span>
      </div>
      <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto bg-slate-50 px-3 py-3">
        {msgs.map((m) =>
          m.meta ? (
            <div
              key={m.id}
              className="flex items-center justify-center gap-1.5 py-1 text-[11px] text-slate-400"
            >
              <Ic k="users" size={11} />
              {m.text}
            </div>
          ) : (
            <div key={m.id} className={`flex ${m.from === 'me' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[78%] rounded-2xl px-3 py-1.5 text-[13.5px] leading-snug ${m.from === 'me' ? 'rounded-br-md bg-emerald-500 text-white' : 'rounded-bl-md bg-white text-slate-700 shadow-sm'}`}
              >
                {m.text}
              </div>
            </div>
          ),
        )}
      </div>
      <div className="flex items-center gap-2 border-t border-slate-200 p-2">
        {voiceSupported && (
          <button
            onClick={() => void listen()}
            aria-label={listening ? 'Arrêter de parler' : 'Parler au compagnon'}
            title="Conversation vocale"
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition ${listening || voiceMode ? 'bg-rose-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
          >
            <Ic k="mic" size={16} />
          </button>
        )}
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              send();
            }
          }}
          placeholder="Message…"
          className="min-w-0 flex-1 rounded-full bg-slate-100 px-4 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none"
        />
        <button
          onClick={() => send()}
          disabled={!draft.trim()}
          aria-label="Envoyer"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white transition hover:bg-emerald-600 disabled:opacity-40"
        >
          <Ic k="send" size={16} />
        </button>
      </div>
    </div>
  );
}
