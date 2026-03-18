import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CacheService } from 'src/libs';

export interface NewsItem {
  title: string;
  source: string;
  publishedAt: string;
  url: string;
  relevance: 'high' | 'medium' | 'low';
  kind: string;
}

export interface NewsContext {
  symbol: string;
  items: NewsItem[];
  fetchedAt: string;
}

@Injectable()
export class NewsService {
  private readonly logger = new Logger(NewsService.name);
  private readonly apiKey: string | undefined;

  constructor(
    private readonly cacheService: CacheService,
    private readonly configService: ConfigService,
  ) {
    this.apiKey = this.configService.get<string>('CRYPTOCOMPARE_API_KEY') || undefined;
    if (!this.apiKey) {
      this.logger.warn('CRYPTOCOMPARE_API_KEY not configured — news fetching will fail');
    }
  }

  async getNews(symbol: string): Promise<NewsContext> {
    const cacheKey = `market-context:news:${symbol.toUpperCase()}`;
    const cached = await this.cacheService.get<NewsContext>(cacheKey);
    if (cached) {
      this.logger.log(`[${symbol.toUpperCase()}] News served from cache (${cached.items.length} items)`);
      return cached;
    }

    this.logger.log(`[${symbol.toUpperCase()}] Cache miss — fetching fresh news from CryptoCompare`);
    const items = await this.fetchCryptoCompareNews(symbol);

    const result: NewsContext = {
      symbol: symbol.toUpperCase(),
      items: items.slice(0, 10),
      fetchedAt: new Date().toISOString(),
    };

    this.logger.log(`[${symbol.toUpperCase()}] News fetched successfully: ${result.items.length} items`);
    await this.cacheService.set(cacheKey, result, 120); // Cache 2min
    return result;
  }

  private async fetchCryptoCompareNews(symbol: string): Promise<NewsItem[]> {
    try {
      const url = `https://min-api.cryptocompare.com/data/v2/news/?lang=EN&categories=${symbol.toUpperCase()}&excludeCategories=Sponsored&api_key=${this.apiKey}`;
      const response = await fetch(url, {
        headers: { 'Accept': 'application/json' },
      });

      if (!response.ok) {
        this.logger.warn(`CryptoCompare News API error: ${response.status}`);
        return [];
      }

      const data = await response.json();
      if (data?.Response === 'Error') {
        this.logger.warn(`[${symbol.toUpperCase()}] CryptoCompare API error: ${data.Message}`);
        return [];
      }

      if (!data?.Data?.length) {
        this.logger.warn(`[${symbol.toUpperCase()}] CryptoCompare returned no news for this symbol`);
        return [];
      }

      this.logger.log(`[${symbol.toUpperCase()}] CryptoCompare API responded with ${data.Data.length} articles`);

      return data.Data.slice(0, 15).map((article: any) => ({
        title: article.title || '',
        source: article.source_info?.name || article.source || 'CryptoCompare',
        publishedAt: new Date((article.published_on || 0) * 1000).toISOString(),
        url: article.url || '',
        relevance: this.classifyRelevance(article),
        kind: article.categories || 'news',
      }));
    } catch (error) {
      this.logger.error(`Failed to fetch CryptoCompare news for ${symbol}:`, error);
      return [];
    }
  }

  private classifyRelevance(article: any): NewsItem['relevance'] {
    const upvotes = article.upvotes || 0;
    const downvotes = article.downvotes || 0;
    const total = upvotes + downvotes;

    if (total >= 10 || upvotes >= 5) return 'high';
    if (total >= 3) return 'medium';
    return 'low';
  }

}
