import { Inject, Injectable, Logger } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DB, type Database } from '../db/drizzle.module';
import { ENV } from '../config/config.module';
import type { Env } from '../config/env';
import {
  accounts,
  aiModerationFlags,
  conversationParticipants,
  guardians,
  parentalAlerts,
  profiles,
} from '../db/schema';
import { classifyText, type ClassifyResult } from './classify';
import { classifyWithLlm } from './moderation-llm';
import { EmailService } from '../email/email.service';

@Injectable()
export class AiModerationService {
  private readonly logger = new Logger('AiModeration');

  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(ENV) private readonly env: Env,
    private readonly email: EmailService,
  ) {}

  /**
   * Classe un message : LLM dédié si configuré (MODERATION_*), sinon repli sur le classifieur
   * règle-based. Un échec LLM retombe aussi sur les règles (jamais de trou de modération).
   */
  private async classify(text: string): Promise<ClassifyResult> {
    const { MODERATION_PROVIDER: provider, MODERATION_MODEL: model, MODERATION_API_KEY: apiKey } = this.env;
    if (provider && model && apiKey) {
      try {
        return await classifyWithLlm(text, { provider, model, apiKey });
      } catch (e) {
        this.logger.warn(`LLM de modération indisponible, repli sur les règles: ${e instanceof Error ? e.message : e}`);
      }
    }
    return classifyText(text);
  }

  /**
   * Analyse un message. Si détection : crée un signalement IA (modération) ET alerte le parent
   * IMMÉDIATEMENT et EN MÊME TEMPS (doc 26 §7.3). L'IA suspecte/signale — elle ne bannit jamais.
   * Best-effort : ne bloque pas l'envoi si l'analyse échoue.
   */
  async scanMessage(
    messageId: string,
    authorId: string,
    conversationId: string,
    body: string,
  ): Promise<void> {
    try {
      const r = await this.classify(body);
      if (!r.flagged || !r.category) return;

      // 1) Signalement à la MODÉRATION (ticket IA, revu par un humain — jamais de ban auto).
      await this.db.insert(aiModerationFlags).values({
        messageId,
        authorId,
        conversationId,
        category: r.category,
        reason: r.reason,
        severity: r.severity,
      });

      // 2) Alerte IMMÉDIATE au(x) parent(s) — de chaque mineur impliqué (auteur + destinataires).
      const authorName = await this.nameOf(authorId);
      const parts = await this.db
        .select()
        .from(conversationParticipants)
        .where(eq(conversationParticipants.conversationId, conversationId));
      for (const p of parts) {
        const acc = await this.accountOf(p.profileId);
        if (!acc?.isMinor) continue;
        const g = (await this.db.select().from(guardians).where(eq(guardians.minorAccountId, acc.id)))[0];
        if (!g) continue;
        const role = p.profileId === authorId ? "votre enfant a écrit" : `votre enfant a reçu (de ${authorName})`;
        const reason = `Modération IA — ${r.category} : ${role} un message signalé. ${r.reason}`;
        await this.db.insert(parentalAlerts).values({
          minorAccountId: acc.id,
          guardianEmail: g.email,
          incidentId: null,
          severity: r.severity,
          reason,
          humanValidated: true, // alerte immédiate (décision produit) — voir doc 26 §7.3
          sentAt: new Date(),
        });
        // Email réel immédiat au parent (serveur mail dédié Dowze).
        void this.email.send({
          to: g.email,
          subject: `Dowze — alerte de sécurité concernant ${await this.nameOf(p.profileId)}`,
          text: `${reason}\n\nRetrouvez le détail dans votre Espace responsable : https://academie.dowze.ch/parent\n\n— L'équipe Dowze (modération)`,
        });
      }
    } catch (e) {
      this.logger.warn(`scanMessage a échoué: ${e instanceof Error ? e.message : e}`);
    }
  }

  private async nameOf(profileId: string): Promise<string> {
    const p = (await this.db.select().from(profiles).where(eq(profiles.id, profileId)))[0];
    return p?.displayName ?? '';
  }

  private async accountOf(profileId: string): Promise<{ id: string; isMinor: boolean } | null> {
    const p = (await this.db.select().from(profiles).where(eq(profiles.id, profileId)))[0];
    if (!p) return null;
    const a = (await this.db.select().from(accounts).where(eq(accounts.id, p.accountId)))[0];
    return a ? { id: a.id, isMinor: a.isMinor } : null;
  }
}
