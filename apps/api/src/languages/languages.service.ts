import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { and, desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import type {
  CourseSheet,
  LanguageClass,
  LanguageCompose,
  LanguageIngestResult,
  LanguagesView,
  LearnerLanguage,
} from '@dowze/schemas';
import { cefrOf, courseSheetGenSchema, courseSheetSchema } from '@dowze/schemas';
import { DB, type Database } from '../db/drizzle.module';
import {
  chatMessages,
  classes,
  conversationParticipants,
  conversations,
  languageActivity,
  learnerDossiers,
  learnerLanguages,
  memberships,
  profiles,
} from '../db/schema';
import { CopiloteService } from '../copilote/copilote.service';
import { RealtimeService } from '../realtime/realtime.service';
import { DOWZE_BOT_PROFILE_ID } from '../common/bot';
import { MAX_SIZE } from '../classes/assign';
import { CATALOGUE, LANG_NAMES, countryFromLocale, proposeLanguages } from './geo';
import {
  CHATBOT_SYSTEM,
  LANGUAGE_COURSE_SYSTEM,
  LANGUAGE_INGEST_SYSTEM,
  buildLanguageClosingPrompt,
  buildLanguagePrompt,
} from './language-prompts';
import { COURSE_SHEET_SYSTEM } from '../copilote/prompts';
import { localDateStr } from '../common/local-date';

/** SkillId sentinelle pour les cours de LANGUE (les langues n'ont pas de compétence uuid du graphe). */
const LANGUAGE_COURSE_SKILL_ID = '00000000-0000-4000-8000-0000000000aa';

/** Ce que l'IA extrait du bilan (Dowze recalcule ensuite le niveau — jamais l'IA). */
const ingestGenSchema = z.object({
  outcome: z.enum(['progres', 'solide', 'bloque']),
  canDoNote: z.string(),
  newWords: z.array(z.object({ word: z.string(), meaning: z.string() })).max(8),
  errors: z.array(z.string()).max(6),
  summaryLine: z.string(),
});

const CURRENT_SCHOOL_YEAR = 2026;
/** Niveau (0→5) requis pour débloquer une NOUVELLE langue (≈ A2 solide / entrée B1). B2 idéal (recherche). */
const UNLOCK_LEVEL = 2.5;
/** Surcoût si la nouvelle langue est PROCHE d'une déjà apprise (anti-mélange, recherche). */
const CLOSE_UNLOCK_BONUS = 0.7;
/** Niveau requis pour parler dans une classe de langue (A2 solide, cf. seuil de participation). */
const PARTICIPATE_LEVEL = 2.0;

/** Familles de langues proches (interférence à court terme si apprises trop rapprochées). */
const CLOSE_FAMILIES: string[][] = [
  ['es', 'it', 'pt', 'fr', 'ro'], // romanes
  ['de', 'nl'], // germaniques continentales
  ['ja', 'ko'],
];
function areClose(a: string, b: string): boolean {
  return CLOSE_FAMILIES.some((fam) => fam.includes(a) && fam.includes(b));
}

/** Jour LOCAL de l'élève (fuseau suisse) — l'ISO-UTC faussait streak/maintenance autour de minuit (audit 08-2026). */
function todayStr(): string {
  return localDateStr();
}

/** Palier de progression du niveau selon l'issue de la séance. */
function levelStep(outcome: 'solide' | 'progres' | string): number {
  return outcome === 'solide' ? 0.08 : outcome === 'progres' ? 0.05 : 0.02;
}
function daysBetween(a: string, b: string): number {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86_400_000);
}
function ageFromBirth(birth: string | null): number | null {
  if (!birth) return null;
  const b = new Date(birth);
  const now = new Date();
  let age = now.getFullYear() - b.getFullYear();
  const m = now.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) age--;
  return age;
}
function dailyMinutesFor(age: number | null): number {
  const a = age ?? 13;
  if (a <= 11) return 15;
  if (a <= 15) return 20;
  return 28;
}

@Injectable()
export class LanguagesService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly copilote: CopiloteService,
    private readonly realtime: RealtimeService,
  ) {}

  private async profile(profileId: string) {
    return (await this.db.select().from(profiles).where(eq(profiles.id, profileId)))[0] ?? null;
  }
  private async nameOf(profileId: string): Promise<string> {
    return (await this.profile(profileId))?.displayName ?? '';
  }
  private l1Of(locale: string | null | undefined): string {
    return (locale || 'fr').split('-')[0] ?? 'fr';
  }

  private async rows(profileId: string) {
    return this.db.select().from(learnerLanguages).where(eq(learnerLanguages.profileId, profileId));
  }

  private toLearnerLanguage(r: typeof learnerLanguages.$inferSelect): LearnerLanguage {
    const due =
      r.status === 'maintenance' &&
      (r.lastPracticeDate == null || daysBetween(r.lastPracticeDate, todayStr()) >= 2);
    return {
      lang: r.lang,
      name: LANG_NAMES[r.lang] ?? r.lang,
      status: r.status as 'active' | 'maintenance',
      level: Math.round(r.level * 100) / 100,
      cefr: cefrOf(r.level),
      streak: r.streak,
      reasonPitch: r.reasonPitch,
      maintenanceDue: due,
    };
  }

  private projection(level: number, dailyMin: number): string {
    if (level >= 3)
      return 'Tu as atteint le niveau B1 — vise maintenant B2, et garde cette langue vivante.';
    const B1_HOURS = 375;
    const doneHours = (level / 3) * B1_HOURS;
    const remaining = Math.max(0, B1_HOURS - doneHours);
    const hoursPerYear = (dailyMin * 365) / 60;
    const months = Math.max(1, Math.round((remaining / hoursPerYear) * 12));
    return `À ton rythme (~${dailyMin} min/jour, tous les jours), tu peux viser B1 dans ~${months} mois. La régularité compte plus que l'intensité.`;
  }

  async view(profileId: string): Promise<LanguagesView> {
    const p = await this.profile(profileId);
    const l1 = this.l1Of(p?.locale);
    const age = ageFromBirth(p?.birthDate ?? null);
    const dailyMin = dailyMinutesFor(age);

    const all = await this.rows(profileId);
    const activeRow = all.find((r) => r.status === 'active') ?? null;
    const active = activeRow ? this.toLearnerLanguage(activeRow) : null;
    const maintenance = all
      .filter((r) => r.status === 'maintenance')
      .map((r) => this.toLearnerLanguage(r));

    const already = all.map((r) => r.lang);
    const proposals = proposeLanguages(countryFromLocale(p?.locale), l1, already);
    const catalogue = CATALOGUE.filter((c) => c !== l1 && !already.includes(c)).map((c) => ({
      lang: c,
      name: LANG_NAMES[c] ?? c,
    }));

    const canChooseNew = activeRow == null || activeRow.level >= UNLOCK_LEVEL;

    return {
      active,
      maintenance,
      proposals,
      catalogue,
      canChooseNew,
      unlockCefr: 'B1',
      dailyMinutes: dailyMin,
      projection: active ? this.projection(activeRow!.level, dailyMin) : '',
    };
  }

  /** Choisit une langue (100 % libre). Une seule active à la fois ; l'ancienne active passe en maintenance. */
  async choose(profileId: string, lang: string): Promise<LanguagesView> {
    const p = await this.profile(profileId);
    const l1 = this.l1Of(p?.locale);
    if (lang === l1)
      throw new BadRequestException("C'est ta langue maternelle — choisis une langue étrangère.");
    if (!CATALOGUE.includes(lang)) throw new BadRequestException('Langue non disponible.');

    const all = await this.rows(profileId);
    if (all.some((r) => r.lang === lang))
      throw new BadRequestException('Tu apprends déjà cette langue.');

    const activeRow = all.find((r) => r.status === 'active') ?? null;
    if (activeRow) {
      // Seuil de déblocage, durci si la nouvelle langue est PROCHE d'une déjà apprise (anti-mélange).
      const close = all.some((r) => areClose(r.lang, lang));
      const need = UNLOCK_LEVEL + (close ? CLOSE_UNLOCK_BONUS : 0);
      if (activeRow.level < need) {
        const why = close
          ? `Cette langue ressemble à une que tu apprends déjà : consolide d'abord ${LANG_NAMES[activeRow.lang] ?? activeRow.lang} pour ne pas les mélanger.`
          : `Avance encore un peu ${LANG_NAMES[activeRow.lang] ?? activeRow.lang} avant d'en commencer une nouvelle — une langue à la fois.`;
        throw new BadRequestException(why);
      }
      // L'ancienne active passe en maintenance (on continue de la pratiquer pour ne pas l'oublier).
      await this.db
        .update(learnerLanguages)
        .set({ status: 'maintenance' })
        .where(
          and(eq(learnerLanguages.profileId, profileId), eq(learnerLanguages.lang, activeRow.lang)),
        );
    }

    const proposals = proposeLanguages(
      countryFromLocale(p?.locale),
      l1,
      all.map((r) => r.lang),
    );
    const pitch = proposals.find((x) => x.lang === lang)?.pitch ?? '';
    await this.db
      .insert(learnerLanguages)
      .values({ profileId, lang, status: 'active', reasonPitch: pitch })
      .onConflictDoNothing();

    // Attribue une classe de langue (canal « langue cible only »).
    await this.assignLanguageClass(profileId, lang);
    return this.view(profileId);
  }

  // ---------------- Séance quotidienne (compose → SON IA → ingest), modèle « Ma séance » ----------------

  private async assertLearnerLang(profileId: string, lang: string) {
    const r = (
      await this.db
        .select()
        .from(learnerLanguages)
        .where(and(eq(learnerLanguages.profileId, profileId), eq(learnerLanguages.lang, lang)))
    )[0];
    if (!r) throw new BadRequestException("Tu n'apprends pas cette langue.");
    return r;
  }

  /** Centres d'intérêt de l'élève (dossier), en une courte ligne — pour ancrer les exemples du prof. */
  private async interestsLine(profileId: string): Promise<string | null> {
    const d = (
      await this.db.select().from(learnerDossiers).where(eq(learnerDossiers.profileId, profileId))
    )[0];
    const structured = d?.structured as { interets?: Array<{ theme?: string }> } | undefined;
    const themes = (structured?.interets ?? [])
      .map((i) => i.theme)
      .filter((t): t is string => Boolean(t));
    return themes.length > 0 ? themes.slice(0, 5).join(', ') : null;
  }

  /** Dernier bilan de séance pour cette langue (mémoire de la reprise). */
  private async lastSummary(profileId: string, lang: string): Promise<string | null> {
    const rows = await this.db
      .select()
      .from(languageActivity)
      .where(and(eq(languageActivity.profileId, profileId), eq(languageActivity.lang, lang)))
      .orderBy(desc(languageActivity.createdAt))
      .limit(5);
    return rows.find((r) => r.summary && r.summary.trim().length > 0)?.summary ?? null;
  }

  /**
   * COMPOSE le prompt lisible du jour (déterministe, GRATUIT — aucun appel LLM). L'élève le colle dans
   * SON IA (ChatGPT/Claude), qui joue le prof (mode vocal possible). Puis il recolle le bilan → ingest.
   */
  async compose(profileId: string, lang: string): Promise<LanguageCompose> {
    const r = await this.assertLearnerLang(profileId, lang);
    const p = await this.profile(profileId);
    const l1 = this.l1Of(p?.locale);
    const name = LANG_NAMES[lang] ?? lang;
    const mode = r.status === 'maintenance' ? 'maintenance' : 'active';
    const prompt = buildLanguagePrompt({
      langName: name,
      l1Name: LANG_NAMES[l1] ?? l1,
      cefr: cefrOf(r.level),
      mode,
      lastSummary: await this.lastSummary(profileId, lang),
      interests: await this.interestsLine(profileId),
    });
    return {
      lang,
      name,
      cefr: cefrOf(r.level),
      mode,
      prompt,
      closingPrompt: buildLanguageClosingPrompt(name),
    };
  }

  /**
   * INGÈRE le résumé texte (écrit par l'IA de l'élève) : l'IA de Dowze le STRUCTURE, puis Dowze
   * RECALCULE le niveau (jamais l'IA), met à jour streak + mémoire. Modèle « Ma séance ».
   */
  async ingest(profileId: string, lang: string, summary: string): Promise<LanguageIngestResult> {
    const r = await this.assertLearnerLang(profileId, lang);
    const { object } = await this.copilote.generateStructured<z.infer<typeof ingestGenSchema>>(
      profileId,
      {
        schema: ingestGenSchema,
        schemaName: 'LanguageSnapshot',
        system: LANGUAGE_INGEST_SYSTEM,
        prompt: `Bilan de séance de ${LANG_NAMES[lang] ?? lang} à analyser :\n\n${summary}`,
        temperature: 0.2,
        ref: `lang-ingest:${lang}`,
      },
    );

    const today = todayStr();
    // Avancement : seulement pour la langue ACTIVE (la maintenance TIENT, elle ne progresse pas),
    // et UNE seule progression par jour (double bilan/retry = pas de double `level += step`, audit 08-2026).
    const alreadyToday = await this.alreadyPracticedToday(profileId, lang, today);
    const levelBefore = r.level;
    let levelAfter = levelBefore;
    if (r.status === 'active' && !alreadyToday) {
      levelAfter = Math.min(5, levelBefore + levelStep(object.outcome));
    }

    // Streak : +1 si dernière pratique = hier, conservé si aujourd'hui, sinon repart à 1.
    let streak = r.streak;
    if (r.lastPracticeDate == null) streak = 1;
    else {
      const d = daysBetween(r.lastPracticeDate, today);
      streak = d === 0 ? Math.max(1, r.streak) : d === 1 ? r.streak + 1 : 1;
    }

    await this.db.insert(languageActivity).values({
      profileId,
      lang,
      activityDate: today,
      kind: r.status === 'maintenance' ? 'maintenance' : 'session',
      minutes: 0,
      score: object.outcome === 'solide' ? 1 : object.outcome === 'progres' ? 0.6 : 0.3,
      summary: object.summaryLine || summary.slice(0, 400),
    });
    await this.db
      .update(learnerLanguages)
      .set({ level: levelAfter, streak, lastPracticeDate: today })
      .where(and(eq(learnerLanguages.profileId, profileId), eq(learnerLanguages.lang, lang)));

    return {
      levelBefore: Math.round(levelBefore * 100) / 100,
      levelAfter: Math.round(levelAfter * 100) / 100,
      cefr: cefrOf(levelAfter),
      streak,
      outcome: object.outcome,
      canDoNote: object.canDoNote,
      newWords: object.newWords,
    };
  }

  // --- Cours de langue NATIF (mode AUTO) : l'IA de Dowze donne le cours en app (feuille A4), approche TBLT. ---

  /** Génère une feuille de cours de LANGUE pour la langue active (réutilise le contexte de `compose`). */
  async runLanguageCourse(
    profileId: string,
    lang: string,
  ): Promise<{ sheet: CourseSheet; name: string; cefr: string; creditsSpent: number }> {
    const r = await this.assertLearnerLang(profileId, lang);
    const name = LANG_NAMES[lang] ?? lang;
    const cefr = cefrOf(r.level);
    // BRIEF concis (PAS le prompt de conversation du tuteur, qui parasiterait la génération JSON structurée).
    const interests = await this.interestsLine(profileId);
    const last = await this.lastSummary(profileId, lang);
    const brief = [
      `Langue cible : ${name}. Niveau CECRL : ${cefr}.`,
      interests ? `Centres d'intérêt de l'élève (ancre les exemples) : ${interests}` : '',
      last ? `Où on en était la dernière fois : ${last}` : '',
    ]
      .filter(Boolean)
      .join('\n');
    const { object, creditsSpent } = await this.copilote.generateStructuredRetry(profileId, {
      schema: courseSheetGenSchema,
      schemaName: 'CourseSheet',
      // Base = le prompt de cours qui MARCHE (structure précise des modules) + surcouche « langue ».
      system: `${COURSE_SHEET_SYSTEM}\n\n${LANGUAGE_COURSE_SYSTEM}`,
      prompt: `${brief}\n\n---\nCompose la FEUILLE DE COURS DE LANGUE JSON pour ${name} (niveau ${cefr}).`,
      temperature: 0.4,
      ref: `lang-cours:${lang}`,
    });
    const sheet: CourseSheet = courseSheetSchema.parse({
      ...object,
      skillId: LANGUAGE_COURSE_SKILL_ID,
    });
    return { sheet, name, cefr, creditsSpent };
  }

  /**
   * Clôture du cours natif de langue : l'app a dérivé l'outcome des réponses → Dowze RECALCULE le niveau
   * (jamais l'IA) + streak + journal. Déterministe, sans LLM. Miroir de la fin de `ingest`.
   */
  async applyLanguageProgress(
    profileId: string,
    lang: string,
    outcome: 'solide' | 'progres' | 'faible',
  ): Promise<{ levelBefore: number; levelAfter: number; cefr: string; streak: number }> {
    const r = await this.assertLearnerLang(profileId, lang);
    const today = todayStr();
    // Idempotence : une seule progression + une seule ligne d'activité par jour (double-clic/retry absorbés).
    const alreadyToday = await this.alreadyPracticedToday(profileId, lang, today);
    const levelBefore = r.level;
    let levelAfter = levelBefore;
    if (r.status === 'active' && !alreadyToday) {
      levelAfter = Math.min(5, levelBefore + levelStep(outcome));
    }
    let streak = r.streak;
    if (r.lastPracticeDate == null) streak = 1;
    else {
      const d = daysBetween(r.lastPracticeDate, today);
      streak = d === 0 ? Math.max(1, r.streak) : d === 1 ? r.streak + 1 : 1;
    }
    if (!alreadyToday) {
      await this.db.insert(languageActivity).values({
        profileId,
        lang,
        activityDate: today,
        kind: r.status === 'maintenance' ? 'maintenance' : 'session',
        minutes: 0,
        score: outcome === 'solide' ? 1 : outcome === 'progres' ? 0.6 : 0.3,
        summary: 'Cours natif Dowze',
      });
    }
    await this.db
      .update(learnerLanguages)
      .set({ level: levelAfter, streak, lastPracticeDate: today })
      .where(and(eq(learnerLanguages.profileId, profileId), eq(learnerLanguages.lang, lang)));
    return {
      levelBefore: Math.round(levelBefore * 100) / 100,
      levelAfter: Math.round(levelAfter * 100) / 100,
      cefr: cefrOf(levelAfter),
      streak,
    };
  }

  /** Y a-t-il déjà une activité (session/maintenance) enregistrée AUJOURD'HUI pour cette langue ? */
  private async alreadyPracticedToday(
    profileId: string,
    lang: string,
    today: string,
  ): Promise<boolean> {
    const row = (
      await this.db
        .select({ id: languageActivity.id })
        .from(languageActivity)
        .where(
          and(
            eq(languageActivity.profileId, profileId),
            eq(languageActivity.lang, lang),
            eq(languageActivity.activityDate, today),
          ),
        )
        .limit(1)
    )[0];
    return Boolean(row);
  }

  /**
   * Bot « Dowze » invoqué avec `/` dans le salon de classe de langue. Il POSTE sa réponse DANS LE CANAL
   * PARTAGÉ (visible par tous les membres), comme un bot Discord. ≠ le cours quotidien (compose/ingest).
   */
  async chatbot(
    profileId: string,
    conversationId: string,
    lang: string,
    userText: string,
  ): Promise<{ ok: true }> {
    const r = await this.assertLearnerLang(profileId, lang);
    // AUTORISATION (audit 08-2026) : l'appelant doit être PARTICIPANT de la conversation — sinon n'importe
    // quel élève pouvait faire poster le bot (piloté par son texte) dans n'importe quel salon.
    const member = (
      await this.db
        .select({ profileId: conversationParticipants.profileId })
        .from(conversationParticipants)
        .where(
          and(
            eq(conversationParticipants.conversationId, conversationId),
            eq(conversationParticipants.profileId, profileId),
          ),
        )
        .limit(1)
    )[0];
    if (!member) throw new BadRequestException('Tu ne fais pas partie de cette conversation.');
    const p = await this.profile(profileId);
    const l1 = this.l1Of(p?.locale);

    // Contexte : les derniers messages du salon (pour une réponse cohérente à la conversation du groupe).
    const recent = await this.db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.conversationId, conversationId))
      .orderBy(desc(chatMessages.createdAt))
      .limit(12);
    const transcript = (
      await Promise.all(
        recent
          .reverse()
          .map(
            async (m) =>
              `${m.senderId === DOWZE_BOT_PROFILE_ID ? 'DOWZE' : (await this.nameOf(m.senderId)) || 'ÉLÈVE'} : ${m.body}`,
          ),
      )
    ).join('\n');

    const { object } = await this.copilote.generateStructured<{ reply: string }>(profileId, {
      schema: z.object({ reply: z.string().min(1) }),
      schemaName: 'DowzeReply',
      system: CHATBOT_SYSTEM,
      prompt:
        `Langue cible : ${LANG_NAMES[lang] ?? lang}. Langue maternelle de l'apprenant : ${LANG_NAMES[l1] ?? l1}. ` +
        `Niveau CECRL : ${cefrOf(r.level)}.\n` +
        (transcript ? `Conversation du salon :\n${transcript}\n` : '') +
        `\nDernier message de l'apprenant : « ${userText} »\nRéponds (langue cible, bref, relance par une question).`,
      temperature: 0.6,
      ref: `lang-bot:${lang}`,
    });

    // Poste la réponse dans le canal, en tant que « Dowze », visible par tout le groupe.
    const inserted = (
      await this.db
        .insert(chatMessages)
        .values({
          conversationId,
          senderId: DOWZE_BOT_PROFILE_ID,
          body: object.reply,
          kind: 'text',
          holdState: 'clear',
        })
        .returning()
    )[0];
    await this.db
      .update(conversations)
      .set({ lastMessageAt: inserted?.createdAt ?? new Date() })
      .where(eq(conversations.id, conversationId));

    // Temps réel : notifier tous les participants du salon.
    const parts = await this.db
      .select()
      .from(conversationParticipants)
      .where(eq(conversationParticipants.conversationId, conversationId));
    for (const pp of parts)
      void this.realtime.publishToUser(pp.profileId, { type: 'message', conversationId });

    return { ok: true as const };
  }

  // ---------------- Classes de langue (canal « langue cible only ») ----------------

  private levelBand(level: number): number {
    return Math.max(1, Math.min(5, Math.floor(level) + 1));
  }

  private charterFor(langName: string): string {
    return (
      `Ici, on parle UNIQUEMENT en ${langName}. L'erreur, c'est le mécanisme pour apprendre : personne ne se ` +
      `moque, on se corrige gentiment. La langue maternelle sert seulement de dépannage (un mot qui bloque). ` +
      `On valorise l'effort, pas la perfection.`
    );
  }

  /** Place l'apprenant dans une classe de sa (langue cible × bande de niveau) avec de la place, sinon en crée une. */
  async assignLanguageClass(profileId: string, lang: string): Promise<string | null> {
    const r = await this.assertLearnerLang(profileId, lang);
    const band = this.levelBand(r.level);
    const langName = LANG_NAMES[lang] ?? lang;

    const existing = await this.db
      .select()
      .from(classes)
      .where(
        and(
          eq(classes.schoolYear, CURRENT_SCHOOL_YEAR),
          eq(classes.type, 'language'),
          eq(classes.targetLang, lang),
          eq(classes.level, band),
        ),
      );
    for (const c of existing) {
      const count = (await this.db.select().from(memberships).where(eq(memberships.classeId, c.id)))
        .length;
      if (count < MAX_SIZE) return this.joinLanguageClass(c.id, profileId);
    }

    const name = `${langName} · niveau ${band}`;
    const slug = `lang-${CURRENT_SCHOOL_YEAR}-${lang}-${band}-${existing.length}-${profileId.slice(0, 8)}`;
    const cls = (
      await this.db
        .insert(classes)
        .values({
          slug,
          name,
          locale: lang,
          timezone: 'Europe/Zurich',
          type: 'language',
          level: band,
          primaryLang: lang,
          isMultilingual: true, // par nature : des L1 différentes, réunies par la langue cible
          targetLang: lang,
          schoolYear: CURRENT_SCHOOL_YEAR,
        })
        .returning()
    )[0];
    if (!cls) return null;
    await this.db.insert(conversations).values({
      type: 'class_channel',
      classId: cls.id,
      name: `Classe ${name}`,
      createdBy: profileId,
    });
    return this.joinLanguageClass(cls.id, profileId);
  }

  private async joinLanguageClass(classId: string, profileId: string): Promise<string> {
    await this.db
      .insert(memberships)
      .values({
        classeId: classId,
        profileId,
        schoolYear: CURRENT_SCHOOL_YEAR,
        assignmentReason: 'language',
      })
      .onConflictDoNothing();
    const chan = (
      await this.db
        .select()
        .from(conversations)
        .where(and(eq(conversations.classId, classId), eq(conversations.type, 'class_channel')))
    )[0];
    if (chan)
      await this.db
        .insert(conversationParticipants)
        .values({ conversationId: chan.id, profileId })
        .onConflictDoNothing();
    return classId;
  }

  /** Les classes de langue de l'apprenant (une par langue apprise). Auto-attribution si manquante. */
  async myLanguageClasses(profileId: string): Promise<LanguageClass[]> {
    const langs = await this.rows(profileId);
    const out: LanguageClass[] = [];
    for (const lr of langs) {
      // Classe de langue courante de l'apprenant pour cette langue.
      const mineRows = await this.db
        .select()
        .from(memberships)
        .where(
          and(
            eq(memberships.profileId, profileId),
            eq(memberships.schoolYear, CURRENT_SCHOOL_YEAR),
          ),
        );
      let clsId: string | null = null;
      for (const m of mineRows) {
        const c = (await this.db.select().from(classes).where(eq(classes.id, m.classeId)))[0];
        if (c?.type === 'language' && c.targetLang === lr.lang) {
          clsId = c.id;
          break;
        }
      }
      if (!clsId) clsId = await this.assignLanguageClass(profileId, lr.lang);
      if (!clsId) continue;
      const cls = (await this.db.select().from(classes).where(eq(classes.id, clsId)))[0];
      if (!cls) continue;
      const chan = (
        await this.db
          .select()
          .from(conversations)
          .where(and(eq(conversations.classId, cls.id), eq(conversations.type, 'class_channel')))
      )[0];
      const memberRows = await this.db
        .select()
        .from(memberships)
        .where(eq(memberships.classeId, cls.id));
      const members = await Promise.all(
        memberRows.map(async (mr) => ({
          profileId: mr.profileId,
          name: await this.nameOf(mr.profileId),
          level: 0,
        })),
      );
      const langName = LANG_NAMES[lr.lang] ?? lr.lang;
      out.push({
        id: cls.id,
        name: cls.name,
        targetLang: lr.lang,
        targetLangName: langName,
        channelId: chan?.id ?? null,
        members,
        canParticipate: lr.level >= PARTICIPATE_LEVEL,
        charter: this.charterFor(langName),
      });
    }
    return out;
  }
}
