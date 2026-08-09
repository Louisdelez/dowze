import { Module } from '@nestjs/common';
import { SkillGraphModule } from '../skill-graph/skill-graph.module';
import { ProgressionModule } from '../progression/progression.module';
import { CopiloteModule } from '../copilote/copilote.module';
import { SpecializationController } from './specialization.controller';
import { SpecializationService } from './specialization.service';

@Module({
  imports: [SkillGraphModule, ProgressionModule, CopiloteModule],
  controllers: [SpecializationController],
  providers: [SpecializationService],
})
export class SpecializationModule {}
