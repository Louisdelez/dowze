import { Inject, Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { Worker } from 'bullmq';
import { ENV } from '../config/config.module';
import type { Env } from '../config/env';
import { logger } from '../observability/logger';
import { redisConnectionFromUrl } from '../jobs/connection';
import { QUEUE_HIVE_MAINTAIN } from '../jobs/jobs.service';
import { CompanionService } from './companion.service';
import { HiveContinuityService } from './hive-continuity.service';

/**
 * Consomme le job nocturne « hive-maintain » (programmé par `JobsService`) et lance la maintenance SÛRE
 * de la ruche pour chaque profil (embeddings + prune, PAS de fusion IA). Tourne dans le process API
 * (qui a déjà `CompanionService` en DI) → pas de contexte Nest à booter dans le worker. Best-effort : une
 * indisponibilité de Redis ne casse pas le boot de l'API.
 */
@Injectable()
export class HiveScheduler implements OnModuleInit, OnModuleDestroy {
  private worker?: Worker;

  constructor(
    @Inject(ENV) private readonly env: Env,
    private readonly companion: CompanionService,
    private readonly continuity: HiveContinuityService,
  ) {}

  onModuleInit(): void {
    try {
      const connection = redisConnectionFromUrl(this.env.REDIS_URL ?? 'redis://127.0.0.1:6379');
      this.worker = new Worker(
        QUEUE_HIVE_MAINTAIN,
        async () => {
          const r = await this.companion.nightlyMaintenanceAll();
          const memory = await this.continuity.nightlyConsolidateAll();
          logger.info(
            `Ruche — maintenance nocturne : ${r.profiles} profils, ${r.embedded} abeilles indexées, ${memory.embedded} événements indexés, ${r.retired} retirées, ${memory.created} mémoires consolidées`,
          );
          return { ok: true };
        },
        { connection },
      );
      this.worker.on('error', (err) => logger.error({ err }, 'Worker maintenance ruche'));
    } catch (err) {
      logger.error({ err }, 'Planification maintenance ruche indisponible');
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close().catch(() => undefined);
  }
}
