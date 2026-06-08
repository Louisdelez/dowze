import {
  type CanActivate,
  type ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ENV } from '../config/config.module';
import type { Env } from '../config/env';
import { verifySupabaseJwt } from './jwt';

interface RequestLike {
  headers: Record<string, string | undefined>;
  accountAuthId?: string;
}

/**
 * Garde d'authentification Supabase (JWT en en-tête `Authorization: Bearer`).
 * RLS reste la défense en profondeur côté base ; cette garde porte
 * l'autorisation applicative.
 */
@Injectable()
export class SupabaseAuthGuard implements CanActivate {
  constructor(@Inject(ENV) private readonly env: Env) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // En dev/test sans secret configuré, on n'impose pas l'auth.
    if (!this.env.SUPABASE_JWT_SECRET) return true;

    const req = context.switchToHttp().getRequest<RequestLike>();
    const header = req.headers['authorization'] ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    if (!token) throw new UnauthorizedException('jeton manquant');

    try {
      req.accountAuthId = await verifySupabaseJwt(token, this.env.SUPABASE_JWT_SECRET);
      return true;
    } catch {
      throw new UnauthorizedException('jeton invalide');
    }
  }
}
