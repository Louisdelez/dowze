import { Module } from '@nestjs/common';
import { ExpeditionsService } from './expeditions.service';
import { ExpeditionsController } from './expeditions.controller';

@Module({
  providers: [ExpeditionsService],
  controllers: [ExpeditionsController],
  exports: [ExpeditionsService],
})
export class ExpeditionsModule {}
