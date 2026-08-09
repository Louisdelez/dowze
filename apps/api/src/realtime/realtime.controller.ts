import { Controller, Get, Inject, Param, Post, Query, Sse, UseGuards, type MessageEvent } from '@nestjs/common';
import { Observable } from 'rxjs';
import { z } from 'zod';
import { ENV } from '../config/config.module';
import type { Env } from '../config/env';
import { verifySupabaseJwt } from '../auth/jwt';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { RealtimeService } from './realtime.service';

const uuid = z.string().uuid();

@Controller('realtime')
export class RealtimeController {
  constructor(
    private readonly realtime: RealtimeService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  /**
   * Flux SSE d'un utilisateur (messages, typing, présence). EventSource ne pouvant pas envoyer
   * d'en-tête, le jeton passe en `?token=` et est vérifié ici.
   */
  @Sse(':profileId/stream')
  stream(@Param('profileId') profileId: string, @Query('token') token = ''): Observable<MessageEvent> {
    const pid = uuid.parse(profileId);
    return new Observable<MessageEvent>((observer) => {
      let teardown: (() => void) | null = null;
      let keepAlive: ReturnType<typeof setInterval> | null = null;

      const start = () => {
        teardown = this.realtime.subscribe(pid, (e) => observer.next({ data: e } as MessageEvent));
        // Commentaire keep-alive pour éviter la fermeture par les proxys.
        keepAlive = setInterval(() => observer.next({ data: { type: 'ping' } } as MessageEvent), 25000);
        observer.next({ data: { type: 'ready' } } as MessageEvent);
      };

      // Vérification du jeton (best-effort : si aucun secret configuré, on n'impose pas).
      if (!this.env.SUPABASE_JWT_SECRET) {
        start();
      } else {
        verifySupabaseJwt(token, this.env.SUPABASE_JWT_SECRET)
          .then(() => start())
          .catch(() => observer.error(new Error('jeton invalide')));
      }

      return () => {
        if (keepAlive) clearInterval(keepAlive);
        if (teardown) teardown();
      };
    });
  }

  @Post(':profileId/heartbeat')
  @UseGuards(SupabaseAuthGuard)
  async heartbeat(@Param('profileId') profileId: string): Promise<{ ok: true }> {
    await this.realtime.heartbeat(uuid.parse(profileId));
    return { ok: true as const };
  }

  @Get(':profileId/presence')
  @UseGuards(SupabaseAuthGuard)
  presence(@Param('profileId') profileId: string, @Query('ids') ids = ''): Promise<Record<string, boolean>> {
    uuid.parse(profileId);
    const list = ids.split(',').map((s) => s.trim()).filter((s) => uuid.safeParse(s).success);
    return this.realtime.online(list);
  }
}
