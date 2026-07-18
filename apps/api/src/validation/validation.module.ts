import { Module } from '@nestjs/common';
import { ValidationService } from './validation.service';
import { ValidationController } from './validation.controller';
import { ProgressionModule } from '../progression/progression.module';

@Module({
  imports: [ProgressionModule],
  providers: [ValidationService],
  controllers: [ValidationController],
  exports: [ValidationService],
})
export class ValidationModule {}
