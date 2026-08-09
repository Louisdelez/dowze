import { Inject, Injectable, Logger, type OnModuleDestroy } from '@nestjs/common';
import { Redis } from 'ioredis';
import { ENV } from '../config/config.module';
import type { Env } from '../config/env';

type RealtimeEvent = { type: string; [k: string]: unknown };
type Listener = (e: RealtimeEvent) => void;

const PRESENCE_TTL_SEC = 60; // hors ligne si pas de heartbeat depuis 60 s (heartbeat client ~30 s)

/**
 * Temps réel via Redis pub/sub (fan-out multi-instance) + présence (heartbeat + TTL).
 * Transport client = SSE (voir RealtimeController). Publie sur `user:{profileId}`.
 */
@Injectable()
export class RealtimeService implements OnModuleDestroy {
  private readonly logger = new Logger('Realtime');
  private readonly pub: Redis;
  private readonly sub: Redis;
  private readonly listeners = new Map<string, Set<Listener>>();

  constructor(@Inject(ENV) env: Env) {
    const url = env.REDIS_URL ?? 'redis://127.0.0.1:6379';
    const opts = { lazyConnect: true, maxRetriesPerRequest: null as null };
    this.pub = new Redis(url, opts);
    this.sub = new Redis(url, opts);
    void this.sub.psubscribe('user:*').catch((e) => this.logger.warn(`psubscribe: ${e}`));
    this.sub.on('pmessage', (_pattern, channel, message) => {
      const profileId = channel.slice('user:'.length);
      const set = this.listeners.get(profileId);
      if (!set || set.size === 0) return;
      try {
        const event = JSON.parse(message) as RealtimeEvent;
        for (const cb of set) cb(event);
      } catch {
        /* message non-JSON ignoré */
      }
    });
  }

  /** Publie un événement vers tous les flux ouverts d'un utilisateur (via Redis, multi-instance). */
  async publishToUser(profileId: string, event: RealtimeEvent): Promise<void> {
    try {
      await this.pub.publish(`user:${profileId}`, JSON.stringify(event));
    } catch (e) {
      this.logger.warn(`publish: ${e instanceof Error ? e.message : e}`);
    }
  }

  /** Abonne un flux SSE local ; renvoie une fonction de désabonnement. */
  subscribe(profileId: string, cb: Listener): () => void {
    let set = this.listeners.get(profileId);
    if (!set) {
      set = new Set();
      this.listeners.set(profileId, set);
    }
    set.add(cb);
    return () => {
      const s = this.listeners.get(profileId);
      if (!s) return;
      s.delete(cb);
      if (s.size === 0) this.listeners.delete(profileId);
    };
  }

  /** Rafraîchit la présence (heartbeat). */
  async heartbeat(profileId: string): Promise<void> {
    try {
      await this.pub.set(`presence:${profileId}`, '1', 'EX', PRESENCE_TTL_SEC);
    } catch {
      /* Redis indisponible : la présence est best-effort */
    }
  }

  /** Statut en ligne d'un ensemble de profils. */
  async online(ids: string[]): Promise<Record<string, boolean>> {
    const out: Record<string, boolean> = {};
    for (const id of ids) {
      try {
        out[id] = (await this.pub.exists(`presence:${id}`)) === 1;
      } catch {
        out[id] = false;
      }
    }
    return out;
  }

  async onModuleDestroy(): Promise<void> {
    try {
      await this.sub.quit();
      await this.pub.quit();
    } catch {
      /* ignore */
    }
  }
}
