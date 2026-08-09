import { Module } from '@nestjs/common';
import { CopiloteModule } from '../copilote/copilote.module';
import { TranslationService } from './translation.service';
import { TranslationController } from './translation.controller';

@Module({
  imports: [CopiloteModule],
  providers: [TranslationService],
  controllers: [TranslationController],
  exports: [TranslationService],
})
export class TranslationModule {}
