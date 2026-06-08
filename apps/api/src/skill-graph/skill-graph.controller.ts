import { Controller, Get, Param } from '@nestjs/common';
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
}
