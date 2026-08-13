import { Module } from '@nestjs/common';
import { CopiloteModule } from '../copilote/copilote.module';
import { ElectivesController } from './electives.controller';
import { ElectivesService } from './electives.service';

@Module({
  imports: [CopiloteModule],
  controllers: [ElectivesController],
  providers: [ElectivesService],
})
export class ElectivesModule {}
