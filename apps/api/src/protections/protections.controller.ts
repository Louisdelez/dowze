import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { parseOr400 } from '../common/validate-body';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { ProtectionsService } from './protections.service';

const uuid = z.string().uuid();
const scopeSchema = z.enum(['messages', 'account']);

@Controller('protections')
@UseGuards(SupabaseAuthGuard)
export class ProtectionsController {
  constructor(private readonly service: ProtectionsService) {}

  // ---- Modérateur ----
  @Get('moderator/:profileId/queue')
  queue(@Param('profileId') profileId: string) {
    return this.service.moderatorQueue(uuid.parse(profileId));
  }

  @Post('moderator/:profileId/report/:reportId/resolve')
  resolveReport(@Param('profileId') profileId: string, @Param('reportId') reportId: string) {
    return this.service.resolveReport(uuid.parse(profileId), uuid.parse(reportId));
  }

  @Post('moderator/:profileId/reset/:resetId/decide')
  decideReset(
    @Param('profileId') profileId: string,
    @Param('resetId') resetId: string,
    @Body() body: unknown,
  ) {
    const { approve } = parseOr400(z.object({ approve: z.boolean() }), body);
    return this.service.moderatorDecideReset(uuid.parse(profileId), uuid.parse(resetId), approve);
  }

  @Post('moderator/:profileId/ai-flag/:flagId/resolve')
  resolveAiFlag(@Param('profileId') profileId: string, @Param('flagId') flagId: string) {
    return this.service.resolveAiFlag(uuid.parse(profileId), uuid.parse(flagId));
  }

  // ---- Élève : demande de remise à 0 ----
  @Post('reset/:profileId/request')
  requestReset(@Param('profileId') profileId: string, @Body() body: unknown) {
    const { scope } = parseOr400(z.object({ scope: scopeSchema.default('messages') }), body);
    return this.service.requestReset(uuid.parse(profileId), scope);
  }

  // ---- Parent (Espace responsable, clé = code élève = childAccountId) ----
  @Get('parent/:childAccountId/controls')
  controls(@Param('childAccountId') childAccountId: string) {
    return this.service.guardianControls(uuid.parse(childAccountId));
  }

  @Post('parent/:childAccountId/supervised')
  setSupervised(@Param('childAccountId') childAccountId: string, @Body() body: unknown) {
    const { on, guardianEmail } = parseOr400(
      z.object({ on: z.boolean(), guardianEmail: z.string().default('') }),
      body,
    );
    return this.service.setSupervised(uuid.parse(childAccountId), on, guardianEmail);
  }

  @Post('parent/:childAccountId/supervision/:itemId/decide')
  resolveSupervision(
    @Param('childAccountId') childAccountId: string,
    @Param('itemId') itemId: string,
    @Body() body: unknown,
  ) {
    const { approve } = parseOr400(z.object({ approve: z.boolean() }), body);
    return this.service.resolveSupervision(uuid.parse(childAccountId), uuid.parse(itemId), approve);
  }

  @Post('parent/:childAccountId/child-reset/:resetId/decide')
  decideChildReset(
    @Param('childAccountId') childAccountId: string,
    @Param('resetId') resetId: string,
    @Body() body: unknown,
  ) {
    const { approve } = parseOr400(z.object({ approve: z.boolean() }), body);
    return this.service.parentDecideChildReset(
      uuid.parse(childAccountId),
      uuid.parse(resetId),
      approve,
    );
  }

  @Post('parent/:childAccountId/reset')
  parentReset(@Param('childAccountId') childAccountId: string, @Body() body: unknown) {
    const { scope, guardianEmail } = parseOr400(
      z.object({ scope: scopeSchema.default('messages'), guardianEmail: z.string().default('') }),
      body,
    );
    return this.service.parentCreateReset(uuid.parse(childAccountId), scope, guardianEmail);
  }
}
