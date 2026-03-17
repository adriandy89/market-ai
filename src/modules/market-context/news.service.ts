import { Injectable, Logger } from '@nestjs/common';
import { CacheService } from 'src/libs';

export interface NewsItem {
  title: string;
  source: string;
  publishedAt: string;
  url: string;
  sentiment: 'positive' | 'negative' | 'neutral';
  relevance: 'high' | 'medium' | 'low';
  kind: string;
}

export interface NewsContext {
  symbol: string;
  items: NewsItem[];
  overallSentiment: 'positive' | 'negative' | 'mixed' | 'neutral';
  fetchedAt: string;
}

const POSITIVE_KEYWORDS = [
  'surge', 'rally', 'bullish', 'gain', 'rise', 'soar', 'high', 'record',
  'adoption', 'approval', 'partnership', 'upgrade', 'launch', 'growth',
  'breakout', 'recover', 'boost', 'positive', 'milestone', 'all-time',
];

const NEGATIVE_KEYWORDS = [
  'crash', 'drop', 'bearish', 'fall', 'plunge', 'hack', 'ban', 'lawsuit',
  'fraud', 'decline', 'loss', 'sell-off', 'selloff', 'dump', 'fear',
  'warning', 'risk', 'exploit', 'vulnerability', 'scam', 'investigation',
];

@Injectable()
export class NewsService {
  private readonly logger = new Logger(NewsService.name);

  constructor(
    private readonly cacheService: CacheService,
  ) {}

  async getNews(symbol: string): Promise<NewsContext> {
    const cacheKey = `market-context:news:${symbol.toUpperCase()}`;
    const cached = await this.cacheService.get<NewsContext>(cacheKey);
    if (cached) {
      this.logger.log(`[${symbol.toUpperCase()}] News served from cache (${cached.items.length} items, sentiment: ${cached.overallSentiment})`);
      return cached;
    }

    this.logger.log(`[${symbol.toUpperCase()}] Cache miss — fetching fresh news from CryptoCompare`);
    const items = await this.fetchCryptoCompareNews(symbol);
    const overallSentiment = this.computeOverallSentiment(items);

    const result: NewsContext = {
      symbol: symbol.toUpperCase(),
      items: items.slice(0, 10),
      overallSentiment,
      fetchedAt: new Date().toISOString(),
    };

    this.logger.log(`[${symbol.toUpperCase()}] News fetched successfully: ${result.items.length} items, overall sentiment: ${overallSentiment}`);
    await this.cacheService.set(cacheKey, result, 300);
    return result;
  }

  private async fetchCryptoCompareNews(symbol: string): Promise<NewsItem[]> {
    try {
      const url = `https://min-api.cryptocompare.com/data/v2/news/?lang=EN&categories=${symbol.toUpperCase()}&excludeCategories=Sponsored`;
      const response = await fetch(url, {
        headers: { 'Accept': 'application/json' },
      });

      if (!response.ok) {
        this.logger.warn(`CryptoCompare News API error: ${response.status}`);
        return [];
      }

      const data = await response.json();
      if (!data?.Data?.length) {
        this.logger.warn(`[${symbol.toUpperCase()}] CryptoCompare returned empty or missing news data`);
        return [];
      }

      this.logger.log(`[${symbol.toUpperCase()}] CryptoCompare API responded with ${data.Data.length} articles`);

      return data.Data.slice(0, 15).map((article: any) => {
        const text = `${article.title || ''} ${article.body || ''}`.toLowerCase();

        return {
          title: article.title || '',
          source: article.source_info?.name || article.source || 'CryptoCompare',
          publishedAt: new Date((article.published_on || 0) * 1000).toISOString(),
          url: article.url || '',
          sentiment: this.classifySentiment(text),
          relevance: this.classifyRelevance(article),
          kind: article.categories || 'news',
        };
      });
    } catch (error) {
      this.logger.error(`Failed to fetch CryptoCompare news for ${symbol}:`, error);
      return [];
    }
  }

  private classifySentiment(text: string): NewsItem['sentiment'] {
    let positiveCount = 0;
    let negativeCount = 0;

    for (const kw of POSITIVE_KEYWORDS) {
      if (text.includes(kw)) positiveCount++;
    }
    for (const kw of NEGATIVE_KEYWORDS) {
      if (text.includes(kw)) negativeCount++;
    }

    if (positiveCount > negativeCount && positiveCount >= 2) return 'positive';
    if (negativeCount > positiveCount && negativeCount >= 2) return 'negative';
    if (positiveCount > 0 && negativeCount === 0) return 'positive';
    if (negativeCount > 0 && positiveCount === 0) return 'negative';
    return 'neutral';
  }

  private classifyRelevance(article: any): NewsItem['relevance'] {
    const upvotes = article.upvotes || 0;
    const downvotes = article.downvotes || 0;
    const total = upvotes + downvotes;

    if (total >= 10 || upvotes >= 5) return 'high';
    if (total >= 3) return 'medium';
    return 'low';
  }

  private computeOverallSentiment(items: NewsItem[]): NewsContext['overallSentiment'] {
    if (items.length === 0) return 'neutral';

    const counts = { positive: 0, negative: 0, neutral: 0 };
    for (const item of items) {
      counts[item.sentiment]++;
    }

    if (counts.positive > counts.negative * 2) return 'positive';
    if (counts.negative > counts.positive * 2) return 'negative';
    if (counts.positive > 0 && counts.negative > 0) return 'mixed';
    return 'neutral';
  }
}
