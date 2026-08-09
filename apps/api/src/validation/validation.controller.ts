import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { peerReviewInputSchema } from '@dowze/schemas';
import { parseOr400 } from '../common/validate-body';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { ValidationService } from './validation.service';

const uuid = z.string().uuid();
const createBody = z.object({
  title: z.string().min(1).max(160),
  description: z.string().max(2000).default(''),
  evidenceUrl: z.string().url().nullable().default(null),
  format: z.enum(['visio', 'video']).default('visio'),
});

@Controller('validation')
@UseGuards(SupabaseAuthGuard)
export class ValidationController {
  constructor(private readonly service: ValidationService) {}

  /** Mes sujets + sujets à évaluer + éligibilité + badges. */
  @Get(':profileId')
  view(@Param('profileId') profileId: string) {
    return this.service.view(uuid.parse(profileId));
  }

  /** Créer un sujet à valider (titre + description). */
  @Post(':profileId/subject')
  create(@Param('profileId') profileId: string, @Body() body: unknown) {
    const input = parseOr400(createBody, body);
    return this.service.createSubject(uuid.parse(profileId), input);
  }

  /** Évaluer le sujet d'un pair (validé + étoiles + commentaire). */
  @Post(':profileId/review/:subjectId')
  review(
    @Param('profileId') profileId: string,
    @Param('subjectId') subjectId: string,
    @Body() body: unknown,
  ) {
    const input = parseOr400(peerReviewInputSchema, body);
    return this.service.review(uuid.parse(profileId), uuid.parse(subjectId), input);
  }

  /** Page communautaire : tous les sujets à évaluer, avec recherche + tri. */
  @Get(':profileId/community')
  community(
    @Param('profileId') profileId: string,
    @Query('q') q = '',
    @Query('sort') sort = 'recent',
  ) {
    return this.service.community(uuid.parse(profileId), q, sort === 'level' ? 'level' : 'recent');
  }

  /** Un sujet précis (lien de partage). */
  @Get(':profileId/subject/:subjectId')
  subject(@Param('profileId') profileId: string, @Param('subjectId') subjectId: string) {
    return this.service.getSubject(uuid.parse(profileId), uuid.parse(subjectId));
  }

  // Pas d'endpoint « devenir prof/modo/staff » : les rôles staff sont attribués manuellement
  // (au cas par cas), jamais via l'application (décision produit). Le statut prof agréé, quand il est
  // accordé manuellement (accounts.is_teacher = true), continue de valider un sujet en une fois.
}
