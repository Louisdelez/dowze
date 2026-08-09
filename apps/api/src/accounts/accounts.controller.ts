import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { z } from 'zod';
import { parseOr400 } from '../common/validate-body';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { AccountsService } from './accounts.service';
import { onboardingErrors, isMinorFromBirthDate } from './onboarding-rules';

const registerBody = z.object({
  email: z.string().email(),
  isMinor: z.boolean().default(false),
  displayName: z.string().min(1).max(80),
  locale: z.string().min(2),
  timezone: z.string().min(1),
  birthDate: z.string().date().nullable().default(null),
  guardianEmail: z.string().email().nullable().default(null),
  authUserId: z.string().uuid().nullable().default(null),
});

const updateProfileBody = z
  .object({
    displayName: z.string().min(1).max(80).optional(),
    birthDate: z.string().date().nullable().optional(),
    photoUrl: z.string().url().max(2000).nullable().optional(),
    // Compagnon perso : la planche peut être une URL absolue (n'importe quel site) ou un
    // chemin relatif auto-hébergé (`/pets/…`) — on accepte une chaîne bornée, non une URL stricte.
    companion: z
      .object({
        url: z.string().max(2000).nullable().optional(),
        size: z.number().int().min(40).max(400).optional(),
        hidden: z.boolean().optional(),
        camMode: z.boolean().optional(),
        world: z.string().max(40).optional(),
        camSize: z.number().int().min(120).max(600).optional(),
        name: z.string().max(40).optional(),
      })
      .strict()
      .nullable()
      .optional(),
  })
  .strict();

interface AuthedRequest {
  accountAuthId?: string;
}

@Controller('accounts')
export class AccountsController {
  constructor(private readonly service: AccountsService) {}

  @Post()
  register(@Body() body: unknown) {
    const parsed = parseOr400(registerBody, body);
    const nowIso = new Date().toISOString();
    // Le statut « mineur » se déduit de la date de naissance (plus de case à cocher).
    const isMinor = parsed.birthDate
      ? isMinorFromBirthDate(parsed.birthDate, nowIso)
      : parsed.isMinor;
    const input = { ...parsed, isMinor };
    const errors = onboardingErrors(input, nowIso);
    if (errors.length > 0) throw new BadRequestException(errors);
    return this.service.register(input);
  }

  /** Compte + profil de l'utilisateur authentifié (hydrate la session, page profil). */
  @Get('me')
  @UseGuards(SupabaseAuthGuard)
  async me(@Req() req: AuthedRequest) {
    if (!req.accountAuthId) throw new UnauthorizedException('non authentifié');
    const me = await this.service.meFromAuthId(req.accountAuthId);
    if (!me) throw new NotFoundException('compte introuvable');
    return me;
  }

  /** Mise à jour du profil (pseudo, date de naissance, photo) de l'utilisateur authentifié. */
  @Patch('me/profile')
  @UseGuards(SupabaseAuthGuard)
  async updateMyProfile(@Req() req: AuthedRequest, @Body() body: unknown) {
    if (!req.accountAuthId) throw new UnauthorizedException('non authentifié');
    const patch = parseOr400(updateProfileBody, body);
    const updated = await this.service.updateProfileForAuthId(req.accountAuthId, patch);
    if (!updated) throw new NotFoundException('profil introuvable');
    return updated;
  }

  /** Les enfants/comptes liés supervisés par le parent authentifié (auto-liaison). */
  @Get('me/children')
  @UseGuards(SupabaseAuthGuard)
  async myChildren(@Req() req: AuthedRequest) {
    if (!req.accountAuthId) throw new UnauthorizedException('non authentifié');
    const me = await this.service.meFromAuthId(req.accountAuthId);
    if (!me) throw new NotFoundException('compte introuvable');
    return this.service.childrenForGuardian(me.account.id);
  }

  /** Le parent valide le compte d'un enfant < 13 (double confirmation → active le compte). */
  @Post('me/confirm-child/:childAccountId')
  @UseGuards(SupabaseAuthGuard)
  async confirmChild(@Req() req: AuthedRequest, @Param('childAccountId') childAccountId: string) {
    if (!req.accountAuthId) throw new UnauthorizedException('non authentifié');
    const me = await this.service.meFromAuthId(req.accountAuthId);
    if (!me) throw new NotFoundException('compte introuvable');
    return this.service.confirmChild(me.account.id, z.string().uuid().parse(childAccountId));
  }

  @Get(':id/profile')
  @UseGuards(SupabaseAuthGuard)
  profile(@Param('id') id: string) {
    return this.service.profileForAccount(id);
  }
}
