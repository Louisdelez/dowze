import { Module } from '@nestjs/common';
import { CopiloteModule } from '../copilote/copilote.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { LanguagesController } from './languages.controller';
import { LanguagesService } from './languages.service';

@Module({
  imports: [CopiloteModule, RealtimeModule],
  controllers: [LanguagesController],
  providers: [LanguagesService],
})
export class LanguagesModule {}
