import { Module } from '@nestjs/common';
import { SkillGraphModule } from '../skill-graph/skill-graph.module';
import { PlanningService } from './planning.service';
import { PlanningController } from './planning.controller';

@Module({
  imports: [SkillGraphModule],
  providers: [PlanningService],
  controllers: [PlanningController],
  exports: [PlanningService],
})
export class PlanningModule {}
