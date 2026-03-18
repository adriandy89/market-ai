import { Injectable, Logger } from '@nestjs/common';
import { CacheService } from 'src/libs';
import { CryptoService } from '../crypto/crypto.service';

interface FearGreedEntry {
  value: number;
  classification: string;
  timestamp: string;
}

export interface SentimentContext {
  fearGreedIndex: {
    value: number;
    classification: string;
    trend: FearGreedEntry[];
  };
  globalMarket: {
    totalMarketCap: number;
    totalVolume24h: number;
    btcDominance: number;
    marketCapChange24h: number;
  };
  fetchedAt: string;
}

@Injectable()
export class SentimentService {
  private readonly logger = new Logger(SentimentService.name);

  constructor(
    private readonly cacheService: CacheService,
    private readonly cryptoService: CryptoService,
  ) {}

  async getSentiment(): Promise<SentimentContext> {
    const cacheKey = 'market-context:sentiment';
    const cached = await this.cacheService.get<SentimentContext>(cacheKey);
    if (cached) return cached;

    const [fearGreed, globalData] = await Promise.allSettled([
      this.fetchFearGreedIndex(),
      this.fetchGlobalMarketData(),
    ]);

    const result: SentimentContext = {
      fearGreedIndex: fearGreed.status === 'fulfilled'
        ? fearGreed.value
        : { value: 0, classification: 'unavailable', trend: [] },
      globalMarket: globalData.status === 'fulfilled'
        ? globalData.value
        : { totalMarketCap: 0, totalVolume24h: 0, btcDominance: 0, marketCapChange24h: 0 },
      fetchedAt: new Date().toISOString(),
    };

    await this.cacheService.set(cacheKey, result, 120); // Cache 2min
    return result;
  }

  private async fetchFearGreedIndex(): Promise<SentimentContext['fearGreedIndex']> {
    try {
      const response = await fetch('https://api.alternative.me/fng/?limit=7');
      if (!response.ok) {
        this.logger.warn(`Fear & Greed API error: ${response.status}`);
        return { value: 0, classification: 'unavailable', trend: [] };
      }

      const data = await response.json();
      if (!data?.data?.length) {
        return { value: 0, classification: 'unavailable', trend: [] };
      }

      const latest = data.data[0];
      const trend = data.data.map((entry: any) => ({
        value: parseInt(entry.value),
        classification: entry.value_classification,
        timestamp: new Date(parseInt(entry.timestamp) * 1000).toISOString(),
      }));

      return {
        value: parseInt(latest.value),
        classification: latest.value_classification,
        trend,
      };
    } catch (error) {
      this.logger.error('Failed to fetch Fear & Greed Index:', error);
      return { value: 0, classification: 'unavailable', trend: [] };
    }
  }

  private async fetchGlobalMarketData(): Promise<SentimentContext['globalMarket']> {
    try {
      const response = await fetch('https://api.coingecko.com/api/v3/global', {
        headers: { 'Accept': 'application/json' },
      });

      if (!response.ok) {
        this.logger.warn(`CoinGecko Global API error: ${response.status}`);
        return { totalMarketCap: 0, totalVolume24h: 0, btcDominance: 0, marketCapChange24h: 0 };
      }

      const data = await response.json();
      const d = data?.data;
      if (!d) {
        return { totalMarketCap: 0, totalVolume24h: 0, btcDominance: 0, marketCapChange24h: 0 };
      }

      return {
        totalMarketCap: d.total_market_cap?.usd || 0,
        totalVolume24h: d.total_volume?.usd || 0,
        btcDominance: d.market_cap_percentage?.btc || 0,
        marketCapChange24h: d.market_cap_change_percentage_24h_usd || 0,
      };
    } catch (error) {
      this.logger.error('Failed to fetch global market data:', error);
      return { totalMarketCap: 0, totalVolume24h: 0, btcDominance: 0, marketCapChange24h: 0 };
    }
  }
}
