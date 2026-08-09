'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { BlockType, Intensity, ScheduleBlock, ScheduleView } from '@dowze/schemas';
import { useProfile } from '@/lib/use-profile';
import { addVacation, getSchedule, removeVacation, setScheduleConfig, setSchedulePreset } from '@/lib/api';
import {
  addDays,
  addMonths,
  blockStyle,
  DAY_FULL,
  DAY_SHORT,
  fmtHour,
  MONTH_FULL,
  MONTH_SHORT,
  monthGrid,
  sameDay,
  startOfWeek,
  ymd,
} from '@/lib/calendar';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { IconArrowRight, IconCalendar, IconPalmtree, IconSettings, IconX } from '@/components/ui/icons';
import { cn } from '@/lib/cn';

/** Hauteur d'une heure en px — dynamique (zoom). Partagée via contexte pour éviter le prop-drilling. */
const HourPxCtx = createContext(48);
const useHourPx = () => useContext(HourPxCtx);
const ZOOM_MIN = 28;
const ZOOM_MAX = 120;
type View = 'jour' | 'semaine' | 'mois' | 'annee';

/** Libellé + bouton d'action par type de bloc d'étude (fiche popup façon Apple/Google). */
const TYPE_META: Record<Exclude<BlockType, 'plugin'>, { label: string; cta: string }> = {
  langue: { label: 'Cours de langue', cta: 'Aller au cours de langue' },
  revision: { label: 'Révisions', cta: 'Réviser maintenant' },
  cours: { label: 'Cours principaux', cta: 'Aller à ma séance' },
  expedition: { label: 'Expédition', cta: 'Voir mes expéditions' },
  passion: { label: 'Ma passion', cta: 'Ouvrir ma passion' },
};

/** Libellé secondaire + intitulé de bouton pour un bloc (gère les blocs plugin : « Ouvrir dans … »). */
function blockMeta(b: ScheduleBlock): { label: string; cta: string } {
  if (b.type === 'plugin') {
    return { label: b.appLabel ?? 'Activité', cta: `Ouvrir dans ${b.appLabel ?? "l'app"}` };
  }
  return TYPE_META[b.type];
}

/** Clic sur un événement → ouvre la fiche (au lieu d'aller directement au cours). */
type PopupState = { b: ScheduleBlock; date: Date; x: number; y: number };
const OpenBlockCtx = createContext<(b: ScheduleBlock, date: Date, e: { clientX: number; clientY: number }) => void>(
  () => {},
);

/** Fiche d'événement (popup façon Apple/Google) — infos + bouton pour aller au cours. */
function EventPopup({ popup, onClose }: { popup: PopupState; onClose: () => void }) {
  const router = useRouter();
  const { b, date, x, y } = popup;
  const st = blockStyle(b);
  const meta = blockMeta(b);
  const W = 300;
  const H = 210;
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1200;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
  const left = Math.max(12, Math.min(x + 8, vw - W - 12));
  const top = Math.max(12, Math.min(y + 8, vh - H - 12));
  return (
    <div className="fixed inset-0 z-50" onClick={onClose}>
      <div
        className="absolute w-[300px] rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl"
        style={{ left, top }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-2.5">
            <span className={cn('mt-1 h-3.5 w-3.5 rounded-full', st.bar)} />
            <div className="min-w-0">
              <div className="text-[15px] font-semibold leading-snug text-slate-800">{b.label}</div>
              <div className="text-sm text-slate-500">{meta.label}</div>
            </div>
          </div>
          <button onClick={onClose} aria-label="Fermer" className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100">
            <IconX width={16} height={16} />
          </button>
        </div>
        <div className="mt-3 space-y-0.5 text-sm text-slate-600">
          <div className="capitalize">{`${DAY_FULL[date.getDay()]} ${date.getDate()} ${MONTH_FULL[date.getMonth()]}`}</div>
          <div className="tabular-nums">
            {fmtHour(b.startMin)} – {fmtHour(b.startMin + b.durationMin)}{' '}
            <span className="text-slate-400">· {b.durationMin} min</span>
          </div>
        </div>
        {b.href && (
          <button
            onClick={() => {
              const href = b.href!;
              // Deep-link plugin (autre sous-domaine) → navigation complète ; page interne → router.
              if (href.startsWith('http')) window.location.assign(href);
              else router.push(href);
            }}
            className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:bg-accent-active"
          >
            {meta.cta} <IconArrowRight width={16} height={16} />
          </button>
        )}
      </div>
    </div>
  );
}

export default function PlanningPage() {
  const { profileId, ready, signedIn } = useProfile();
  const [data, setData] = useState<ScheduleView | null>(null);
  const [view, setView] = useState<View>('semaine');
  const [anchor, setAnchor] = useState<Date>(() => new Date());
  const [loading, setLoading] = useState(false);
  const [setup, setSetup] = useState(false);
  const [hourPx, setHourPx] = useState(48);
  const [popup, setPopup] = useState<PopupState | null>(null);
  const openBlock = useCallback(
    (b: ScheduleBlock, date: Date, e: { clientX: number; clientY: number }) => setPopup({ b, date, x: e.clientX, y: e.clientY }),
    [],
  );
  const rootRef = useRef<HTMLDivElement>(null);
  const zoom = useCallback((d: number) => setHourPx((h) => Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, h + d))), []);

  // Ctrl/Cmd + molette = zoom (comme Google Calendar) — listener natif non-passif pour bloquer le zoom navigateur.
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        setHourPx((h) => Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, h + (e.deltaY < 0 ? 6 : -6))));
      }
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const load = useCallback(async () => {
    if (!profileId) return;
    setLoading(true);
    try {
      setData(await getSchedule(profileId));
    } finally {
      setLoading(false);
    }
  }, [profileId]);

  useEffect(() => {
    if (signedIn) void load();
  }, [signedIn, load]);

  function step(dir: number) {
    if (view === 'jour') setAnchor((a) => addDays(a, dir));
    else if (view === 'semaine') setAnchor((a) => addDays(a, dir * 7));
    else if (view === 'mois') setAnchor((a) => addMonths(a, dir));
    else setAnchor((a) => new Date(a.getFullYear() + dir, a.getMonth(), 1));
  }

  const title = useMemo(() => {
    if (view === 'jour') return `${DAY_FULL[anchor.getDay()]} ${anchor.getDate()} ${MONTH_FULL[anchor.getMonth()]}`;
    if (view === 'annee') return String(anchor.getFullYear());
    if (view === 'mois') return `${MONTH_FULL[anchor.getMonth()]} ${anchor.getFullYear()}`;
    const s = startOfWeek(anchor);
    const e = addDays(s, 6);
    return `${s.getDate()} ${MONTH_SHORT[s.getMonth()]} – ${e.getDate()} ${MONTH_SHORT[e.getMonth()]} ${e.getFullYear()}`;
  }, [view, anchor]);

  if (ready && !signedIn) {
    return (
      <div className="p-6">
        <EmptyState
          icon={<IconCalendar />}
          title="Connecte-toi pour voir ton planning"
          description="Ton emploi du temps se construit automatiquement selon ton profil de disponibilité."
          action={
            <Link href="/connexion">
              <Button>Se connecter</Button>
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <HourPxCtx.Provider value={hourPx}>
    <OpenBlockCtx.Provider value={openBlock}>
    <div ref={rootRef} className="flex h-full min-h-0 flex-col">
      <header className="flex flex-wrap items-center gap-3 border-b border-slate-100 px-4 py-3">
        <h1 className="text-xl font-semibold capitalize tracking-tight text-slate-800">{title}</h1>
        <div className="flex items-center gap-0.5">
          <button onClick={() => step(-1)} aria-label="Précédent" className="flex h-8 w-8 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100">‹</button>
          <button onClick={() => setAnchor(new Date())} className="rounded-full border border-slate-200 px-3 py-1 text-sm text-slate-600 hover:bg-slate-50">Aujourd'hui</button>
          <button onClick={() => step(1)} aria-label="Suivant" className="flex h-8 w-8 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100">›</button>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <div className="flex items-center gap-0.5 rounded-lg bg-slate-100 p-0.5">
            {(['jour', 'semaine', 'mois', 'annee'] as View[]).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={cn('rounded-md px-3 py-1 text-sm transition', v === view ? 'bg-white font-medium text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700')}
              >
                {v === 'jour' ? 'Jour' : v === 'semaine' ? 'Semaine' : v === 'mois' ? 'Mois' : 'Année'}
              </button>
            ))}
          </div>
          {(view === 'semaine' || view === 'jour') && (
            <div className="flex items-center rounded-lg bg-slate-100 p-0.5">
              <button onClick={() => zoom(-8)} aria-label="Dézoomer" className="flex h-7 w-7 items-center justify-center rounded-md text-slate-600 hover:bg-white">−</button>
              <button onClick={() => zoom(8)} aria-label="Zoomer" className="flex h-7 w-7 items-center justify-center rounded-md text-slate-600 hover:bg-white">+</button>
            </div>
          )}
          <button onClick={() => setSetup(true)} aria-label="Réglages" className="flex h-8 w-8 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100">
            <IconSettings width={18} height={18} />
          </button>
        </div>
      </header>

      {data?.onVacation && (
        <div className="flex items-center gap-2 border-b border-border bg-slate-100 px-4 py-2 text-sm text-slate-600">
          <IconPalmtree width={16} height={16} /> Vacances — mode maintenance : quelques minutes suffisent à garder le fil.
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-hidden">
        {loading && !data ? (
          <div className="p-6 text-sm text-muted-foreground">Chargement…</div>
        ) : data ? (
          <>
            {view === 'semaine' && <WeekView data={data} anchor={anchor} onPickDay={(d) => { setAnchor(d); setView('jour'); }} />}
            {view === 'jour' && <DayView data={data} anchor={anchor} />}
            {(view === 'mois' || view === 'annee') && (
              <div className="h-full overflow-y-auto">
                {view === 'mois' ? (
                  <MonthView data={data} anchor={anchor} onPickDay={(d) => { setAnchor(d); setView('jour'); }} />
                ) : (
                  <YearView anchor={anchor} data={data} onPickMonth={(d) => { setAnchor(d); setView('mois'); }} />
                )}
              </div>
            )}
          </>
        ) : null}
      </div>

      {setup && data && profileId && (
        <Setup data={data} profileId={profileId} onClose={() => setSetup(false)} onSaved={setData} />
      )}
      {popup && <EventPopup popup={popup} onClose={() => setPopup(null)} />}
    </div>
    </OpenBlockCtx.Provider>
    </HourPxCtx.Provider>
  );
}

function isVacation(data: ScheduleView, d: Date): boolean {
  const s = ymd(d);
  return data.vacations.some((v) => v.startDate <= s && s <= v.endDate);
}

/** La ligne rouge « maintenant », traversant TOUTE la largeur de la grille (tous les jours). */
function NowLine() {
  const hourPx = useHourPx();
  const now = new Date();
  const top = ((now.getHours() * 60 + now.getMinutes()) / 60) * hourPx;
  return (
    <div className="pointer-events-none absolute left-14 right-0 z-20" style={{ top }}>
      <span className="absolute -left-1 -top-[3px] h-[7px] w-[7px] rounded-full bg-red-500" />
      <div className="h-[1.5px] bg-red-500" />
    </div>
  );
}

/** Auto-défilement pour amener le matin (le 1er bloc) près du haut au chargement — jour complet 0-24h. */
function useAutoScroll(data: ScheduleView) {
  const hourPx = useHourPx();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const earliest = data.blocks.length ? Math.min(...data.blocks.map((b) => b.startMin)) : 8 * 60;
    ref.current?.scrollTo({ top: Math.max(0, (earliest / 60) * hourPx - 40) });
  }, [data, hourPx]);
  return ref;
}

function DayHeaderCell({ d, onClick }: { d: Date; onClick?: () => void }) {
  const isToday = sameDay(d, new Date());
  return (
    <button onClick={onClick} className="flex-1 border-l border-slate-100 py-2 text-center hover:bg-muted/40">
      <div className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{DAY_SHORT[d.getDay()]}</div>
      <div className={cn('mx-auto mt-1 flex h-8 w-8 items-center justify-center rounded-full text-[15px]', isToday ? 'bg-blue-500 font-semibold text-white' : 'text-slate-700')}>{d.getDate()}</div>
    </button>
  );
}

function Block({ b, date, startHour }: { b: ScheduleBlock; date: Date; startHour: number }) {
  const open = useContext(OpenBlockCtx);
  const hourPx = useHourPx();
  const st = blockStyle(b);
  const top = ((b.startMin - startHour * 60) / 60) * hourPx;
  const height = (b.durationMin / 60) * hourPx;
  const tall = height >= 46;
  return (
    <button
      onClick={(e) => open(b, date, e)}
      className={cn('absolute left-0.5 right-0.5 flex overflow-hidden rounded-[5px] text-left transition hover:brightness-95', st.fill)}
      style={{ top: top + 1, height: Math.max(height - 2, 22) }}
    >
      <span className={cn('w-[3px] shrink-0', st.bar)} />
      <span className="flex min-w-0 flex-col justify-start px-1.5 py-1 leading-tight">
        <span className={cn('text-[13px] font-semibold', st.text, tall ? 'line-clamp-2' : 'truncate')}>{b.label}</span>
        {tall && <span className={cn('pt-0.5 text-[11px]', st.sub)}>{fmtHour(b.startMin)}</span>}
      </span>
    </button>
  );
}

function DayColumn({ data, date, startHour, endHour }: { data: ScheduleView; date: Date; startHour: number; endHour: number }) {
  const hourPx = useHourPx();
  const dow = date.getDay();
  const rest = !data.config.activeDays.includes(dow);
  const vac = isVacation(data, date);
  const blocks = vac || rest ? [] : data.blocks.filter((b) => b.dayOfWeek === dow);
  const isToday = sameDay(date, new Date());
  return (
    <div
      className={cn('relative flex-1 border-l border-slate-100', isToday && 'bg-blue-50/30', (vac || rest) && 'bg-slate-50/50')}
      style={{ height: (endHour - startHour) * hourPx }}
    >
      {Array.from({ length: endHour - startHour }).map((_, i) => (
        <div key={i} className="border-t border-slate-100" style={{ height: hourPx }}>
          <div className="border-t border-slate-100/50" style={{ height: hourPx / 2 }} />
        </div>
      ))}
      {vac ? (
        <div className="absolute inset-x-0 top-3 text-center text-[11px] font-medium text-slate-400">Vacances</div>
      ) : rest ? (
        <div className="absolute inset-x-0 top-3 text-center text-[11px] font-medium text-slate-300">Repos</div>
      ) : (
        blocks.map((b, i) => <Block key={i} b={b} date={date} startHour={startHour} />)
      )}
    </div>
  );
}

function HourGutter({ startHour, endHour }: { startHour: number; endHour: number }) {
  const hourPx = useHourPx();
  return (
    <div className="w-14 shrink-0 select-none" style={{ height: (endHour - startHour) * hourPx }}>
      {Array.from({ length: endHour - startHour }).map((_, i) => (
        <div key={i} className="relative" style={{ height: hourPx }}>
          {i > 0 && (
            <span className="absolute -top-2 right-2 text-[11px] tabular-nums text-slate-400">
              {String(startHour + i).padStart(2, '0')}:00
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

const DAY_START = 0;
const DAY_END = 24; // journée complète scrollable, façon Google/Apple

function WeekView({ data, anchor, onPickDay }: { data: ScheduleView; anchor: Date; onPickDay: (d: Date) => void }) {
  const weekStart = startOfWeek(anchor);
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const scrollRef = useAutoScroll(data);
  const hasToday = days.some((d) => sameDay(d, new Date()));
  return (
    <div className="flex h-full min-w-[760px] flex-col">
      <div className="flex shrink-0 border-b border-slate-100 bg-surface">
        <div className="w-14 shrink-0" />
        {days.map((d, i) => (
          <DayHeaderCell key={i} d={d} onClick={() => onPickDay(d)} />
        ))}
      </div>
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
        <div className="relative flex">
          <HourGutter startHour={DAY_START} endHour={DAY_END} />
          {days.map((d, i) => (
            <DayColumn key={i} data={data} date={d} startHour={DAY_START} endHour={DAY_END} />
          ))}
          {hasToday && <NowLine />}
        </div>
      </div>
    </div>
  );
}

function DayView({ data, anchor }: { data: ScheduleView; anchor: Date }) {
  const scrollRef = useAutoScroll(data);
  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 border-b border-slate-100 bg-surface">
        <div className="w-14 shrink-0" />
        <DayHeaderCell d={anchor} />
      </div>
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
        <div className="relative flex">
          <HourGutter startHour={DAY_START} endHour={DAY_END} />
          <DayColumn data={data} date={anchor} startHour={DAY_START} endHour={DAY_END} />
          {sameDay(anchor, new Date()) && <NowLine />}
        </div>
      </div>
    </div>
  );
}

function MonthView({ data, anchor, onPickDay }: { data: ScheduleView; anchor: Date; onPickDay: (d: Date) => void }) {
  const cells = monthGrid(anchor);
  const today = new Date();
  return (
    <div className="p-3">
      <div className="grid grid-cols-7">
        {['lun', 'mar', 'mer', 'jeu', 'ven', 'sam', 'dim'].map((d) => (
          <div key={d} className="pb-2 text-center text-[11px] font-medium uppercase tracking-wide text-slate-400">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 overflow-hidden rounded-lg border-l border-t border-slate-100">
        {cells.map((d, i) => {
          const other = d.getMonth() !== anchor.getMonth();
          const dow = d.getDay();
          const vac = isVacation(data, d);
          const rest = !data.config.activeDays.includes(dow);
          const dayDots =
            vac || rest
              ? []
              : [...new Map(data.blocks.filter((b) => b.dayOfWeek === dow).map((b) => [blockStyle(b).dot, b])).values()];
          const isToday = sameDay(d, today);
          return (
            <button key={i} onClick={() => onPickDay(d)} className={cn('h-24 border-b border-r border-slate-100 p-1.5 text-left hover:bg-slate-50', other && 'bg-slate-50/50')}>
              <div className={cn('flex h-7 w-7 items-center justify-center rounded-full text-sm', isToday ? 'bg-blue-500 font-semibold text-white' : other ? 'text-slate-300' : 'text-slate-600')}>{d.getDate()}</div>
              {vac ? (
                <div className="mt-1 text-[10px] text-slate-400">Vacances</div>
              ) : (
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {dayDots.map((b, di) => (
                    <span key={di} className={cn('h-1.5 w-1.5 rounded-full', blockStyle(b).dot)} />
                  ))}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function YearView({ anchor, data, onPickMonth }: { anchor: Date; data: ScheduleView; onPickMonth: (d: Date) => void }) {
  const today = new Date();
  const year = anchor.getFullYear();
  return (
    <div className="grid grid-cols-2 gap-4 p-4 sm:grid-cols-3 md:grid-cols-4">
      {Array.from({ length: 12 }, (_, m) => {
        const first = new Date(year, m, 1);
        const cells = monthGrid(first);
        return (
          <button key={m} onClick={() => onPickMonth(first)} className="rounded-lg border border-border p-2 text-left hover:bg-muted/40">
            <div className="mb-1 text-sm font-medium capitalize">{MONTH_FULL[m]}</div>
            <div className="grid grid-cols-7 gap-0.5">
              {cells.map((d, i) => {
                const inMonth = d.getMonth() === m;
                const active = inMonth && data.config.activeDays.includes(d.getDay()) && !isVacation(data, d);
                return (
                  <div key={i} className={cn('flex h-4 items-center justify-center rounded-[3px] text-[9px]', !inMonth && 'text-transparent', active && 'bg-accent/15 text-accent', sameDay(d, today) && 'bg-accent text-accent-foreground')}>
                    {d.getDate()}
                  </div>
                );
              })}
            </div>
          </button>
        );
      })}
    </div>
  );
}

function Setup({ data, profileId, onClose, onSaved }: { data: ScheduleView; profileId: string; onClose: () => void; onSaved: (v: ScheduleView) => void }) {
  const [days, setDays] = useState<number[]>(data.config.activeDays);
  const [start, setStart] = useState(fmtHour(data.config.dayStartMin));
  const [end, setEnd] = useState(fmtHour(data.config.dayEndMin));
  const [intensity, setIntensity] = useState<Intensity>(data.config.intensity);
  const [vac, setVac] = useState({ startDate: '', endDate: '', label: '' });
  const [busy, setBusy] = useState('');

  async function pickPreset(key: string) {
    setBusy('preset');
    try {
      onSaved(await setSchedulePreset(profileId, key));
    } finally {
      setBusy('');
    }
  }
  async function applyConfig() {
    const toMin = (h: string) => { const [a, b] = h.split(':').map(Number); return (a ?? 0) * 60 + (b ?? 0); };
    setBusy('config');
    try {
      onSaved(await setScheduleConfig(profileId, { activeDays: days, dayStartMin: toMin(start), dayEndMin: toMin(end), intensity }));
    } finally {
      setBusy('');
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/20" onClick={onClose}>
      <div className="h-full w-full max-w-md overflow-y-auto bg-surface p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Mon rythme</h2>
          <button onClick={onClose} aria-label="Fermer" className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted"><IconX /></button>
        </div>

        <p className="mb-2 text-sm text-muted-foreground">Choisis un profil — Dowze construit ton emploi du temps.</p>
        <div className="grid grid-cols-1 gap-2">
          {data.presets.map((p) => (
            <button key={p.key} onClick={() => void pickPreset(p.key)} disabled={busy === 'preset'} className={cn('rounded-lg border p-3 text-left hover:bg-muted/50', data.config.preset === p.key ? 'border-accent bg-accent/10' : 'border-border')}>
              <div className="font-medium">{p.name}</div>
              <div className="text-sm text-muted-foreground">{p.description}</div>
            </button>
          ))}
        </div>

        <details className="mt-4 rounded-lg border border-border p-3">
          <summary className="cursor-pointer text-sm font-medium">Avancé — ajuster finement</summary>
          <div className="mt-3 space-y-3">
            <div>
              <p className="mb-1 text-xs text-muted-foreground">Jours actifs</p>
              <div className="flex flex-wrap gap-1">
                {[1, 2, 3, 4, 5, 6, 0].map((d) => (
                  <button key={d} onClick={() => setDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]))} className={cn('h-8 w-10 rounded-md text-xs', days.includes(d) ? 'bg-accent text-accent-foreground' : 'border border-border')}>{DAY_SHORT[d]}</button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">De</span>
              <input type="time" value={start} onChange={(e) => setStart(e.target.value)} className="rounded-md border border-border px-2 py-1" />
              <span className="text-muted-foreground">à</span>
              <input type="time" value={end} onChange={(e) => setEnd(e.target.value)} className="rounded-md border border-border px-2 py-1" />
            </div>
            <div>
              <p className="mb-1 text-xs text-muted-foreground">Intensité</p>
              <div className="flex gap-1">
                {(['leger', 'moyen', 'soutenu'] as Intensity[]).map((it) => (
                  <button key={it} onClick={() => setIntensity(it)} className={cn('flex-1 rounded-md px-2 py-1 text-sm capitalize', intensity === it ? 'bg-accent text-accent-foreground' : 'border border-border')}>{it}</button>
                ))}
              </div>
            </div>
            <Button onClick={() => void applyConfig()} disabled={busy === 'config'} className="w-full">Appliquer</Button>
          </div>
        </details>

        <div className="mt-4 rounded-lg border border-border p-3">
          <p className="mb-2 flex items-center gap-2 text-sm font-medium"><IconPalmtree width={16} height={16} /> Vacances & pauses</p>
          {data.vacations.length > 0 && (
            <ul className="mb-2 space-y-1">
              {data.vacations.map((v) => (
                <li key={v.id} className="flex items-center justify-between text-sm">
                  <span>{v.label} · {v.startDate} → {v.endDate}</span>
                  <button onClick={async () => onSaved(await removeVacation(profileId, v.id))} className="text-muted-foreground hover:text-red-600" aria-label="Retirer"><IconX width={16} height={16} /></button>
                </li>
              ))}
            </ul>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <input type="date" value={vac.startDate} onChange={(e) => setVac({ ...vac, startDate: e.target.value })} className="rounded-md border border-border px-2 py-1 text-sm" />
            <input type="date" value={vac.endDate} onChange={(e) => setVac({ ...vac, endDate: e.target.value })} className="rounded-md border border-border px-2 py-1 text-sm" />
            <Button variant="secondary" onClick={async () => { if (vac.startDate && vac.endDate) { onSaved(await addVacation(profileId, vac.startDate, vac.endDate, vac.label || 'Vacances')); setVac({ startDate: '', endDate: '', label: '' }); } }}>Ajouter</Button>
          </div>
        </div>

        <div className="mt-4 flex justify-end">
          <Button onClick={onClose} className="gap-1">Terminé <IconArrowRight /></Button>
        </div>
      </div>
    </div>
  );
}
