import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import type { IncidentSeverity, IncidentSource } from '@dowze/schemas';
import { DB, type Database } from '../db/drizzle.module';
import {
  moderationIncidents,
  moderationActions,
  parentalAlerts,
  profiles,
  accounts,
  guardians,
} from '../db/schema';
import { decideEscalation } from './moderation-policy';

export interface ReportInput {
  source: IncidentSource;
  severity: IncidentSeverity;
  contentRef: string;
  authorId: string | null;
  victimId: string | null;
}

@Injectable()
export class ModerationService {
  constructor(@Inject(DB) private readonly db: Database) {}

  private async accountForProfile(
    profileId: string | null,
  ): Promise<{ accountId: string; isMinor: boolean } | null> {
    if (!profileId) return null;
    const rows = await this.db
      .select({ accountId: profiles.accountId, isMinor: accounts.isMinor })
      .from(profiles)
      .innerJoin(accounts, eq(profiles.accountId, accounts.id))
      .where(eq(profiles.id, profileId));
    return rows[0] ?? null;
  }

  /** Signale un incident, applique la politique, prépare l'alerte parent si requis. */
  async report(input: ReportInput) {
    const author = await this.accountForProfile(input.authorId);
    const victim = await this.accountForProfile(input.victimId);
    const decision = decideEscalation({
      severity: input.severity,
      authorIsMinor: author?.isMinor ?? false,
      victimIsMinor: victim?.isMinor ?? false,
    });

    const status = decision.humanReview ? 'en-revue-humaine' : 'ouvert';
    const inserted = await this.db
      .insert(moderationIncidents)
      .values({ ...input, status })
      .returning();
    const incident = inserted[0];
    if (!incident) throw new Error('échec de création de l’incident');

    let alertPrepared = false;
    if (decision.alertParent) {
      const minorAccountId = author?.isMinor
        ? author.accountId
        : victim?.isMinor
          ? victim.accountId
          : null;
      if (minorAccountId) {
        const g = await this.db
          .select()
          .from(guardians)
          .where(eq(guardians.minorAccountId, minorAccountId));
        const email = g[0]?.email;
        if (email) {
          // Alerte PRÉPARÉE, non envoyée : un humain doit la valider (humanValidated=false).
          await this.db.insert(parentalAlerts).values({
            minorAccountId,
            guardianEmail: email,
            incidentId: incident.id,
            severity: input.severity,
            reason: `Incident ${input.severity} (${input.contentRef})`,
            humanValidated: false,
          });
          alertPrepared = true;
        }
      }
    }
    return { incident, decision, alertPrepared };
  }

  /** Les incidents en attente de décision humaine. */
  listForReview() {
    return this.db
      .select()
      .from(moderationIncidents)
      .where(eq(moderationIncidents.status, 'en-revue-humaine'));
  }

  /** Décision d'un modérateur humain (tranche toujours en dernier). */
  async act(incidentId: string, actorId: string, kind: string, reason: string) {
    await this.db.insert(moderationActions).values({ incidentId, actorId, kind, reason });
    const status = kind === 'escalade' ? 'escalade' : 'resolu';
    await this.db
      .update(moderationIncidents)
      .set({ status })
      .where(eq(moderationIncidents.id, incidentId));
    return { ok: true as const, status };
  }
}
