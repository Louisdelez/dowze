import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { and, eq, isNull } from 'drizzle-orm';
import { DB, type Database } from '../db/drizzle.module';
import { accounts, profiles, guardians } from '../db/schema';
import { EmailService } from '../email/email.service';
import { tierFromBirthDate, type AgeTier } from './onboarding-rules';

const APP_URL = 'https://academie.dowze.ch';
const INVITE_TTL_MS = 72 * 60 * 60 * 1000; // 72 h

export interface RegisterInput {
  email: string;
  isMinor: boolean;
  displayName: string;
  locale: string;
  timezone: string;
  birthDate?: string | null;
  guardianEmail?: string | null;
  authUserId?: string | null;
}

export interface CompanionConfig {
  url?: string | null;
  size?: number;
  hidden?: boolean;
  camMode?: boolean;
  world?: string;
  camSize?: number;
  name?: string;
}

export interface UpdateProfileInput {
  displayName?: string;
  birthDate?: string | null;
  photoUrl?: string | null;
  companion?: CompanionConfig | null;
}

@Injectable()
export class AccountsService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly email: EmailService,
  ) {}

  /** Crée un compte + son profil, gère le lien parent/enfant (paliers d'âge + auto-liaison + email). */
  async register(input: RegisterInput) {
    const now = new Date();
    const tier = tierFromBirthDate(input.birthDate, now.toISOString());
    // Palier « enfant » (<13) : compte en attente de validation parentale (double confirmation).
    const activationStatus = tier === 'enfant' ? 'pending_parent' : 'active';

    const acc = (
      await this.db
        .insert(accounts)
        .values({
          email: input.email,
          isMinor: input.isMinor,
          role: 'eleve',
          authUserId: input.authUserId ?? null,
          activationStatus,
        })
        .returning()
    )[0];
    if (!acc) throw new Error('échec de création du compte');

    const tag = String(Math.floor(Math.random() * 10000)).padStart(4, '0'); // discriminateur Nom#tag
    const profile = (
      await this.db
        .insert(profiles)
        .values({
          accountId: acc.id,
          displayName: input.displayName,
          tag,
          locale: input.locale,
          timezone: input.timezone,
          birthDate: input.birthDate ?? null,
        })
        .returning()
    )[0];

    // Lien parent/contact de confiance (email ≠ celui de l'enfant, anti-abus).
    const guardianEmail = input.guardianEmail?.trim().toLowerCase() || null;
    if (guardianEmail && guardianEmail !== input.email.trim().toLowerCase()) {
      const token = randomUUID();
      const g = (
        await this.db
          .insert(guardians)
          .values({
            minorAccountId: acc.id,
            email: guardianEmail,
            tier,
            childConfirmedAt: now,
            inviteToken: token,
            inviteExpiresAt: new Date(now.getTime() + INVITE_TTL_MS),
          })
          .returning()
      )[0];

      // Auto-liaison : le parent a déjà un compte avec cet email → on le relie tout de suite.
      const parentAcc = (
        await this.db.select().from(accounts).where(eq(accounts.email, guardianEmail))
      )[0];
      if (parentAcc && g) {
        await this.db
          .update(guardians)
          .set({ guardianAccountId: parentAcc.id, parentConfirmedAt: now })
          .where(eq(guardians.id, g.id));
      }

      await this.sendGuardianInvite(guardianEmail, input.displayName, tier, Boolean(parentAcc));
    }

    // Auto-adoption : ce nouveau compte est-il le parent en attente d'enfant(s) déjà inscrit(s) ?
    await this.adoptPendingChildren(acc.id, input.email);

    return { account: acc, profile };
  }

  /** Relie ce compte (parent) à tous ses enfants en attente (dont l'email d'invitation = son email). */
  private async adoptPendingChildren(
    guardianAccountId: string,
    guardianEmail: string,
  ): Promise<void> {
    const email = guardianEmail.trim().toLowerCase();
    const pending = await this.db
      .select()
      .from(guardians)
      .where(and(eq(guardians.email, email), isNull(guardians.guardianAccountId)));
    for (const g of pending) {
      await this.db
        .update(guardians)
        .set({ guardianAccountId, parentConfirmedAt: new Date() })
        .where(eq(guardians.id, g.id));
    }
  }

  private async sendGuardianInvite(
    to: string,
    childName: string,
    tier: AgeTier,
    parentHasAccount: boolean,
  ): Promise<void> {
    const cta = parentHasAccount
      ? `Ouvrez votre espace responsable : ${APP_URL}/parent`
      : `Créez votre espace en quelques secondes (avec cette adresse e-mail) : ${APP_URL}/inscription`;

    let subject: string;
    let intro: string;
    if (tier === 'enfant') {
      subject = `${childName} a créé un compte Dowze — votre validation est requise`;
      intro = `${childName} (moins de 13 ans) vient de créer un compte sur Dowze, l'école du futur. Pour des raisons de sécurité, son compte reste **en attente tant que vous ne l'avez pas validé**. ${cta}, puis confirmez son compte.`;
    } else if (tier === 'mineur') {
      subject = `${childName} a créé un compte Dowze`;
      intro = `${childName} vient de créer un compte sur Dowze. Vous en êtes informé·e. Si vous le souhaitez, vous pouvez suivre ses progrès et veiller sur ses échanges. ${cta}`;
    } else {
      subject = `${childName} vous a ajouté·e comme contact de confiance sur Dowze`;
      intro = `${childName} vous a désigné·e comme contact de confiance sur Dowze. Vous pourrez suivre sa progression et être alerté·e en cas de problème (comme du harcèlement). Vous n'aurez jamais accès à son compte, et ${childName} peut vous retirer à tout moment. ${cta}`;
    }

    const text = `${intro}\n\n— L'équipe Dowze`;
    const html = `<div style="font-family:system-ui,sans-serif;line-height:1.5;color:#111">
      <h2 style="margin:0 0 12px">Dowze</h2>
      <p>${intro.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')}</p>
      <p style="color:#666;font-size:13px">— L'équipe Dowze</p>
    </div>`;
    await this.email.send({ to, subject, text, html });
  }

  /** Les comptes enfants/liés supervisés par ce compte parent. */
  async childrenForGuardian(guardianAccountId: string) {
    const rows = await this.db
      .select()
      .from(guardians)
      .where(eq(guardians.guardianAccountId, guardianAccountId));
    const out = [];
    for (const g of rows) {
      const childAcc = (
        await this.db.select().from(accounts).where(eq(accounts.id, g.minorAccountId))
      )[0];
      const childProfile = await this.profileForAccount(g.minorAccountId);
      if (!childAcc || !childProfile) continue;
      out.push({
        childAccountId: g.minorAccountId,
        name: childProfile.displayName,
        tier: g.tier as AgeTier,
        activationStatus: childAcc.activationStatus,
        needsParentConfirmation:
          g.tier === 'enfant' && childAcc.activationStatus === 'pending_parent',
      });
    }
    return out;
  }

  /** Le parent valide le compte d'un enfant <13 (double confirmation) → active le compte. */
  async confirmChild(guardianAccountId: string, childAccountId: string): Promise<{ ok: boolean }> {
    const g = (
      await this.db
        .select()
        .from(guardians)
        .where(
          and(
            eq(guardians.guardianAccountId, guardianAccountId),
            eq(guardians.minorAccountId, childAccountId),
          ),
        )
    )[0];
    if (!g) return { ok: false };
    await this.db
      .update(accounts)
      .set({ activationStatus: 'active' })
      .where(eq(accounts.id, childAccountId));
    await this.db
      .update(guardians)
      .set({ parentConfirmedAt: new Date() })
      .where(eq(guardians.id, g.id));
    return { ok: true };
  }

  async profileForAccount(accountId: string) {
    const rows = await this.db.select().from(profiles).where(eq(profiles.accountId, accountId));
    return rows[0] ?? null;
  }

  /** Résout le compte + profil de l'utilisateur authentifié (via son `auth.users.id`). */
  async meFromAuthId(authUserId: string) {
    const accs = await this.db.select().from(accounts).where(eq(accounts.authUserId, authUserId));
    const account = accs[0];
    if (!account) return null;
    const profile = await this.profileForAccount(account.id);
    return { account, profile };
  }

  /** Met à jour le profil de l'utilisateur authentifié (pseudo, date de naissance, photo). */
  async updateProfileForAuthId(authUserId: string, patch: UpdateProfileInput) {
    const me = await this.meFromAuthId(authUserId);
    if (!me?.profile) return null;
    const values: Record<string, unknown> = {};
    if (patch.displayName !== undefined) values.displayName = patch.displayName;
    if (patch.birthDate !== undefined) values.birthDate = patch.birthDate;
    if (patch.photoUrl !== undefined) values.photoUrl = patch.photoUrl;
    if (patch.companion !== undefined) values.companion = patch.companion;
    if (Object.keys(values).length === 0) return me.profile;
    const updated = (
      await this.db.update(profiles).set(values).where(eq(profiles.id, me.profile.id)).returning()
    )[0];
    return updated ?? me.profile;
  }
}
