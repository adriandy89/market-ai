import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SessionGuard } from '../auth/guards';
import { NewsService } from './news.service';
import { SentimentService } from './sentiment.service';
import { MarketContextService } from './market-context.service';

@ApiTags('Market Context')
@Controller('market-context')
@UseGuards(SessionGuard)
export class MarketContextController {
  constructor(
    private readonly newsService: NewsService,
    private readonly sentimentService: SentimentService,
    private readonly marketContextService: MarketContextService,
  ) {}

  @Get(':symbol/news')
  async getNews(@Param('symbol') symbol: string) {
    return this.newsService.getNews(symbol.toUpperCase());
  }

  @Get('sentiment')
  async getSentiment() {
    return this.sentimentService.getSentiment();
  }

  @Get(':symbol/full')
  async getFullContext(@Param('symbol') symbol: string) {
    return this.marketContextService.getFullContext(symbol.toUpperCase());
  }
}
