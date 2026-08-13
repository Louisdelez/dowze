import { Controller, Get } from '@nestjs/common';
import { EmailService } from '../email/email.service';

@Controller('health')
export class HealthController {
  constructor(private readonly email: EmailService) {}

  @Get()
  check(): { status: 'ok'; service: string; version: string; email: boolean } {
    return { status: 'ok', service: 'dowze-api', version: '2.22.0', email: this.email.enabled };
  }
}
