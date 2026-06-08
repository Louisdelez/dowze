import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { DB, type Database } from '../db/drizzle.module';
import { classes, memberships, channels, messages } from '../db/schema';

export interface CreateClasseInput {
  slug: string;
  name: string;
  locale: string;
  timezone: string;
  type: string;
}

@Injectable()
export class CommunityService {
  constructor(@Inject(DB) private readonly db: Database) {}

  listClasses() {
    return this.db.select().from(classes);
  }

  /** Crée une classe et son canal de discussion. */
  async createClasse(input: CreateClasseInput) {
    const inserted = await this.db.insert(classes).values(input).returning();
    const classe = inserted[0];
    if (!classe) throw new Error('échec de création de la classe');
    await this.db.insert(channels).values({ kind: 'classe', classeId: classe.id });
    return classe;
  }

  async join(classeId: string, profileId: string) {
    await this.db
      .insert(memberships)
      .values({ classeId, profileId })
      .onConflictDoNothing();
    return { ok: true as const };
  }

  /** Le canal 'classe' d'une classe. */
  private async classeChannelId(classeId: string): Promise<string> {
    const rows = await this.db
      .select()
      .from(channels)
      .where(and(eq(channels.classeId, classeId), eq(channels.kind, 'classe')));
    const channel = rows[0];
    if (!channel) throw new NotFoundException(`canal introuvable pour la classe ${classeId}`);
    return channel.id;
  }

  async listClasseMessages(classeId: string) {
    const channelId = await this.classeChannelId(classeId);
    return this.db.select().from(messages).where(eq(messages.channelId, channelId));
  }

  async postClasseMessage(classeId: string, authorId: string, body: string) {
    const channelId = await this.classeChannelId(classeId);
    const inserted = await this.db
      .insert(messages)
      .values({ channelId, authorId, body })
      .returning();
    return inserted[0];
  }
}
