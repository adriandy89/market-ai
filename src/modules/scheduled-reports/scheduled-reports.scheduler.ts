import { Injectable, Logger, OnModuleInit, forwardRef, Inject } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { CronJob } from 'cron';
import { DbService } from '../../libs/db/db.service';
import { CacheService } from '../../libs/cache/cache.service';
import { SCHEDULED_REPORTS_QUEUE } from './constants';

const JOB_DELAY_MS = 15_000; // 15s between jobs to respect rate limits

@Injectable()
export class ScheduledReportsScheduler implements OnModuleInit {
  private readonly logger = new Logger(ScheduledReportsScheduler.name);

  constructor(
    private readonly schedulerRegistry: SchedulerRegistry,
    private readonly db: DbService,
    private readonly cache: CacheService,
    @InjectQueue(SCHEDULED_REPORTS_QUEUE) private readonly queue: Queue,
  ) {}

  async onModuleInit() {
    await this.syncCrons();
  }

  async syncCrons() {
    // Remove all existing scheduled-report cron jobs
    const existingJobs = this.schedulerRegistry.getCronJobs();
    for (const [name] of existingJobs) {
      if (name.startsWith('sr-')) {
        this.schedulerRegistry.deleteCronJob(name);
      }
    }

    // Load all enabled schedules and register crons
    const schedules = await this.db.scheduledReport.findMany({
      where: { enabled: true },
    });

    for (const schedule of schedules) {
      const cronName = `sr-${schedule.id}`;
      const cronExpression = `${schedule.cron_minute} ${schedule.cron_hour} * * *`;

      const job = new CronJob(cronExpression, () => {
        this.triggerSchedule(schedule.id).catch((err) =>
          this.logger.error(`Failed to trigger schedule ${schedule.id}:`, err),
        );
      });

      this.schedulerRegistry.addCronJob(cronName, job);
      job.start();

      const time = `${String(schedule.cron_hour).padStart(2, '0')}:${String(schedule.cron_minute).padStart(2, '0')}`;
      this.logger.log(`Registered cron "${schedule.label}" at ${time} UTC (${cronExpression})`);
    }

    this.logger.log(`Synced ${schedules.length} scheduled report cron(s)`);
  }

  async triggerSchedule(scheduleId: string) {
    const schedule = await this.db.scheduledReport.findUnique({
      where: { id: scheduleId },
      include: { user: { select: { language: true } } },
    });

    if (!schedule || !schedule.enabled) {
      this.logger.log(`Schedule ${scheduleId} disabled or not found, skipping`);
      return;
    }

    const symbols = schedule.symbols as string[];
    const language = schedule.user.language || 'es';

    this.logger.log(`Triggering "${schedule.label}": ${symbols.length} coins [${language}]`);

    // Store run status
    await this.cache.set(`scheduled-reports:status:${scheduleId}`, {
      triggeredAt: new Date().toISOString(),
      symbols,
      status: 'running',
      completed: 0,
      failed: 0,
      total: symbols.length,
    });

    // Enqueue jobs with incremental delays
    let delay = 0;
    for (const symbol of symbols) {
      await this.queue.add(
        'generate-report',
        {
          symbol,
          language,
          userId: schedule.user_id,
          scheduleId: schedule.id,
        },
        {
          delay,
          attempts: 2,
          backoff: { type: 'fixed', delay: 30_000 },
          removeOnComplete: 100,
          removeOnFail: 50,
        },
      );
      delay += JOB_DELAY_MS;
    }
  }
}
