import { Module } from '@nestjs/common';
import { ExercisesModule } from '../exercises/exercises.module';
import { FsrsModule } from '../fsrs/fsrs.module';
import { XpModule } from '../xp/xp.module';
import { TestsController } from './tests.controller';
import { TestsService } from './tests.service';

@Module({
  imports: [ExercisesModule, FsrsModule, XpModule],
  controllers: [TestsController],
  providers: [TestsService],
})
export class TestsModule {}
