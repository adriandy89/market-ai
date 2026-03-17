import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { AiModule } from '../ai/ai.module';
import { ScheduledReportsController } from './scheduled-reports.controller';
import { ScheduledReportsService } from './scheduled-reports.service';
import { ScheduledReportsScheduler } from './scheduled-reports.scheduler';
import { ScheduledReportsProcessor } from './scheduled-reports.processor';
import { SCHEDULED_REPORTS_QUEUE } from './constants';

@Module({
  imports: [
    BullModule.registerQueue({ name: SCHEDULED_REPORTS_QUEUE }),
    AiModule,
  ],
  controllers: [ScheduledReportsController],
  providers: [
    ScheduledReportsService,
    ScheduledReportsScheduler,
    ScheduledReportsProcessor,
  ],
})
export class ScheduledReportsModule {}
