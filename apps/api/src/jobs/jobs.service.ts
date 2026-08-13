import { Inject, Injectable, type OnModuleInit } from '@nestjs/common';
import { Queue } from 'bullmq';
import { ENV } from '../config/config.module';
import type { Env } from '../config/env';
import { digestJobId, peerNotifyJobId } from './job-ids';
import { redisConnectionFromUrl } from './connection';

export const QUEUE_DIGEST = 'parental-digest';
export const QUEUE_PEER_NOTIFY = 'peer-notify';
export const QUEUE_HIVE_MAINTAIN = 'hive-maintain';

const JOB_OPTS = {
  removeOnComplete: true,
  attempts: 3,
  backoff: { type: 'exponential' as const, delay: 5000 },
};

/**
 * Producteur de jobs (BullMQ). Les workers (worker.ts) les consomment.
 * jobId idempotent → pas de doublon.
 */
@Injectable()
export class JobsService implements OnModuleInit {
  private readonly digestQueue: Queue;
  private readonly peerQueue: Queue;
  private readonly hiveQueue: Queue;

  constructor(@Inject(ENV) env: Env) {
    const connection = redisConnectionFromUrl(env.REDIS_URL ?? 'redis://127.0.0.1:6379');
    this.digestQueue = new Queue(QUEUE_DIGEST, { connection });
    this.peerQueue = new Queue(QUEUE_PEER_NOTIFY, { connection });
    this.hiveQueue = new Queue(QUEUE_HIVE_MAINTAIN, { connection });
  }

  /** Programme la maintenance nocturne de la ruche (répétable, ~3 h du matin). Idempotent. */
  async onModuleInit(): Promise<void> {
    try {
      await this.hiveQueue.add(
        'nightly',
        {},
        { repeat: { pattern: '23 3 * * *' }, jobId: 'hive-nightly', removeOnComplete: true },
      );
    } catch {
      /* Redis indisponible : la planification reprendra au prochain boot */
    }
  }

  enqueueDigest(minorAccountId: string, periodIso: string) {
    return this.digestQueue.add(
      'digest',
      { minorAccountId, periodIso },
      { jobId: digestJobId(minorAccountId, periodIso), ...JOB_OPTS },
    );
  }

  enqueuePeerNotify(skillId: string, learnerId: string) {
    return this.peerQueue.add(
      'notify',
      { skillId, learnerId },
      { jobId: peerNotifyJobId(skillId, learnerId), ...JOB_OPTS },
    );
  }
}
