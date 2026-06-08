import { Module } from '@nestjs/common';
import { SpacedRepetitionService } from './spaced-repetition.service';
import { SpacedRepetitionController } from './spaced-repetition.controller';

@Module({
  providers: [SpacedRepetitionService],
  controllers: [SpacedRepetitionController],
  exports: [SpacedRepetitionService],
})
export class SpacedRepetitionModule {}
