import { Module } from '@nestjs/common';
import { CopiloteModule } from '../copilote/copilote.module';
import { GuidedExpeditionsService } from './guided-expeditions.service';
import { GuidedExpeditionsController } from './guided-expeditions.controller';

// Le catalogue global d'expéditions (ancien ExpeditionsController/Service) a été retiré :
// remplacé par les expéditions guidées PAR ÉLÈVE (/expeditions/guided/*).
@Module({
  imports: [CopiloteModule],
  providers: [GuidedExpeditionsService],
  controllers: [GuidedExpeditionsController],
})
export class ExpeditionsModule {}
