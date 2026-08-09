import { Module } from '@nestjs/common';
import { SkillGraphModule } from '../skill-graph/skill-graph.module';
import { ProgressionModule } from '../progression/progression.module';
import { CopiloteModule } from '../copilote/copilote.module';
import { SkillGenerationService } from './skill-generation.service';
import { SkillGenerationController } from './skill-generation.controller';

@Module({
  imports: [SkillGraphModule, ProgressionModule, CopiloteModule],
  providers: [SkillGenerationService],
  controllers: [SkillGenerationController],
  exports: [SkillGenerationService],
})
export class SkillGenerationModule {}
