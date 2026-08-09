'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import type { CourseSheet, LanguageCompose, LanguageIngestResult, LanguagesView } from '@dowze/schemas';
import { useProfile } from '@/lib/use-profile';
import {
  chooseLanguage,
  composeLanguageSession,
  getLanguages,
  ingestLanguageSession,
  generateLanguageCourse,
  closeLanguageCourse,
} from '@/lib/api';
import { CourseSheetView } from '@/components/course/course-sheet';
import { IconLanguages, IconSparkles, IconX, IconZap } from '@/components/ui/icons';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardTitle, CardDescription } from '@/components/ui/card';
import { Note } from '@/components/ui/note';
import { EmptyState } from '@/components/ui/empty-state';
import { SkeletonCards } from '@/components/ui/skeleton';

/** Messages d'erreur SANS fuite technique : 402/503 différenciés, générique sinon (jamais le body brut). */
function cleanErr(e: unknown): string {
  const msg = e instanceof Error ? e.message : '';
  if (msg.includes('402')) {
    return 'Crédits insuffisants pour ton Copilote. Recharge ton solde ou passe en « ta propre clé » dans les réglages du Copilote.';
  }
  if (msg.includes('503')) {
    return "Le modèle choisi n'est pas disponible pour l'instant. Choisis-en un autre dans les réglages du Copilote.";
  }
  return 'Impossible pour le moment. Réessaie dans un instant.';
}

/** Élision : « Séance de anglais » → « Séance d'anglais ». */
function deLang(name: string): string {
  return /^[aeiouyàâäéèêëîïôöûüh]/i.test(name) ? `d'${name}` : `de ${name}`;
}

export default function LanguesPage() {
  const { profileId, signedIn } = useProfile();
  const [view, setView] = useState<LanguagesView | null>(null);
  const [charge, setCharge] = useState(false);
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');

  // Séance en cours (modèle « Ma séance » : compose → SON IA → coller le résumé → ingest)
  const [sessLang, setSessLang] = useState<string | null>(null);
  const [composed, setComposed] = useState<LanguageCompose | null>(null);
  const [summary, setSummary] = useState('');
  const [ingesting, setIngesting] = useState(false);
  const [result, setResult] = useState<LanguageIngestResult | null>(null);
  const [copied, setCopied] = useState('');
  // Mode AUTO (défaut) : l'IA de Dowze donne le cours de langue en app (feuille A4). MANUEL : copier-coller.
  const [mode, setMode] = useState<'auto' | 'manuel'>('auto');
  const [sheet, setSheet] = useState<CourseSheet | null>(null);
  const [sheetName, setSheetName] = useState('');
  const [clot, setClot] = useState(false);
  const [finiLang, setFiniLang] = useState<{ cefr: string; levelAfter: number } | null>(null);

  const charger = useCallback(async () => {
    if (!profileId) return;
    setCharge(true);
    try {
      setView(await getLanguages(profileId));
    } catch (e) {
      setErr(cleanErr(e)); // sans ça : rejet non géré + page blanche définitive
    } finally {
      setCharge(false);
    }
  }, [profileId]);

  useEffect(() => {
    if (signedIn) void charger();
  }, [signedIn, charger]);

  async function choisir(lang: string) {
    if (!profileId) return;
    setBusy(lang);
    setErr('');
    try {
      setView(await chooseLanguage(profileId, lang));
    } catch (e) {
      setErr(cleanErr(e));
    } finally {
      setBusy('');
    }
  }

  async function demarrer(lang: string) {
    if (!profileId) return;
    setBusy(lang);
    setErr('');
    setResult(null);
    setSummary('');
    setSheet(null);
    setFiniLang(null);
    try {
      if (mode === 'auto') {
        const res = await generateLanguageCourse(profileId, lang);
        setSessLang(lang);
        setSheet(res.sheet);
        setSheetName(res.name);
      } else {
        const c = await composeLanguageSession(profileId, lang);
        setSessLang(lang);
        setComposed(c);
      }
    } catch (e) {
      setErr(cleanErr(e));
    } finally {
      setBusy('');
    }
  }

  // Clôture du cours natif de langue : outcome des réponses → Dowze recalcule le niveau.
  async function terminerLangue(outcome: 'maitrise' | 'progres' | 'bloque', _note: string) {
    if (!profileId || !sessLang) return;
    setClot(true);
    try {
      const lo = outcome === 'maitrise' ? 'solide' : outcome === 'progres' ? 'progres' : 'faible';
      const r = await closeLanguageCourse(profileId, sessLang, lo);
      setFiniLang({ cefr: r.cefr, levelAfter: r.levelAfter });
      void charger();
    } catch (e) {
      setErr(cleanErr(e));
      throw e; // la feuille ne doit se verrouiller qu'après un enregistrement réussi
    } finally {
      setClot(false);
    }
  }

  async function copier(text: string, tag: string) {
    await navigator.clipboard.writeText(text);
    setCopied(tag);
    setTimeout(() => setCopied(''), 1500);
  }

  async function enregistrer() {
    if (!profileId || !sessLang || !summary.trim()) return;
    setIngesting(true);
    setErr('');
    try {
      const r = await ingestLanguageSession(profileId, sessLang, summary.trim());
      setResult(r);
      setSummary('');
      void charger();
    } catch (e) {
      setErr(cleanErr(e));
    } finally {
      setIngesting(false);
    }
  }

  function fermerSeance() {
    setSessLang(null);
    setComposed(null);
    setSummary('');
    setResult(null);
    setErr('');
  }

  // Non connecté : invite claire (avant : page blanche définitive).
  if (!signedIn) {
    return (
      <div className="mx-auto max-w-2xl p-6">
        <EmptyState
          icon={<IconLanguages />}
          title="Connecte-toi pour tes cours de langue"
          description="Une langue à la fois, un peu chaque matin."
          action={
            <Link href="/connexion">
              <Button>Se connecter</Button>
            </Link>
          }
        />
      </div>
    );
  }

  if (!charge && !view) {
    return (
      <div className="mx-auto max-w-2xl space-y-4 p-6">
        {err ? <Note tone="error">{err}</Note> : <SkeletonCards count={2} />}
      </div>
    );
  }

  // ---- Vue COURS NATIF (AUTO) : feuille A4 rendue en app ----
  if (sessLang && sheet) {
    return (
      <div className="mx-auto max-w-3xl space-y-5 p-6">
        <PageHeader
          title={`Cours ${deLang(sheetName)}`}
          action={
            <button
              onClick={() => {
                setSessLang(null);
                setSheet(null);
                setFiniLang(null);
              }}
              className="rounded-full border border-border px-3 py-1 text-xs font-semibold text-muted-foreground transition hover:bg-muted"
            >
              Fermer
            </button>
          }
        />
        <CourseSheetView sheet={sheet} onComplete={terminerLangue} busy={clot} />
        {finiLang && (
          <Note>
            <span className="font-medium">Séance enregistrée.</span> Niveau {finiLang.cefr} (
            {finiLang.levelAfter}).
          </Note>
        )}
        {err && <Note tone="error">{err}</Note>}
      </div>
    );
  }

  // ---- Vue SÉANCE MANUELLE (compose + coller le résumé) ----
  if (sessLang && composed) {
    return (
      <div className="mx-auto max-w-2xl space-y-5 p-6">
        <PageHeader
          title={`Séance ${deLang(composed.name)}`}
          subtitle={
            composed.mode === 'maintenance'
              ? 'Réactivation courte pour ne pas oublier cette langue.'
              : 'Ton prof, c’est ton IA (ChatGPT, Claude…). Dowze prépare ta séance et suit tes progrès.'
          }
          action={
            <Button variant="ghost" onClick={fermerSeance}>
              <IconX className="mr-1" /> Fermer
            </Button>
          }
        />

        <Card className="space-y-3">
          <CardTitle>1 · Copie ce prompt dans ton IA</CardTitle>
          <CardDescription>
            Colle-le dans ChatGPT, Claude… (active le mode vocal si tu peux) et parle avec ton prof en{' '}
            {composed.name}.
          </CardDescription>
          <div className="flex justify-end">
            <Button variant="utility" onClick={() => void copier(composed.prompt, 'prompt')}>
              {copied === 'prompt' ? 'Copié !' : 'Copier'}
            </Button>
          </div>
          <pre className="max-h-80 overflow-auto whitespace-pre-wrap rounded-md bg-muted p-4 text-sm">
            {composed.prompt}
          </pre>
        </Card>

        <Card className="space-y-3">
          <CardTitle>2 · Recolle ton résumé de séance</CardTitle>
          <CardDescription>
            En fin de séance, demande le bilan à ton IA avec le prompt ci-dessous, puis colle sa réponse
            ici. Dowze la lit et met à jour ton niveau.
          </CardDescription>
          <div className="space-y-2 rounded-md border border-border bg-muted/40 p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium">a) Demande le bilan à ton IA :</p>
              <Button variant="utility" onClick={() => void copier(composed.closingPrompt, 'closing')}>
                {copied === 'closing' ? 'Copié !' : 'Copier le prompt de bilan'}
              </Button>
            </div>
            <pre className="max-h-48 overflow-auto whitespace-pre-wrap rounded-md bg-surface p-3 text-sm">
              {composed.closingPrompt}
            </pre>
          </div>
          <textarea
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            rows={5}
            placeholder="b) Colle ici le résumé que ton IA t’a écrit…"
            className="w-full rounded-md border border-border bg-surface p-3 text-sm"
          />
          <Button onClick={() => void enregistrer()} disabled={!summary.trim() || ingesting}>
            {ingesting ? 'Dowze lit ton résumé…' : 'Enregistrer ma séance'}
          </Button>
          {result && (
            <Note>
              <span className="font-medium">
                {result.outcome === 'solide'
                  ? 'Beau travail — tâche bien maîtrisée !'
                  : result.outcome === 'progres'
                    ? 'Beau progrès, on continue.'
                    : 'On y retravaillera, c’est noté.'}
              </span>{' '}
              {result.canDoNote} Niveau : {result.cefr}.
              {result.newWords.length > 0 && (
                <> Mots retenus : {result.newWords.map((w) => w.word).join(', ')}.</>
              )}
            </Note>
          )}
          {err && <Note tone="error">{err}</Note>}
          <Link href="/copilote" className="text-xs text-muted-foreground underline">
            Choisir mon IA / mon solde
          </Link>
        </Card>
      </div>
    );
  }

  // ---- Vue PRINCIPALE ----
  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <PageHeader
        title="Cours de langue"
        subtitle="Apprendre à PARLER, une langue à la fois, un peu chaque matin."
        action={
          <button
            onClick={() => setMode((m) => (m === 'auto' ? 'manuel' : 'auto'))}
            className="rounded-full border border-border px-3 py-1 text-xs font-semibold text-muted-foreground transition hover:bg-muted"
          >
            {mode === 'auto' ? 'Mode manuel' : 'Cours Dowze'}
          </button>
        }
      />
      {/* Erreurs au niveau PAGE : visibles dans TOUS les cas (avant : cachées dans la section « choisir »). */}
      {err && <Note tone="error">{err}</Note>}
      {charge && <SkeletonCards count={2} />}

      {view && (
        <>
          {view.active ? (
            <Card>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle>
                    {view.active.name} · niveau {view.active.cefr}
                  </CardTitle>
                  {view.active.reasonPitch && (
                    <CardDescription>{view.active.reasonPitch}</CardDescription>
                  )}
                </div>
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-muted px-3 py-1 text-sm">
                  <IconZap /> {view.active.streak} j
                </span>
              </div>
              {view.projection && <p className="mt-3 text-sm text-muted-foreground">{view.projection}</p>}
              <div className="mt-4">
                <Button onClick={() => void demarrer(view.active!.lang)} disabled={busy === view.active.lang}>
                  <IconSparkles className="mr-1" /> Séance du jour (~{view.dailyMinutes} min)
                </Button>
              </div>
            </Card>
          ) : (
            <EmptyState
              icon={<IconLanguages />}
              title="Choisis ta première langue"
              description="Tu choisis à 100 %. Voici quelques idées adaptées à là où tu vis — mais le champ est libre."
            />
          )}

          {view.maintenance.length > 0 && (
            <section>
              <h2 className="mb-2 text-sm font-semibold text-muted-foreground">
                À entretenir (pour ne pas oublier)
              </h2>
              <div className="grid gap-2">
                {view.maintenance.map((m) => (
                  <Card key={m.lang} className="flex items-center justify-between p-4">
                    <div>
                      <span className="font-medium">{m.name}</span>{' '}
                      <span className="text-sm text-muted-foreground">· {m.cefr}</span>
                      {m.maintenanceDue && (
                        <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800">
                          à réactiver
                        </span>
                      )}
                    </div>
                    <Button variant="secondary" onClick={() => void demarrer(m.lang)} disabled={busy === m.lang}>
                      Réactiver
                    </Button>
                  </Card>
                ))}
              </div>
            </section>
          )}

          {(!view.active || view.canChooseNew) && (
            <section className="space-y-3">
              <h2 className="text-sm font-semibold text-muted-foreground">
                {view.active ? 'Ajouter une nouvelle langue' : 'Des idées pour toi'}
              </h2>
              {view.active && !view.canChooseNew && (
                <Note>
                  Consolide d'abord ta langue en cours (vise {view.unlockCefr}) avant d'en commencer une
                  nouvelle — une langue à la fois.
                </Note>
              )}
              <div className="grid gap-2">
                {view.proposals.map((p) => (
                  <Card key={p.lang} className="flex items-center justify-between gap-3 p-4">
                    <div>
                      <CardTitle className="text-base">{p.name}</CardTitle>
                      <CardDescription>{p.pitch}</CardDescription>
                    </div>
                    <Button variant="secondary" onClick={() => void choisir(p.lang)} disabled={busy === p.lang}>
                      Choisir
                    </Button>
                  </Card>
                ))}
              </div>
              {view.catalogue.length > 0 && (
                <details className="rounded-md border border-border bg-surface p-3">
                  <summary className="cursor-pointer text-sm font-medium">
                    Ou choisis librement une autre langue
                  </summary>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {view.catalogue.map((c) => (
                      <Button
                        key={c.lang}
                        variant="utility"
                        onClick={() => void choisir(c.lang)}
                        disabled={busy === c.lang}
                      >
                        {c.name}
                      </Button>
                    ))}
                  </div>
                </details>
              )}
            </section>
          )}

        </>
      )}
    </div>
  );
}
