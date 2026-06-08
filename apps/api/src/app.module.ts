import { Module } from '@nestjs/common';
import { ConfigModule } from './config/config.module';
import { DrizzleModule } from './db/drizzle.module';
import { SkillGraphModule } from './skill-graph/skill-graph.module';
import { BridgeModule } from './bridge/bridge.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [ConfigModule, DrizzleModule, SkillGraphModule, BridgeModule, HealthModule],
})
export class AppModule {}
