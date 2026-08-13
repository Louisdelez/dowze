import { Module } from '@nestjs/common';
import { SkillGraphModule } from '../skill-graph/skill-graph.module';
import { ProgressionModule } from '../progression/progression.module';
import { ResultsController } from './results.controller';
import { ResultsService } from './results.service';

@Module({
  imports: [SkillGraphModule, ProgressionModule],
  controllers: [ResultsController],
  providers: [ResultsService],
})
export class ResultsModule {}
