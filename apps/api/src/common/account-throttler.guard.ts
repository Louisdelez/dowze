import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

/**
 * Throttling par COMPTE plutôt que par IP dès qu'un jeton est présent (audit 08-2026) : la limite par IP
 * seule se contourne en tournant les IP, et pénalise les réseaux partagés (école entière derrière un NAT).
 *
 * Le `sub` est DÉCODÉ sans vérification — suffisant pour du bucketing : la signature est vérifiée ensuite
 * par `SupabaseAuthGuard` (un `sub` forgé mange sa propre limite puis prend un 401). Sans jeton → repli IP.
 */
@Injectable()
export class AccountThrottlerGuard extends ThrottlerGuard {
  protected override async getTracker(req: Record<string, unknown>): Promise<string> {
    const headers = req['headers'] as Record<string, string | undefined> | undefined;
    const header = headers?.['authorization'] ?? '';
    if (header.startsWith('Bearer ')) {
      const payload = header.slice(7).split('.')[1];
      if (payload) {
        try {
          const sub: unknown = JSON.parse(Buffer.from(payload, 'base64url').toString()).sub;
          if (typeof sub === 'string' && sub.length > 0) return `acct:${sub}`;
        } catch {
          /* jeton illisible → repli IP */
        }
      }
    }
    const ips = req['ips'];
    if (Array.isArray(ips) && ips.length > 0 && typeof ips[0] === 'string') return ips[0];
    return (req['ip'] as string) ?? 'unknown';
  }
}
