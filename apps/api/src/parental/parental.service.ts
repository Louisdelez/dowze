import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DB, type Database } from '../db/drizzle.module';
import { guardians, profiles, masteryStates, planningEntries } from '../db/schema';

export interface ParentalSummary {
  profileId: string | null;
  masteredCount: number;
  inProgressCount: number;
  planningCount: number;
}

@Injectable()
export class ParentalService {
  constructor(@Inject(DB) private readonly db: Database) {}

  /** Enregistre le responsable légal d'un compte mineur (« email plus »). */
  async registerGuardian(minorAccountId: string, email: string) {
    const inserted = await this.db
      .insert(guardians)
      .values({ minorAccountId, email })
      .returning();
    return inserted[0];
  }

  async setConsent(guardianId: string, status: string, nowIso: string) {
    await this.db
      .update(guardians)
      .set({ consentStatus: status, consentAt: status === 'accorde' ? new Date(nowIso) : null })
      .where(eq(guardians.id, guardianId));
    return { ok: true as const };
  }

  /**
   * Synthèse de haut niveau pour le responsable — **jamais** le contenu privé brut
   * (pas de messages, pas de détail de conversation) : seulement des compteurs.
   */
  async summary(minorAccountId: string): Promise<ParentalSummary> {
    const profs = await this.db
      .select()
      .from(profiles)
      .where(eq(profiles.accountId, minorAccountId));
    const profile = profs[0];
    if (!profile) {
      return { profileId: null, masteredCount: 0, inProgressCount: 0, planningCount: 0 };
    }
    const mastery = await this.db
      .select()
      .from(masteryStates)
      .where(eq(masteryStates.profileId, profile.id));
    const planning = await this.db
      .select()
      .from(planningEntries)
      .where(eq(planningEntries.profileId, profile.id));
    const masteredCount = mastery.filter((m) => m.pMastery >= 0.95).length;
    return {
      profileId: profile.id,
      masteredCount,
      inProgressCount: mastery.length - masteredCount,
      planningCount: planning.length,
    };
  }
}
