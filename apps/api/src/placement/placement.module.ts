import { Module } from '@nestjs/common';
import { SkillGraphModule } from '../skill-graph/skill-graph.module';
import { CopiloteModule } from '../copilote/copilote.module';
import { PlacementController } from './placement.controller';
import { PlacementService } from './placement.service';

@Module({
  imports: [SkillGraphModule, CopiloteModule],
  controllers: [PlacementController],
  providers: [PlacementService],
})
export class PlacementModule {}
