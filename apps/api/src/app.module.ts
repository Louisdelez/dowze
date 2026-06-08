import { Module } from '@nestjs/common';
import { ConfigModule } from './config/config.module';
import { DrizzleModule } from './db/drizzle.module';
import { SkillGraphModule } from './skill-graph/skill-graph.module';
import { BridgeModule } from './bridge/bridge.module';
import { ProgressionModule } from './progression/progression.module';
import { SpacedRepetitionModule } from './spaced-repetition/spaced-repetition.module';
import { PlanningModule } from './planning/planning.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    ConfigModule,
    DrizzleModule,
    SkillGraphModule,
    BridgeModule,
    ProgressionModule,
    SpacedRepetitionModule,
    PlanningModule,
    HealthModule,
  ],
})
export class AppModule {}
