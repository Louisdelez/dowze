import 'reflect-metadata';
import { Worker } from 'bullmq';
import { loadEnv } from './config/env';
import { logger } from './observability/logger';
import {
  processDigest,
  processPeerNotify,
  type DigestJob,
  type PeerNotifyJob,
} from './jobs/processors';
import { QUEUE_DIGEST, QUEUE_PEER_NOTIFY } from './jobs/jobs.service';
import { redisConnectionFromUrl } from './jobs/connection';

/**
 * Entrée des **workers** BullMQ (process séparé de l'API ; `node dist/worker.js`).
 * Idempotents, backoff exponentiel, graceful shutdown.
 */
const env = loadEnv();
const connection = redisConnectionFromUrl(env.REDIS_URL ?? 'redis://127.0.0.1:6379');

const digestWorker = new Worker(QUEUE_DIGEST, (job) => processDigest(job.data as DigestJob), {
  connection,
});
const peerWorker = new Worker(
  QUEUE_PEER_NOTIFY,
  (job) => processPeerNotify(job.data as PeerNotifyJob),
  { connection },
);

logger.info('Workers Dowze démarrés');

async function shutdown(): Promise<void> {
  await Promise.all([digestWorker.close(), peerWorker.close()]);
  process.exit(0);
}

process.on('SIGTERM', () => void shutdown());
process.on('SIGINT', () => void shutdown());
