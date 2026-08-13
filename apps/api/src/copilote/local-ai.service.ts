import { Inject, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { and, asc, eq, gt, inArray, lt } from 'drizzle-orm';
import { DB, type Database } from '../db/drizzle.module';
import { accounts, localAiJobs, profiles } from '../db/schema';

export interface LocalAiPayload {
  operation: 'chat' | 'embed';
  model: string;
  messages?: { role: 'system' | 'user' | 'assistant'; content: string }[];
  input?: string[];
  format?: Record<string, unknown>;
}

@Injectable()
export class LocalAiService {
  constructor(@Inject(DB) private readonly db: Database) {}

  private async profilesForAuth(authId: string): Promise<string[]> {
    const rows =
      await this.db
        .select({ id: profiles.id })
        .from(profiles)
        .innerJoin(accounts, eq(accounts.id, profiles.accountId))
        .where(eq(accounts.authUserId, authId));
    if (rows.length === 0) throw new ServiceUnavailableException('Profil Dowze introuvable.');
    return rows.map((row) => row.id);
  }

  async next(authId: string) {
    const profileIds = await this.profilesForAuth(authId);
    await this.db
      .update(localAiJobs)
      .set({ status: 'failed', error: 'Travail Ollama expiré.', completedAt: new Date() })
      .where(
        and(
          inArray(localAiJobs.profileId, profileIds),
          inArray(localAiJobs.status, ['pending', 'claimed']),
          lt(localAiJobs.expiresAt, new Date()),
        ),
      );
    const row = (
      await this.db
        .select()
        .from(localAiJobs)
        .where(
          and(
            inArray(localAiJobs.profileId, profileIds),
            eq(localAiJobs.status, 'pending'),
            gt(localAiJobs.expiresAt, new Date()),
          ),
        )
        .orderBy(asc(localAiJobs.createdAt))
        .limit(1)
    )[0];
    if (!row) return null;
    const claimed = (
      await this.db
        .update(localAiJobs)
        .set({ status: 'claimed', claimedAt: new Date() })
        .where(and(eq(localAiJobs.id, row.id), eq(localAiJobs.status, 'pending')))
        .returning()
    )[0];
    return claimed ?? null;
  }

  async complete(authId: string, id: string, result?: unknown, error?: string) {
    const profileIds = await this.profilesForAuth(authId);
    const row = (
      await this.db
        .update(localAiJobs)
        .set({
          status: error ? 'failed' : 'completed',
          result: error ? null : result,
          error: error?.slice(0, 2000) ?? null,
          completedAt: new Date(),
        })
        .where(
          and(
            eq(localAiJobs.id, id),
            inArray(localAiJobs.profileId, profileIds),
            eq(localAiJobs.status, 'claimed'),
          ),
        )
        .returning({ id: localAiJobs.id })
    )[0];
    if (!row) throw new ServiceUnavailableException('Travail Ollama introuvable.');
    return { ok: true };
  }

  async request(profileId: string, payload: LocalAiPayload): Promise<unknown> {
    const expiresAt = new Date(Date.now() + 120_000);
    const job = (
      await this.db.insert(localAiJobs).values({ profileId, payload, expiresAt }).returning()
    )[0]!;
    const deadline = Date.now() + 120_000;
    while (Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 500));
      const current = (
        await this.db.select().from(localAiJobs).where(eq(localAiJobs.id, job.id)).limit(1)
      )[0];
      if (current?.status === 'completed') return current.result;
      if (current?.status === 'failed')
        throw new ServiceUnavailableException(current.error || 'Ollama local a échoué.');
    }
    throw new ServiceUnavailableException(
      'Le connecteur Ollama local ne répond pas. Ouvre Dowze Desktop sur cette machine.',
    );
  }
}
