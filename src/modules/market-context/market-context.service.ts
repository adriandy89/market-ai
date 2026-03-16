import { Injectable } from '@nestjs/common';
import { NewsService, type NewsContext } from './news.service';
import { SentimentService, type SentimentContext } from './sentiment.service';
import { MacroContextService, type MacroContext } from './macro-context.service';

export interface FullMarketContext {
  news: NewsContext;
  sentiment: SentimentContext;
  macro: MacroContext;
}

@Injectable()
export class MarketContextService {
  constructor(
    private readonly newsService: NewsService,
    private readonly sentimentService: SentimentService,
    private readonly macroContextService: MacroContextService,
  ) {}

  async getFullContext(symbol: string): Promise<FullMarketContext> {
    const [news, sentiment, macro] = await Promise.allSettled([
      this.newsService.getNews(symbol),
      this.sentimentService.getSentiment(),
      this.macroContextService.getMacroContext(symbol),
    ]);

    return {
      news: news.status === 'fulfilled'
        ? news.value
        : { symbol, items: [], overallSentiment: 'neutral' as const, fetchedAt: new Date().toISOString() },
      sentiment: sentiment.status === 'fulfilled'
        ? sentiment.value
        : { fearGreedIndex: { value: 0, classification: 'unavailable', trend: [] }, globalMarket: { totalMarketCap: 0, totalVolume24h: 0, btcDominance: 0, marketCapChange24h: 0 }, fetchedAt: new Date().toISOString() },
      macro: macro.status === 'fulfilled'
        ? macro.value
        : { regulatoryNews: [], macroEvents: [], marketRegime: 'neutral' as const, fetchedAt: new Date().toISOString() },
    };
  }
}
