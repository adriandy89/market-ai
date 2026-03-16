import { Injectable, Logger } from '@nestjs/common';
import { CacheService } from 'src/libs';
import { NewsService, type NewsItem } from './news.service';
import { SentimentService } from './sentiment.service';

export interface MacroContext {
  regulatoryNews: NewsItem[];
  macroEvents: NewsItem[];
  marketRegime: 'risk-on' | 'risk-off' | 'neutral';
  fetchedAt: string;
}

const MACRO_KEYWORDS = [
  'fed', 'interest rate', 'inflation', 'cpi', 'gdp', 'recession',
  'treasury', 'dollar', 'fomc', 'monetary policy', 'tariff', 'trade war',
  'unemployment', 'economic', 'central bank',
];

const REGULATORY_KEYWORDS = [
  'sec', 'regulation', 'ban', 'etf', 'cbdc', 'lawsuit', 'compliance',
  'congress', 'legislation', 'enforcement', 'license', 'regulatory',
  'approved', 'rejected', 'legal', 'court', 'sanction',
];

@Injectable()
export class MacroContextService {
  private readonly logger = new Logger(MacroContextService.name);

  constructor(
    private readonly cacheService: CacheService,
    private readonly newsService: NewsService,
    private readonly sentimentService: SentimentService,
  ) {}

  async getMacroContext(symbol: string): Promise<MacroContext> {
    const cacheKey = `market-context:macro:${symbol.toUpperCase()}`;
    const cached = await this.cacheService.get<MacroContext>(cacheKey);
    if (cached) return cached;

    const [newsData, sentimentData] = await Promise.allSettled([
      this.newsService.getNews(symbol),
      this.sentimentService.getSentiment(),
    ]);

    const newsItems = newsData.status === 'fulfilled' ? newsData.value.items : [];
    const sentiment = sentimentData.status === 'fulfilled' ? sentimentData.value : null;

    const regulatoryNews = newsItems.filter((item) =>
      this.matchesKeywords(item.title, REGULATORY_KEYWORDS),
    );

    const macroEvents = newsItems.filter((item) =>
      this.matchesKeywords(item.title, MACRO_KEYWORDS),
    );

    const marketRegime = this.deriveMarketRegime(sentiment);

    const result: MacroContext = {
      regulatoryNews,
      macroEvents,
      marketRegime,
      fetchedAt: new Date().toISOString(),
    };

    await this.cacheService.set(cacheKey, result, 900);
    return result;
  }

  private matchesKeywords(text: string, keywords: string[]): boolean {
    const lower = text.toLowerCase();
    return keywords.some((kw) => lower.includes(kw));
  }

  private deriveMarketRegime(sentiment: { fearGreedIndex: { value: number }; globalMarket: { btcDominance: number; marketCapChange24h: number } } | null): MacroContext['marketRegime'] {
    if (!sentiment) return 'neutral';

    const fgValue = sentiment.fearGreedIndex.value;
    const marketChange = sentiment.globalMarket.marketCapChange24h;

    // Fear & Greed > 60 and market growing = risk-on
    if (fgValue > 60 && marketChange > 0) return 'risk-on';
    // Fear & Greed < 35 and market declining = risk-off
    if (fgValue < 35 && marketChange < 0) return 'risk-off';

    return 'neutral';
  }
}
