import { Module } from '@nestjs/common';
import { ConfigModule } from './config/config.module';
import { DrizzleModule } from './db/drizzle.module';
import { AuthModule } from './auth/auth.module';
import { AccountsModule } from './accounts/accounts.module';
import { DiagnosticModule } from './diagnostic/diagnostic.module';
import { ExpeditionsModule } from './expeditions/expeditions.module';
import { CarnetModule } from './carnet/carnet.module';
import { SkillGraphModule } from './skill-graph/skill-graph.module';
import { BridgeModule } from './bridge/bridge.module';
import { ProgressionModule } from './progression/progression.module';
import { SpacedRepetitionModule } from './spaced-repetition/spaced-repetition.module';
import { PlanningModule } from './planning/planning.module';
import { ValidationModule } from './validation/validation.module';
import { CommunityModule } from './community/community.module';
import { ParentalModule } from './parental/parental.module';
import { ModerationModule } from './moderation/moderation.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    ConfigModule,
    DrizzleModule,
    AuthModule,
    AccountsModule,
    DiagnosticModule,
    ExpeditionsModule,
    CarnetModule,
    SkillGraphModule,
    BridgeModule,
    ProgressionModule,
    SpacedRepetitionModule,
    PlanningModule,
    ValidationModule,
    CommunityModule,
    ParentalModule,
    ModerationModule,
    HealthModule,
  ],
})
export class AppModule {}
