import { Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Role } from 'generated/prisma/enums';
import { GetUserInfo, Permissions } from '../auth/decorators';
import { PermissionsGuard, SessionGuard } from '../auth/guards';
import type { SessionUser } from '../auth/interfaces';
import { AiService } from './ai.service';

@ApiTags('AI')
@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) { }

  @Post('report/:symbol')
  @Permissions([Role.ADMIN])
  @UseGuards(SessionGuard, PermissionsGuard)
  async generateReport(
    @GetUserInfo() user: SessionUser,
    @Param('symbol') symbol: string,
    @Query('timeframe') timeframe?: string,
  ) {
    return this.aiService.generateReport(
      user.id,
      symbol.toUpperCase(),
      timeframe || '4h',
      user.language || 'es',
    );
  }

  @Post('report/:symbol/comprehensive')
  @Permissions([Role.ADMIN])
  @UseGuards(SessionGuard, PermissionsGuard)
  async generateComprehensiveReport(
    @GetUserInfo() user: SessionUser,
    @Param('symbol') symbol: string,
  ) {
    return this.aiService.generateComprehensiveReport(
      user.id,
      symbol.toUpperCase(),
      user.language || 'es',
    );
  }

  @Get('reports')
  async getReports(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('symbol') symbol?: string,
  ) {
    return this.aiService.getReports(
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 10,
      symbol?.toUpperCase(),
    );
  }

  @Get('reports/:id')
  async getReport(
    @Param('id') id: string,
  ) {
    return this.aiService.getReport(id);
  }
}
