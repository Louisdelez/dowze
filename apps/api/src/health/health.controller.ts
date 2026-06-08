import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  @Get()
  check(): { status: 'ok'; service: string; version: string } {
    return { status: 'ok', service: 'dowze-api', version: '2.22.0' };
  }
}
