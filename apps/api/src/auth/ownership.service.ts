import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { eq, inArray } from 'drizzle-orm';
import { DB, type Database } from '../db/drizzle.module';
import { accounts, guardians, profiles } from '../db/schema';

/**
 * AUTORISATION (≠ authentification) : vérifie qu'un `profileId` reçu du client appartient bien au compte
 * du JWT. Ferme l'IDOR : sans ce contrôle, tout utilisateur connecté pouvait lire/écrire les données (et
 * dépenser les crédits) de n'importe quel profil en passant son id (audit 08-2026).
 *
 * Profils autorisés pour un compte = ses propres profils + les profils des comptes qu'il SUPERVISE
 * (table `guardians` : parent → enfant). Cache court en mémoire, avec re-lecture immédiate en cas
 * d'absence (un profil créé à l'instant doit être utilisable tout de suite).
 */
const TTL_MS = 60_000;

@Injectable()
export class OwnershipService {
  private readonly cache = new Map<string, { ids: Set<string>; at: number }>();

  constructor(@Inject(DB) private readonly db: Database) {}

  private async load(authId: string): Promise<Set<string>> {
    const ids = new Set<string>();
    const acc = (
      await this.db.select({ id: accounts.id }).from(accounts).where(eq(accounts.authUserId, authId))
    )[0];
    if (acc) {
      const own = await this.db
        .select({ id: profiles.id })
        .from(profiles)
        .where(eq(profiles.accountId, acc.id));
      for (const p of own) ids.add(p.id);
      const minors = await this.db
        .select({ id: guardians.minorAccountId })
        .from(guardians)
        .where(eq(guardians.guardianAccountId, acc.id));
      if (minors.length > 0) {
        const theirs = await this.db
          .select({ id: profiles.id })
          .from(profiles)
          .where(
            inArray(
              profiles.accountId,
              minors.map((m) => m.id),
            ),
          );
        for (const p of theirs) ids.add(p.id);
      }
    }
    this.cache.set(authId, { ids, at: Date.now() });
    return ids;
  }

  private async allowed(authId: string): Promise<Set<string>> {
    const hit = this.cache.get(authId);
    if (hit && Date.now() - hit.at < TTL_MS) return hit.ids;
    return this.load(authId);
  }

  /** 403 si `profileId` n'appartient pas au compte (re-vérifie une fois hors cache avant de refuser). */
  async assertOwns(authId: string, profileId: string): Promise<void> {
    let ids = await this.allowed(authId);
    if (!ids.has(profileId)) ids = await this.load(authId);
    if (!ids.has(profileId)) throw new ForbiddenException('profil non autorisé pour ce compte');
  }
}
