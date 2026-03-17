import { Injectable, Logger, NotFoundException, forwardRef, Inject } from '@nestjs/common';
import { DbService } from '../../libs/db/db.service';
import { CacheService } from '../../libs/cache/cache.service';
import { CreateScheduleDto } from './dtos/create-schedule.dto';
import { UpdateScheduleDto } from './dtos/update-schedule.dto';
import { ScheduledReportsScheduler } from './scheduled-reports.scheduler';

@Injectable()
export class ScheduledReportsService {
  private readonly logger = new Logger(ScheduledReportsService.name);

  constructor(
    private readonly db: DbService,
    private readonly cache: CacheService,
    @Inject(forwardRef(() => ScheduledReportsScheduler))
    private readonly scheduler: ScheduledReportsScheduler,
  ) {}

  async findAll() {
    return this.db.scheduledReport.findMany({
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: [{ cron_hour: 'asc' }, { cron_minute: 'asc' }],
    });
  }

  async findOne(id: string) {
    const schedule = await this.db.scheduledReport.findUnique({
      where: { id },
      include: { user: { select: { id: true, name: true, email: true } } },
    });
    if (!schedule) throw new NotFoundException('Schedule not found');
    return schedule;
  }

  async create(dto: CreateScheduleDto, adminUserId: string) {
    const schedule = await this.db.scheduledReport.create({
      data: {
        label: dto.label,
        enabled: dto.enabled,
        symbols: dto.symbols.map((s) => s.toUpperCase()),
        cron_hour: dto.cronHour,
        cron_minute: dto.cronMinute,
        user_id: adminUserId,
      },
      include: { user: { select: { id: true, name: true, email: true } } },
    });
    await this.scheduler.syncCrons();
    this.logger.log(`Schedule created: ${schedule.label} (${schedule.id})`);
    return schedule;
  }

  async update(id: string, dto: UpdateScheduleDto) {
    await this.findOne(id); // ensure exists
    const schedule = await this.db.scheduledReport.update({
      where: { id },
      data: {
        ...(dto.label !== undefined && { label: dto.label }),
        ...(dto.enabled !== undefined && { enabled: dto.enabled }),
        ...(dto.symbols !== undefined && { symbols: dto.symbols.map((s) => s.toUpperCase()) }),
        ...(dto.cronHour !== undefined && { cron_hour: dto.cronHour }),
        ...(dto.cronMinute !== undefined && { cron_minute: dto.cronMinute }),
      },
      include: { user: { select: { id: true, name: true, email: true } } },
    });
    await this.scheduler.syncCrons();
    this.logger.log(`Schedule updated: ${schedule.label} (${schedule.id})`);
    return schedule;
  }

  async remove(id: string) {
    await this.findOne(id); // ensure exists
    await this.db.scheduledReport.delete({ where: { id } });
    await this.cache.del(`scheduled-reports:status:${id}`);
    await this.scheduler.syncCrons();
    this.logger.log(`Schedule removed: ${id}`);
    return { ok: true };
  }

  async getLastRunStatus(scheduleId: string) {
    return this.cache.get<any>(`scheduled-reports:status:${scheduleId}`);
  }

  async triggerManual(id: string) {
    const schedule = await this.findOne(id);
    await this.scheduler.triggerSchedule(schedule.id);
    return { ok: true, message: `Triggered ${schedule.label}` };
  }
}
