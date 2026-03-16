import { Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { GetUserInfo } from '../auth/decorators';
import { SessionGuard } from '../auth/guards';
import type { SessionUser } from '../auth/interfaces';
import { AiService } from './ai.service';

@ApiTags('AI')
@Controller('ai')
@UseGuards(SessionGuard)
export class AiController {
  constructor(private readonly aiService: AiService) { }

  @Post('report/:symbol')
  async generateReport(
    @GetUserInfo() user: SessionUser,
    @Param('symbol') symbol: string,
    @Query('timeframe') timeframe?: string,
  ) {
    return this.aiService.generateReport(
      user.id,
      symbol.toUpperCase(),
      timeframe || '1D',
    );
  }

  @Get('reports')
  async getUserReports(
    @GetUserInfo() user: SessionUser,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.aiService.getUserReports(
      user.id,
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 10,
    );
  }

  @Get('reports/:id')
  async getReport(
    @GetUserInfo() user: SessionUser,
    @Param('id') id: string,
  ) {
    return this.aiService.getReport(id, user.id);
  }
}
