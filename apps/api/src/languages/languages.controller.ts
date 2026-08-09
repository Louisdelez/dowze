import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { z } from 'zod';
import { parseOr400 } from '../common/validate-body';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { LanguagesService } from './languages.service';

const uuid = z.string().uuid();
const langBody = z.object({ lang: z.string().min(2).max(8) });
const ingestBody = z.object({
  lang: z.string().min(2).max(8),
  summary: z.string().min(1).max(12000),
});
const botBody = z.object({
  conversationId: z.string().uuid(),
  lang: z.string().min(2).max(8),
  userText: z.string().min(1).max(2000),
});
const courseCloseBody = z.object({
  lang: z.string().min(2).max(8),
  outcome: z.enum(['solide', 'progres', 'faible']),
});

@Controller('languages')
@UseGuards(SupabaseAuthGuard)
export class LanguagesController {
  constructor(private readonly service: LanguagesService) {}

  @Get(':profileId')
  view(@Param('profileId') profileId: string) {
    return this.service.view(uuid.parse(profileId));
  }

  /** Choisit une langue (100 % libre) — l'ancienne active passe en maintenance. */
  @Post(':profileId/choose')
  choose(@Param('profileId') profileId: string, @Body() body: unknown) {
    const { lang } = parseOr400(langBody, body);
    return this.service.choose(uuid.parse(profileId), lang);
  }

  /** Compose le prompt LISIBLE du jour (à coller dans SON IA — ChatGPT/Claude). Déterministe, gratuit. */
  @Post(':profileId/session/compose')
  compose(@Param('profileId') profileId: string, @Body() body: unknown) {
    const { lang } = parseOr400(langBody, body);
    return this.service.compose(uuid.parse(profileId), lang);
  }

  /** Ingère le résumé texte de la séance → l'IA de Dowze le structure, Dowze met à jour le niveau. */
  @Post(':profileId/session/ingest')
  @Throttle({ default: { ttl: 60_000, limit: 10 } }) // coûteux (LLM)
  ingest(@Param('profileId') profileId: string, @Body() body: unknown) {
    const { lang, summary } = parseOr400(ingestBody, body);
    return this.service.ingest(uuid.parse(profileId), lang, summary);
  }

  /** Cours de langue NATIF (AUTO) : l'IA de Dowze génère la feuille A4 (rendue en app). */
  @Post(':profileId/course')
  @Throttle({ default: { ttl: 60_000, limit: 6 } }) // coûteux (LLM)
  course(@Param('profileId') profileId: string, @Body() body: unknown) {
    const { lang } = parseOr400(langBody, body);
    return this.service.runLanguageCourse(uuid.parse(profileId), lang);
  }

  /** Clôture du cours natif de langue : l'app a dérivé l'outcome → Dowze recalcule le niveau. */
  @Post(':profileId/course/close')
  closeCourse(@Param('profileId') profileId: string, @Body() body: unknown) {
    const { lang, outcome } = parseOr400(courseCloseBody, body);
    return this.service.applyLanguageProgress(uuid.parse(profileId), lang, outcome);
  }

  /** Bot « Dowze » de conversation (invoqué avec `/` dans le salon de classe de langue). */
  @Post(':profileId/chatbot')
  chatbot(@Param('profileId') profileId: string, @Body() body: unknown) {
    const { conversationId, lang, userText } = parseOr400(botBody, body);
    return this.service.chatbot(uuid.parse(profileId), conversationId, lang, userText);
  }

  /** Les classes de langue (canal « langue cible only »). */
  @Get(':profileId/classes')
  classes(@Param('profileId') profileId: string) {
    return this.service.myLanguageClasses(uuid.parse(profileId));
  }
}
