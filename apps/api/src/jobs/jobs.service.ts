import { Inject, Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import { ENV } from '../config/config.module';
import type { Env } from '../config/env';
import { digestJobId, peerNotifyJobId } from './job-ids';
import { redisConnectionFromUrl } from './connection';

export const QUEUE_DIGEST = 'parental-digest';
export const QUEUE_PEER_NOTIFY = 'peer-notify';

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
export class JobsService {
  private readonly digestQueue: Queue;
  private readonly peerQueue: Queue;

  constructor(@Inject(ENV) env: Env) {
    const connection = redisConnectionFromUrl(env.REDIS_URL ?? 'redis://127.0.0.1:6379');
    this.digestQueue = new Queue(QUEUE_DIGEST, { connection });
    this.peerQueue = new Queue(QUEUE_PEER_NOTIFY, { connection });
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
