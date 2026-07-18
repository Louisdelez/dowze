import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ossaturePayloadSchema } from '@dowze/schemas';
import { parseOr400 } from '../common/validate-body';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { SkillGraphService } from './skill-graph.service';

@Controller('skills')
export class SkillGraphController {
  constructor(private readonly service: SkillGraphService) {}

  @Get()
  list() {
    return this.service.loadGraph();
  }

  @Get('validate')
  validate() {
    return this.service.validate();
  }

  @Get(':id/closure')
  closure(@Param('id') id: string) {
    return this.service.closure(id);
  }

  /**
   * Ingestion d'une ossature générée (école générative). Le corps est un payload
   * `generer-ossature` déjà validé par le pont ; on le re-valide par clôture.
   */
  @Post('ingest')
  @UseGuards(SupabaseAuthGuard)
  ingest(@Body() body: unknown) {
    const payload = parseOr400(ossaturePayloadSchema, body);
    return this.service.ingest(payload.skills);
  }
}
