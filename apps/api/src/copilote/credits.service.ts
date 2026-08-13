import { Inject, Injectable } from '@nestjs/common';
import { and, eq, gte, sql } from 'drizzle-orm';
import type { AiModel } from '@dowze/schemas';
import { DB, type Database } from '../db/drizzle.module';
import { creditBalances, creditLedger } from '../db/schema';

/** 1 crédit Dowze ≈ 0,1 centime (USD). */
const CREDIT_USD = 0.001;
/** Multiplicateur de marge (l'élève paie ~3× le coût réel → marge ~70 %). */
const MARGIN = 3;

/** Coût d'un appel, en crédits, à partir des tokens consommés et du prix du modèle. */
export function creditsForUsage(model: AiModel, inputTokens: number, outputTokens: number): number {
  const usd = (inputTokens / 1e6) * model.priceIn + (outputTokens / 1e6) * model.priceOut;
  return Math.ceil(((usd / CREDIT_USD) * MARGIN * 100) / 100) || 1;
}

/** Estimation prudente AVANT l'appel (pré-débit) — volontairement large. */
export function estimateCredits(model: AiModel): number {
  return creditsForUsage(model, 9000, 1800);
}

@Injectable()
export class CreditsService {
  constructor(@Inject(DB) private readonly db: Database) {}

  async balance(profileId: string): Promise<number> {
    const rows = await this.db
      .select()
      .from(creditBalances)
      .where(eq(creditBalances.profileId, profileId));
    return rows[0]?.balance ?? 0;
  }

  /** Crédite un profil (recharge / don / remboursement) et journalise. */
  async grant(profileId: string, credits: number, reason: string, ref?: string): Promise<number> {
    return this.db.transaction(async (tx) => {
      await tx
        .insert(creditBalances)
        .values({ profileId, balance: credits, updatedAt: new Date() })
        .onConflictDoUpdate({
          target: creditBalances.profileId,
          set: { balance: sql`${creditBalances.balance} + ${credits}`, updatedAt: new Date() },
        });
      await tx.insert(creditLedger).values({ profileId, delta: credits, reason, ref: ref ?? null });
      const rows = await tx
        .select()
        .from(creditBalances)
        .where(eq(creditBalances.profileId, profileId));
      return rows[0]?.balance ?? 0;
    });
  }

  /**
   * Débit atomique AVANT l'appel LLM : ne décrémente QUE si le solde couvre le coût
   * (`UPDATE … WHERE balance >= cost RETURNING`). Renvoie `true` si débité, `false` sinon
   * (aucun effet) → anti double-dépense et garde-fou anti-runaway.
   */
  async tryDebit(
    profileId: string,
    credits: number,
    reason: string,
    ref?: string,
  ): Promise<boolean> {
    return this.db.transaction(async (tx) => {
      const updated = await tx
        .update(creditBalances)
        .set({ balance: sql`${creditBalances.balance} - ${credits}`, updatedAt: new Date() })
        .where(and(eq(creditBalances.profileId, profileId), gte(creditBalances.balance, credits)))
        .returning({ balance: creditBalances.balance });
      if (updated.length === 0) return false;
      await tx
        .insert(creditLedger)
        .values({ profileId, delta: -credits, reason, ref: ref ?? null });
      return true;
    });
  }

  /**
   * Réconciliation après l'appel : ajuste le pré-débit (`estimate`) avec le coût réel
   * (`actual`). Rembourse le trop-perçu, ou prélève le complément (borné au solde).
   */
  async reconcile(
    profileId: string,
    estimate: number,
    actual: number,
    ref?: string,
  ): Promise<void> {
    const diff = estimate - actual;
    if (Math.abs(diff) < 1) return;
    if (diff > 0) await this.grant(profileId, diff, 'refund', ref);
    else await this.tryDebit(profileId, -diff, 'reconcile', ref);
  }
}
