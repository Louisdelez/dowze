import { Module } from '@nestjs/common';
import { SkillGraphModule } from '../skill-graph/skill-graph.module';
import { CarnetService } from './carnet.service';
import { CarnetController } from './carnet.controller';

@Module({
  imports: [SkillGraphModule],
  providers: [CarnetService],
  controllers: [CarnetController],
  exports: [CarnetService],
})
export class CarnetModule {}
