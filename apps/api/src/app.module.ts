import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { AccountThrottlerGuard } from './common/account-throttler.guard';
import { ConfigModule } from './config/config.module';
import { DrizzleModule } from './db/drizzle.module';
import { AuthModule } from './auth/auth.module';
import { CacheModule } from './cache/cache.module';
import { JobsModule } from './jobs/jobs.module';
import { AccountsModule } from './accounts/accounts.module';
import { OnboardingModule } from './onboarding/onboarding.module';
import { PlacementModule } from './placement/placement.module';
import { ExercisesModule } from './exercises/exercises.module';
import { TestsModule } from './tests/tests.module';
import { ResultsModule } from './results/results.module';
import { RankJumpModule } from './rank-jump/rank-jump.module';
import { SpecializationModule } from './specialization/specialization.module';
import { XpModule } from './xp/xp.module';
import { ExpeditionsModule } from './expeditions/expeditions.module';
import { CarnetModule } from './carnet/carnet.module';
import { SkillGraphModule } from './skill-graph/skill-graph.module';
import { BridgeModule } from './bridge/bridge.module';
import { CopiloteModule } from './copilote/copilote.module';
import { ProgressionModule } from './progression/progression.module';
import { SkillGenerationModule } from './skill-generation/skill-generation.module';
import { SpacedRepetitionModule } from './spaced-repetition/spaced-repetition.module';
import { PlanningModule } from './planning/planning.module';
import { ValidationModule } from './validation/validation.module';
import { CommunityModule } from './community/community.module';
import { ParentalModule } from './parental/parental.module';
import { ModerationModule } from './moderation/moderation.module';
import { SocialModule } from './social/social.module';
import { ProtectionsModule } from './protections/protections.module';
import { ClassesModule } from './classes/classes.module';
import { TranslationModule } from './translation/translation.module';
import { LanguagesModule } from './languages/languages.module';
import { ElectivesModule } from './electives/electives.module';
import { ScheduleModule } from './schedule/schedule.module';
import { RealtimeModule } from './realtime/realtime.module';
import { EmailModule } from './email/email.module';
import { HealthModule } from './health/health.module';
import { PluginsModule } from './plugins/plugins.module';
import { CompanionModule } from './companion/companion.module';
import { CalendarModule } from './calendar/calendar.module';
import { PluginAiModule } from './plugin-ai/plugin-ai.module';

@Module({
  imports: [
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    ConfigModule,
    DrizzleModule,
    AuthModule,
    CacheModule,
    JobsModule,
    AccountsModule,
    OnboardingModule,
    PlacementModule,
    ExercisesModule,
    TestsModule,
    ResultsModule,
    RankJumpModule,
    SpecializationModule,
    XpModule,
    ExpeditionsModule,
    CarnetModule,
    SkillGraphModule,
    BridgeModule,
    CopiloteModule,
    ProgressionModule,
    SkillGenerationModule,
    SpacedRepetitionModule,
    PlanningModule,
    ValidationModule,
    CommunityModule,
    ParentalModule,
    ModerationModule,
    SocialModule,
    ProtectionsModule,
    ClassesModule,
    TranslationModule,
    LanguagesModule,
    ElectivesModule,
    ScheduleModule,
    RealtimeModule,
    EmailModule,
    HealthModule,
    PluginsModule,
    CompanionModule,
    CalendarModule,
    PluginAiModule,
  ],
  // Throttling par COMPTE (jeton présent) avec repli IP — audit 08-2026.
  providers: [{ provide: APP_GUARD, useClass: AccountThrottlerGuard }],
})
export class AppModule {}
