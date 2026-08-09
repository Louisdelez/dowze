import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DB, type Database } from '../db/drizzle.module';
import { guardians } from '../db/schema';

@Injectable()
export class ParentalService {
  constructor(@Inject(DB) private readonly db: Database) {}

  /** Enregistre le responsable légal d'un compte mineur (« email plus »). */
  async registerGuardian(minorAccountId: string, email: string) {
    const inserted = await this.db.insert(guardians).values({ minorAccountId, email }).returning();
    return inserted[0];
  }

  async setConsent(guardianId: string, status: string, nowIso: string) {
    await this.db
      .update(guardians)
      .set({ consentStatus: status, consentAt: status === 'accorde' ? new Date(nowIso) : null })
      .where(eq(guardians.id, guardianId));
    return { ok: true as const };
  }
}
