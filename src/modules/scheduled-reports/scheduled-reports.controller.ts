import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Role } from 'generated/prisma/enums';
import { GetUserInfo, Permissions } from '../auth/decorators';
import { PermissionsGuard, SessionGuard } from '../auth/guards';
import type { SessionUser } from '../auth/interfaces';
import { ScheduledReportsService } from './scheduled-reports.service';
import { CreateScheduleDto } from './dtos/create-schedule.dto';
import { UpdateScheduleDto } from './dtos/update-schedule.dto';

@ApiTags('Scheduled Reports')
@Controller('scheduled-reports')
@UseGuards(SessionGuard, PermissionsGuard)
@Permissions([Role.ADMIN])
export class ScheduledReportsController {
  constructor(private readonly service: ScheduledReportsService) {}

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  create(@GetUserInfo() user: SessionUser, @Body() dto: CreateScheduleDto) {
    return this.service.create(dto, user.id);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateScheduleDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }

  @Get(':id/status')
  getStatus(@Param('id') id: string) {
    return this.service.getLastRunStatus(id);
  }

  @Post(':id/trigger')
  trigger(@Param('id') id: string) {
    return this.service.triggerManual(id);
  }
}
