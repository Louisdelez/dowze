import { Module } from '@nestjs/common';
import { CopiloteModule } from '../copilote/copilote.module';
import { CompanionService } from './companion.service';
import { PetCareService } from './pet-care.service';
import { CompanionController } from './companion.controller';
import { HiveScheduler } from './hive-scheduler.service';
import { HiveContinuityService } from './hive-continuity.service';
import { VoiceService } from './voice.service';

@Module({
  imports: [CopiloteModule],
  providers: [CompanionService, PetCareService, HiveScheduler, HiveContinuityService, VoiceService],
  controllers: [CompanionController],
})
export class CompanionModule {}
