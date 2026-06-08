import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DB, type Database } from '../db/drizzle.module';
import { accounts, profiles, guardians } from '../db/schema';

export interface RegisterInput {
  email: string;
  isMinor: boolean;
  displayName: string;
  locale: string;
  timezone: string;
  guardianEmail?: string | null;
  authUserId?: string | null;
}

@Injectable()
export class AccountsService {
  constructor(@Inject(DB) private readonly db: Database) {}

  /** Crée un compte + son profil (+ le responsable légal si mineur). */
  async register(input: RegisterInput) {
    const acc = (
      await this.db
        .insert(accounts)
        .values({
          email: input.email,
          isMinor: input.isMinor,
          role: 'eleve',
          authUserId: input.authUserId ?? null,
        })
        .returning()
    )[0];
    if (!acc) throw new Error('échec de création du compte');

    const profile = (
      await this.db
        .insert(profiles)
        .values({
          accountId: acc.id,
          displayName: input.displayName,
          locale: input.locale,
          timezone: input.timezone,
        })
        .returning()
    )[0];

    if (input.isMinor && input.guardianEmail) {
      await this.db
        .insert(guardians)
        .values({ minorAccountId: acc.id, email: input.guardianEmail });
    }

    return { account: acc, profile };
  }

  async profileForAccount(accountId: string) {
    const rows = await this.db.select().from(profiles).where(eq(profiles.accountId, accountId));
    return rows[0] ?? null;
  }
}
