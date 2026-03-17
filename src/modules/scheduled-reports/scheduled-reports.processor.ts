import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { AiService } from '../ai/ai.service';
import { CacheService } from '../../libs/cache/cache.service';
import { SCHEDULED_REPORTS_QUEUE } from './constants';

interface ReportJobData {
  symbol: string;
  language: string;
  userId: string;
  scheduleId: string;
}

@Processor(SCHEDULED_REPORTS_QUEUE, { concurrency: 1 })
export class ScheduledReportsProcessor extends WorkerHost {
  private readonly logger = new Logger(ScheduledReportsProcessor.name);

  constructor(
    private readonly aiService: AiService,
    private readonly cache: CacheService,
  ) {
    super();
  }

  async process(job: Job<ReportJobData>) {
    const { symbol, language, userId, scheduleId } = job.data;
    this.logger.log(`Processing: ${symbol} [${language}]`);

    try {
      await this.aiService.generateComprehensiveReport(userId, symbol, language);
      this.logger.log(`Completed: ${symbol} [${language}]`);
      await this.updateRunStatus(scheduleId, 'completed');
    } catch (error) {
      this.logger.error(`Failed: ${symbol} [${language}]`, error);
      await this.updateRunStatus(scheduleId, 'failed');
      throw error;
    }
  }

  private async updateRunStatus(scheduleId: string, outcome: 'completed' | 'failed') {
    const key = `scheduled-reports:status:${scheduleId}`;
    const status = await this.cache.get<any>(key);
    if (!status) return;

    if (outcome === 'completed') status.completed++;
    else status.failed++;

    if (status.completed + status.failed >= status.total) {
      status.status = status.failed > 0 ? 'completed_with_errors' : 'completed';
      status.finishedAt = new Date().toISOString();
    }

    await this.cache.set(key, status);
  }
}
