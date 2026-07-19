import { Module } from '@nestjs/common';
import { ProgressionModule } from '../progression/progression.module';
import { CarnetModule } from '../carnet/carnet.module';
import { CopiloteService } from './copilote.service';
import { CreditsService } from './credits.service';
import { CopiloteController } from './copilote.controller';

@Module({
  imports: [ProgressionModule, CarnetModule],
  providers: [CopiloteService, CreditsService],
  controllers: [CopiloteController],
  exports: [CopiloteService, CreditsService],
})
export class CopiloteModule {}
