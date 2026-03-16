import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AnalysisService } from './analysis.service';

@ApiTags('Analysis')
@Controller('analysis')
export class AnalysisController {
  constructor(private readonly analysisService: AnalysisService) { }

  @Get(':symbol/indicators')
  async getIndicators(
    @Param('symbol') symbol: string,
    @Query('timeframe') timeframe?: string,
  ) {
    return this.analysisService.getIndicators(symbol.toUpperCase(), timeframe || '4h');
  }

  @Get(':symbol/patterns')
  async getPatterns(
    @Param('symbol') symbol: string,
    @Query('timeframe') timeframe?: string,
  ) {
    return this.analysisService.getPatterns(symbol.toUpperCase(), timeframe || '4h');
  }

  @Get(':symbol/levels')
  async getSupportResistance(
    @Param('symbol') symbol: string,
    @Query('timeframe') timeframe?: string,
  ) {
    return this.analysisService.getSupportResistance(symbol.toUpperCase(), timeframe || '4h');
  }
}
