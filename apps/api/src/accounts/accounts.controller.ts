import { BadRequestException, Body, Controller, Get, Param, Post } from '@nestjs/common';
import { z } from 'zod';
import { parseOr400 } from '../common/validate-body';
import { AccountsService } from './accounts.service';
import { onboardingErrors } from './onboarding-rules';

const registerBody = z.object({
  email: z.string().email(),
  isMinor: z.boolean().default(false),
  displayName: z.string().min(1).max(80),
  locale: z.string().min(2),
  timezone: z.string().min(1),
  guardianEmail: z.string().email().nullable().default(null),
  authUserId: z.string().uuid().nullable().default(null),
});

@Controller('accounts')
export class AccountsController {
  constructor(private readonly service: AccountsService) {}

  @Post()
  register(@Body() body: unknown) {
    const input = parseOr400(registerBody, body);
    const errors = onboardingErrors(input);
    if (errors.length > 0) throw new BadRequestException(errors);
    return this.service.register(input);
  }

  @Get(':id/profile')
  profile(@Param('id') id: string) {
    return this.service.profileForAccount(id);
  }
}
