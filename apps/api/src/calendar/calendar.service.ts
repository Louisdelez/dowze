import { BadRequestException, ConflictException, Inject, Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import type { RecurringInput } from '@dowze/core';
import type {
  CalendarEntry,
  CreateCalendarEntryBody,
  DeclareRecurringBody,
  PluginContributes,
} from '@dowze/schemas';
import { pluginContributesSchema } from '@dowze/schemas';
import { DB, type Database } from '../db/drizzle.module';
import {
  calendarEntries,
  pluginRegistry,
  recurringCommitments,
  userPluginActivation,
} from '../db/schema';
import { RealtimeService } from '../realtime/realtime.service';

type RecurringRow = typeof recurringCommitments.$inferSelect;

@Injectable()
export class CalendarService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly realtime: RealtimeService,
  ) {}

  // ─── Activités récurrentes (déclarées par les plugins) ───

  /** Déclare/actualise une activité récurrente. Invariants structurels ; le placement est orchestré à la vue. */
  async declareRecurring(body: DeclareRecurringBody): Promise<RecurringRow> {
    const cap = body.hardConstraints.weeklyCapMin;
    if (cap != null && body.durationMin > cap) {
      throw new BadRequestException('durationMin dépasse le cap hebdomadaire (weeklyCapMin).');
    }
    const [row] = await this.db
      .insert(recurringCommitments)
      .values({
        profileId: body.profileId,
        sourceApp: body.sourceApp,
        sourceRef: body.sourceRef,
        type: body.type,
        title: body.title,
        frequencyPerWeek: body.frequencyPerWeek,
        durationMin: body.durationMin,
        intensity: body.intensity,
        hardConstraints: body.hardConstraints,
        softPreferences: body.softPreferences,
        priority: body.priority,
        missPolicy: body.missPolicy,
        adherenceMetric: body.adherenceMetric,
      })
      .onConflictDoUpdate({
        target: [
          recurringCommitments.profileId,
          recurringCommitments.sourceApp,
          recurringCommitments.sourceRef,
        ],
        set: {
          type: body.type,
          title: body.title,
          frequencyPerWeek: body.frequencyPerWeek,
          durationMin: body.durationMin,
          intensity: body.intensity,
          hardConstraints: body.hardConstraints,
          softPreferences: body.softPreferences,
          priority: body.priority,
          missPolicy: body.missPolicy,
          updatedAt: new Date(),
        },
      })
      .returning();
    await this.realtime.publishToUser(body.profileId, {
      type: 'calendar.recurring.declared',
      sourceApp: body.sourceApp,
      sourceRef: body.sourceRef,
      entryType: body.type,
    });
    return row as RecurringRow;
  }

  async removeRecurring(
    profileId: string,
    sourceApp: string,
    sourceRef: string,
  ): Promise<{ removed: true }> {
    await this.db
      .delete(recurringCommitments)
      .where(
        and(
          eq(recurringCommitments.profileId, profileId),
          eq(recurringCommitments.sourceApp, sourceApp),
          eq(recurringCommitments.sourceRef, sourceRef),
        ),
      );
    await this.realtime.publishToUser(profileId, {
      type: 'calendar.recurring.removed',
      sourceApp,
      sourceRef,
    });
    return { removed: true };
  }

  async listRecurring(profileId: string): Promise<RecurringRow[]> {
    return this.db
      .select()
      .from(recurringCommitments)
      .where(eq(recurringCommitments.profileId, profileId));
  }

  /**
   * Projette les activités récurrentes ACTIVES d'un profil en entrées pour l'orchestrateur du planning.
   * Ne retient que les engagements dont le plugin est **activé** par l'utilisateur (révocable) — enrichis
   * de la couleur/icône (depuis `contributes`), du nom et du deep-link (sous-domaine).
   */
  async recurringInputsForProfile(profileId: string): Promise<RecurringInput[]> {
    const rows = await this.db
      .select({
        rc: recurringCommitments,
        name: pluginRegistry.name,
        subdomain: pluginRegistry.subdomain,
        contributes: pluginRegistry.contributes,
      })
      .from(recurringCommitments)
      .innerJoin(pluginRegistry, eq(pluginRegistry.slug, recurringCommitments.sourceApp))
      .innerJoin(
        userPluginActivation,
        and(
          eq(userPluginActivation.pluginId, pluginRegistry.id),
          eq(userPluginActivation.profileId, recurringCommitments.profileId),
        ),
      )
      .where(
        and(eq(recurringCommitments.profileId, profileId), eq(userPluginActivation.enabled, true)),
      );

    return rows.map(({ rc, name, subdomain, contributes }) => {
      const parsed = pluginContributesSchema.safeParse(contributes);
      const contrib: PluginContributes = parsed.success
        ? parsed.data
        : { calendarEntryTypes: [], navTiles: [] };
      const entryMeta = contrib.calendarEntryTypes.find((e) => e.type === rc.type);
      const soft = (rc.softPreferences ?? {}) as {
        preferredTime?: 'matin' | 'apres-midi' | 'soir';
        cognitiveBoostBeforeStudy?: boolean;
      };
      const hard = (rc.hardConstraints ?? {}) as {
        minRestDaysPerWeek?: number;
        weeklyCapMin?: number;
      };
      return {
        key: `${rc.sourceApp}:${rc.sourceRef}`,
        entryType: rc.type,
        label: rc.title,
        durationMin: rc.durationMin,
        frequencyPerWeek: rc.frequencyPerWeek,
        intensity: rc.intensity as RecurringInput['intensity'],
        preferredTime: soft.preferredTime,
        cognitiveBoostBeforeStudy: soft.cognitiveBoostBeforeStudy,
        minRestDaysPerWeek: hard.minRestDaysPerWeek,
        weeklyCapMin: hard.weeklyCapMin,
        sourceApp: rc.sourceApp,
        color: entryMeta?.color ?? 'emerald',
        icon: entryMeta?.icon ?? 'activity',
        appLabel: name,
        href: `https://${subdomain}`,
      };
    });
  }

  // ─── Entrées ponctuelles (matchs, événements) — projection stockée ───

  private toEntry(row: typeof calendarEntries.$inferSelect): CalendarEntry {
    return {
      id: row.id,
      profileId: row.profileId,
      sourceApp: row.sourceApp,
      sourceRef: row.sourceRef,
      entryType: row.entryType,
      title: row.title,
      start: row.startAt.toISOString(),
      durationMin: row.durationMin,
      scope: row.scope,
      status: row.status as CalendarEntry['status'],
    };
  }

  /** Crée une entrée ponctuelle après contrôle de conflit ; émet `calendar.entry.created`. */
  async createEntry(body: CreateCalendarEntryBody): Promise<CalendarEntry> {
    const start = new Date(body.start);
    const end = new Date(start.getTime() + body.durationMin * 60_000);

    // Invariant : pas de chevauchement avec une autre entrée active du profil.
    const existing = await this.db
      .select()
      .from(calendarEntries)
      .where(eq(calendarEntries.profileId, body.profileId));
    for (const e of existing) {
      if (e.status === 'cancelled') continue;
      const es = e.startAt.getTime();
      const ee = es + e.durationMin * 60_000;
      if (start.getTime() < ee && es < end.getTime()) {
        throw new ConflictException('conflit : une entrée existe déjà sur ce créneau');
      }
    }

    const [row] = await this.db
      .insert(calendarEntries)
      .values({
        profileId: body.profileId,
        sourceApp: body.sourceApp,
        sourceRef: body.sourceRef,
        entryType: body.entryType,
        title: body.title,
        startAt: start,
        durationMin: body.durationMin,
        status: body.status,
      })
      .onConflictDoUpdate({
        target: [calendarEntries.sourceApp, calendarEntries.sourceRef],
        set: {
          entryType: body.entryType,
          title: body.title,
          startAt: start,
          durationMin: body.durationMin,
          status: body.status,
          updatedAt: new Date(),
        },
      })
      .returning();

    const entry = this.toEntry(row as typeof calendarEntries.$inferSelect);
    await this.realtime.publishToUser(body.profileId, { type: 'calendar.entry.created', entry });
    return entry;
  }

  async removeEntry(profileId: string, id: string): Promise<{ removed: true }> {
    await this.db
      .delete(calendarEntries)
      .where(and(eq(calendarEntries.profileId, profileId), eq(calendarEntries.id, id)));
    return { removed: true };
  }

  async listEntries(profileId: string): Promise<CalendarEntry[]> {
    const rows = await this.db
      .select()
      .from(calendarEntries)
      .where(eq(calendarEntries.profileId, profileId));
    return rows.map((r) => this.toEntry(r)).sort((a, b) => a.start.localeCompare(b.start));
  }
}
