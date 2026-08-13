import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { SCHEDULE_PRESETS, weeklySchedule } from '@dowze/core';
import type {
  BlockType,
  ScheduleBlock,
  ScheduleConfig,
  ScheduleView,
  Vacation,
} from '@dowze/schemas';
import { DB, type Database } from '../db/drizzle.module';
import {
  electives,
  learnerLanguages,
  learnerSchedule,
  profiles,
  scheduleVacations,
} from '../db/schema';
import { ProgressionService } from '../progression/progression.service';
import { FsrsService } from '../fsrs/fsrs.service';
import { LANG_NAMES } from '../languages/geo';
import { CalendarService } from '../calendar/calendar.service';

/** Page vers laquelle mène chaque type de bloc d'étude (les blocs `plugin` portent leur propre deep-link). */
const BLOCK_HREF: Record<Exclude<BlockType, 'plugin'>, string> = {
  langue: '/langues',
  revision: '/tests',
  cours: '/seance',
  expedition: '/expeditions',
  passion: '/passion',
};

function ageFromBirth(birth: string | null): number | null {
  if (!birth) return null;
  const b = new Date(birth);
  const now = new Date();
  let age = now.getFullYear() - b.getFullYear();
  const m = now.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) age--;
  return age;
}
function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

@Injectable()
export class ScheduleService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly progression: ProgressionService,
    private readonly fsrs: FsrsService,
    private readonly calendar: CalendarService,
  ) {}

  /** Remplace les libellés génériques par le VRAI contenu (compétence à venir, langue active, révisions dues…). */
  private async enrich(profileId: string, blocks: ScheduleBlock[]): Promise<ScheduleBlock[]> {
    if (blocks.length === 0) return blocks;
    const now = new Date().toISOString();
    const [nextSkill, dueIds, langRows, electiveRows] = await Promise.all([
      this.progression.nextPrescribed(profileId).catch(() => null),
      this.fsrs.due(profileId, now).catch(() => [] as string[]),
      this.db
        .select()
        .from(learnerLanguages)
        .where(
          and(eq(learnerLanguages.profileId, profileId), eq(learnerLanguages.status, 'active')),
        ),
      this.db.select().from(electives).where(eq(electives.profileId, profileId)),
    ]);
    const langName = langRows[0] ? (LANG_NAMES[langRows[0].lang] ?? langRows[0].lang) : null;
    const dueCount = dueIds.length;
    const electiveLabel = electiveRows[0]?.label ?? null;

    return blocks.map((b) => {
      // Les blocs plugin portent déjà leur libellé, deep-link, couleur et icône — on les laisse intacts.
      if (b.type === 'plugin') return b;
      let label = b.label;
      if (b.type === 'langue') label = langName ?? 'Langue';
      else if (b.type === 'revision')
        label = dueCount > 0 ? `Révisions (${dueCount})` : 'Révisions';
      else if (b.type === 'cours') label = nextSkill?.title ?? 'Cours principaux';
      else if (b.type === 'passion') label = electiveLabel ?? 'Ma passion';
      return { ...b, label, href: BLOCK_HREF[b.type] };
    });
  }

  private async config(profileId: string): Promise<ScheduleConfig> {
    const row = (
      await this.db.select().from(learnerSchedule).where(eq(learnerSchedule.profileId, profileId))
    )[0];
    if (!row)
      return {
        preset: 'leger',
        activeDays: [1, 2, 3, 4, 5, 6],
        dayStartMin: 540,
        dayEndMin: 720,
        intensity: 'leger',
      };
    return {
      preset: row.preset,
      activeDays: row.activeDays,
      dayStartMin: row.dayStartMin,
      dayEndMin: row.dayEndMin,
      intensity: row.intensity as ScheduleConfig['intensity'],
    };
  }

  async view(profileId: string): Promise<ScheduleView> {
    const cfg = await this.config(profileId);
    const p = (await this.db.select().from(profiles).where(eq(profiles.id, profileId)))[0];
    const [hasSecondaryRows, recurring] = await Promise.all([
      this.db.select().from(electives).where(eq(electives.profileId, profileId)),
      this.calendar.recurringInputsForProfile(profileId), // activités récurrentes des plugins activés
    ]);
    const hasSecondary = hasSecondaryRows.length > 0;

    const blocks = await this.enrich(
      profileId,
      weeklySchedule({
        age: ageFromBirth(p?.birthDate ?? null),
        activeDays: cfg.activeDays,
        dayStartMin: cfg.dayStartMin,
        dayEndMin: cfg.dayEndMin,
        intensity: cfg.intensity,
        hasSecondary,
        recurring,
      }),
    );

    const vacRows = await this.db
      .select()
      .from(scheduleVacations)
      .where(eq(scheduleVacations.profileId, profileId));
    const vacations: Vacation[] = vacRows
      .map((v) => ({ id: v.id, startDate: v.startDate, endDate: v.endDate, label: v.label }))
      .sort((a, b) => a.startDate.localeCompare(b.startDate));
    const today = todayStr();
    const onVacation = vacations.some((v) => v.startDate <= today && today <= v.endDate);

    return { config: cfg, blocks, presets: SCHEDULE_PRESETS, vacations, onVacation };
  }

  /** Applique un preset nommé. */
  async setPreset(profileId: string, presetKey: string): Promise<ScheduleView> {
    const preset = SCHEDULE_PRESETS.find((p) => p.key === presetKey);
    if (!preset) throw new BadRequestException('Profil inconnu.');
    await this.save(profileId, {
      preset: preset.key,
      activeDays: preset.activeDays,
      dayStartMin: preset.dayStartMin,
      dayEndMin: preset.dayEndMin,
      intensity: preset.intensity,
    });
    return this.view(profileId);
  }

  /** Réglage fin (sur-mesure). */
  async setConfig(profileId: string, cfg: Omit<ScheduleConfig, 'preset'>): Promise<ScheduleView> {
    if (cfg.activeDays.length === 0)
      throw new BadRequestException('Choisis au moins un jour actif.');
    if (cfg.dayEndMin - cfg.dayStartMin < 30)
      throw new BadRequestException('La plage horaire est trop courte.');
    await this.save(profileId, { preset: 'sur-mesure', ...cfg });
    return this.view(profileId);
  }

  private async save(profileId: string, cfg: ScheduleConfig): Promise<void> {
    await this.db
      .insert(learnerSchedule)
      .values({
        profileId,
        preset: cfg.preset,
        activeDays: cfg.activeDays,
        dayStartMin: cfg.dayStartMin,
        dayEndMin: cfg.dayEndMin,
        intensity: cfg.intensity,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: learnerSchedule.profileId,
        set: {
          preset: cfg.preset,
          activeDays: cfg.activeDays,
          dayStartMin: cfg.dayStartMin,
          dayEndMin: cfg.dayEndMin,
          intensity: cfg.intensity,
          updatedAt: new Date(),
        },
      });
  }

  async addVacation(
    profileId: string,
    startDate: string,
    endDate: string,
    label: string,
  ): Promise<ScheduleView> {
    if (endDate < startDate) throw new BadRequestException('La fin doit être après le début.');
    await this.db
      .insert(scheduleVacations)
      .values({ profileId, startDate, endDate, label: label || 'Vacances' });
    return this.view(profileId);
  }

  async removeVacation(profileId: string, id: string): Promise<ScheduleView> {
    await this.db
      .delete(scheduleVacations)
      .where(and(eq(scheduleVacations.profileId, profileId), eq(scheduleVacations.id, id)));
    return this.view(profileId);
  }
}
