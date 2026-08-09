import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { dossierSchema, presentationInputSchema } from '@dowze/schemas';
import { parseOr400 } from '../common/validate-body';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { OnboardingService } from './onboarding.service';

const uuid = z.string().uuid();

const updateDossierBody = z
  .object({
    profileId: z.string().uuid(),
    structured: dossierSchema,
    validated: z.boolean().default(true),
  })
  .strict();

@Controller('onboarding')
@UseGuards(SupabaseAuthGuard)
export class OnboardingController {
  constructor(private readonly service: OnboardingService) {}

  /** Présentation libre → dossier élève (IA), stocké non validé. */
  @Post('presentation')
  presentation(@Body() body: unknown) {
    return this.service.generate(parseOr400(presentationInputSchema, body));
  }

  /** Dossier stocké de l'élève (pour affichage/validation). */
  @Get('dossier/:profileId')
  dossier(@Param('profileId') profileId: string) {
    return this.service.get(uuid.parse(profileId));
  }

  /** L'élève valide/corrige son dossier. */
  @Patch('dossier')
  update(@Body() body: unknown) {
    const { profileId, structured, validated } = parseOr400(updateDossierBody, body);
    return this.service.update(profileId, structured, validated);
  }
}
