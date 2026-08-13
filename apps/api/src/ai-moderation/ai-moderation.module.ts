import { Module } from '@nestjs/common';
import { AiModerationService } from './ai-moderation.service';

@Module({
  providers: [AiModerationService],
  exports: [AiModerationService],
})
export class AiModerationModule {}
