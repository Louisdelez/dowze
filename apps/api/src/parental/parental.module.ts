import { Module } from '@nestjs/common';
import { ParentalService } from './parental.service';
import { ParentalController } from './parental.controller';

@Module({
  providers: [ParentalService],
  controllers: [ParentalController],
  exports: [ParentalService],
})
export class ParentalModule {}
