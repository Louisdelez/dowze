import {
  type CanActivate,
  type ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { timingSafeEqual } from 'node:crypto';
import { ENV } from '../config/config.module';
import type { Env } from '../config/env';
import { verifySupabaseJwt } from './jwt';
import { OwnershipService } from './ownership.service';

interface RequestLike {
  headers: Record<string, string | undefined>;
  params?: Record<string, string | undefined>;
  body?: unknown;
  accountAuthId?: string;
}

/** Comparaison de secrets en temps constant (évite l'oracle temporel sur le jeton admin). */
export function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

/**
 * Garde Supabase : AUTHENTIFIE (JWT `Authorization: Bearer`) puis AUTORISE (audit 08-2026) — tout
 * `profileId` présent dans l'URL ou le body doit appartenir au compte du jeton (`OwnershipService`),
 * sinon 403. Convention de l'API : un `profileId` top-level signifie toujours « agir en tant que ce
 * profil » (les cibles tierces utilisent d'autres noms : `targetProfileId`…).
 * Exception : un jeton admin valide (`x-admin-token`, comparé en temps constant) court-circuite le
 * contrôle de propriété (ex. créditer le solde d'un profil arbitraire).
 */
@Injectable()
export class SupabaseAuthGuard implements CanActivate {
  constructor(
    @Inject(ENV) private readonly env: Env,
    private readonly ownership: OwnershipService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // En dev/test sans secret configuré, on n'impose pas l'auth.
    if (!this.env.SUPABASE_JWT_SECRET) return true;

    const req = context.switchToHttp().getRequest<RequestLike>();
    const header = req.headers['authorization'] ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    if (!token) throw new UnauthorizedException('jeton manquant');

    try {
      req.accountAuthId = await verifySupabaseJwt(token, this.env.SUPABASE_JWT_SECRET);
    } catch {
      throw new UnauthorizedException('jeton invalide');
    }

    // Bypass admin (opérations transverses légitimes, ex. octroi de crédits).
    const adminToken = req.headers['x-admin-token'];
    if (
      adminToken &&
      this.env.COPILOTE_ADMIN_TOKEN &&
      safeEqual(adminToken, this.env.COPILOTE_ADMIN_TOKEN)
    ) {
      return true;
    }

    // Autorisation : le profileId revendiqué doit appartenir au compte authentifié.
    const body = req.body as Record<string, unknown> | undefined;
    const claimed =
      req.params?.profileId ?? (typeof body?.profileId === 'string' ? body.profileId : undefined);
    if (typeof claimed === 'string' && claimed.length > 0) {
      await this.ownership.assertOwns(req.accountAuthId, claimed);
    }
    return true;
  }
}
