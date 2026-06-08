import { Module } from '@nestjs/common';
import { SkillGraphService } from './skill-graph.service';
import { SkillGraphController } from './skill-graph.controller';

@Module({
  providers: [SkillGraphService],
  controllers: [SkillGraphController],
  exports: [SkillGraphService],
})
export class SkillGraphModule {}
