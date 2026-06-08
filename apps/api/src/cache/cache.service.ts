import { Inject, Injectable } from '@nestjs/common';
import { Redis } from 'ioredis';
import { ENV } from '../config/config.module';
import type { Env } from '../config/env';

/**
 * Cache **cache-aside** sur Redis : lire le cache, sinon charger puis écrire.
 * Connexion paresseuse (pas de connexion au boot si Redis absent).
 */
@Injectable()
export class CacheService {
  private readonly redis: Redis;

  constructor(@Inject(ENV) env: Env) {
    this.redis = new Redis(env.REDIS_URL ?? 'redis://127.0.0.1:6379', {
      lazyConnect: true,
      maxRetriesPerRequest: null,
    });
  }

  async getJson<T>(key: string): Promise<T | null> {
    const value = await this.redis.get(key);
    return value ? (JSON.parse(value) as T) : null;
  }

  async setJson(key: string, value: unknown, ttlSec: number): Promise<void> {
    await this.redis.set(key, JSON.stringify(value), 'EX', ttlSec);
  }

  /** Lit le cache ; en cas de miss, charge via `loader`, écrit, puis renvoie. */
  async cacheAside<T>(key: string, ttlSec: number, loader: () => Promise<T>): Promise<T> {
    const hit = await this.getJson<T>(key);
    if (hit !== null) return hit;
    const fresh = await loader();
    await this.setJson(key, fresh, ttlSec);
    return fresh;
  }
}
