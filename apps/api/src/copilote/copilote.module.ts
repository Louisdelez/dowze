import { Module } from '@nestjs/common';
import { ProgressionModule } from '../progression/progression.module';
import { CarnetModule } from '../carnet/carnet.module';
import { FsrsModule } from '../fsrs/fsrs.module';
import { CopiloteService } from './copilote.service';
import { CreditsService } from './credits.service';
import { CopiloteController } from './copilote.controller';

@Module({
  imports: [ProgressionModule, CarnetModule, FsrsModule],
  providers: [CopiloteService, CreditsService],
  controllers: [CopiloteController],
  exports: [CopiloteService, CreditsService],
})
export class CopiloteModule {}
