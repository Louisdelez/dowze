import { Module } from '@nestjs/common';
import { SocialService } from './social.service';
import { SocialController } from './social.controller';
import { XpModule } from '../xp/xp.module';
import { AiModerationModule } from '../ai-moderation/ai-moderation.module';
import { RealtimeModule } from '../realtime/realtime.module';

@Module({
  imports: [XpModule, AiModerationModule, RealtimeModule],
  providers: [SocialService],
  controllers: [SocialController],
  exports: [SocialService],
})
export class SocialModule {}
