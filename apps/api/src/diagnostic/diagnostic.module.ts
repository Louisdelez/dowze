import { Module } from '@nestjs/common';
import { SkillGraphModule } from '../skill-graph/skill-graph.module';
import { DiagnosticService } from './diagnostic.service';
import { DiagnosticController } from './diagnostic.controller';

@Module({
  imports: [SkillGraphModule],
  providers: [DiagnosticService],
  controllers: [DiagnosticController],
  exports: [DiagnosticService],
})
export class DiagnosticModule {}
