import {
  Inject,
  Injectable,
  type CallHandler,
  type ExecutionContext,
  type NestInterceptor,
} from '@nestjs/common';
import { asc, eq } from 'drizzle-orm';
import { tap, type Observable } from 'rxjs';
import { DB, type Database } from '../db/drizzle.module';
import { accounts, hiveEvents, profiles } from '../db/schema';
import { classifyCompanionActivity } from './companion-activity';

interface CompanionRequest {
  method: string;
  originalUrl?: string;
  url: string;
  accountAuthId?: string;
}

/**
 * Fait entrer toute mutation métier réussie dans la continuité du compagnon.
 * L'écriture est best-effort et ne peut jamais faire échouer l'action utilisateur.
 */
@Injectable()
export class CompanionActivityInterceptor implements NestInterceptor {
  constructor(@Inject(DB) private readonly db: Database) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<CompanionRequest>();
    const activity = classifyCompanionActivity(request.method, request.originalUrl ?? request.url);
    return next.handle().pipe(
      tap(() => {
        if (activity && request.accountAuthId)
          void this.record(request.accountAuthId, request.method, activity);
      }),
    );
  }

  private async record(
    authId: string,
    method: string,
    activity: NonNullable<ReturnType<typeof classifyCompanionActivity>>,
  ): Promise<void> {
    try {
      const account = (
        await this.db
          .select({ id: accounts.id })
          .from(accounts)
          .where(eq(accounts.authUserId, authId))
      )[0];
      if (!account) return;
      const profile = (
        await this.db
          .select({ id: profiles.id })
          .from(profiles)
          .where(eq(profiles.accountId, account.id))
          .orderBy(asc(profiles.createdAt))
      )[0];
      if (!profile) return;
      await this.db.insert(hiveEvents).values({
        profileId: profile.id,
        kind: `dowze.${activity.domain}.completed`,
        channel: 'system',
        visibility: 'private',
        importance: 0.45,
        space: activity.space,
        content: `Action terminée dans ${activity.domain}.`,
        metadata: {
          method: method.toUpperCase(),
          path: activity.path,
          domain: activity.domain,
          source: 'dowze-core',
        },
      });
    } catch {
      // La continuité enrichit le système mais ne doit jamais casser l'action métier principale.
    }
  }
}
