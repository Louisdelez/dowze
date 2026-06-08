import { Module } from '@nestjs/common';
import { ConfigModule } from './config/config.module';
import { DrizzleModule } from './db/drizzle.module';
import { SkillGraphModule } from './skill-graph/skill-graph.module';
import { BridgeModule } from './bridge/bridge.module';
import { ProgressionModule } from './progression/progression.module';
import { SpacedRepetitionModule } from './spaced-repetition/spaced-repetition.module';
import { PlanningModule } from './planning/planning.module';
import { ValidationModule } from './validation/validation.module';
import { CommunityModule } from './community/community.module';
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
    ValidationModule,
    CommunityModule,
    HealthModule,
  ],
})
export class AppModule {}
