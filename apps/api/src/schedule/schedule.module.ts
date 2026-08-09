import { Module } from '@nestjs/common';
import { ProgressionModule } from '../progression/progression.module';
import { FsrsModule } from '../fsrs/fsrs.module';
import { CalendarModule } from '../calendar/calendar.module';
import { ScheduleController } from './schedule.controller';
import { ScheduleService } from './schedule.service';

@Module({
  imports: [ProgressionModule, FsrsModule, CalendarModule],
  controllers: [ScheduleController],
  providers: [ScheduleService],
})
export class ScheduleModule {}
