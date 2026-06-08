import { Module } from '@nestjs/common';
import { GenerationService } from './generation.service';
import { ImportService } from './import.service';
import { BridgeController } from './bridge.controller';

@Module({
  providers: [GenerationService, ImportService],
  controllers: [BridgeController],
  exports: [GenerationService, ImportService],
})
export class BridgeModule {}
