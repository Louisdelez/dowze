import { Module } from '@nestjs/common';
import { SkillGraphModule } from '../skill-graph/skill-graph.module';
import { ProgressionModule } from '../progression/progression.module';
import { ExercisesModule } from '../exercises/exercises.module';
import { RankJumpController } from './rank-jump.controller';
import { RankJumpService } from './rank-jump.service';

@Module({
  imports: [SkillGraphModule, ProgressionModule, ExercisesModule],
  controllers: [RankJumpController],
  providers: [RankJumpService],
})
export class RankJumpModule {}
