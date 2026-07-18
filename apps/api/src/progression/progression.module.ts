import { Module } from '@nestjs/common';
import { ProgressionService } from './progression.service';
import { ProgressionController } from './progression.controller';
import { SkillGraphModule } from '../skill-graph/skill-graph.module';

@Module({
  imports: [SkillGraphModule],
  providers: [ProgressionService],
  controllers: [ProgressionController],
  exports: [ProgressionService],
})
export class ProgressionModule {}
