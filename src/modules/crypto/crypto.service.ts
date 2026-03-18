import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CacheService, DbService } from 'src/libs';

const COINGECKO_BASE = 'https://api.coingecko.com/api/v3';
const BINANCE_BASE = 'https://data-api.binance.vision/api/v3';
const VALID_INTERVALS = ['15m', '30m', '1h', '4h', '1d', '1w'] as const;

// Pre-populated top symbols for fast lookup without needing /coins/list
const KNOWN_SYMBOLS: Record<string, string> = {
  BTC: 'bitcoin', ETH: 'ethereum', BNB: 'binancecoin', XRP: 'ripple',
  SOL: 'solana', ADA: 'cardano', DOGE: 'dogecoin', DOT: 'polkadot',
  AVAX: 'avalanche-2', MATIC: 'matic-network', LINK: 'chainlink',
  SHIB: 'shiba-inu', LTC: 'litecoin', UNI: 'uniswap', ATOM: 'cosmos',
  XLM: 'stellar', FIL: 'filecoin', NEAR: 'near', APT: 'aptos',
  ARB: 'arbitrum', OP: 'optimism', SUI: 'sui', SEI: 'sei-network',
  TIA: 'celestia', INJ: 'injective-protocol', FET: 'fetch-ai',
  RENDER: 'render-token', PEPE: 'pepe', WIF: 'dogwifcoin',
  BONK: 'bonk', TRX: 'tron', TON: 'the-open-network',
  XMR: 'monero', ALGO: 'algorand', ICP: 'internet-computer',
  HBAR: 'hedera-hashgraph', ETC: 'ethereum-classic', BCH: 'bitcoin-cash',
  AAVE: 'aave', MKR: 'maker', GRT: 'the-graph', VET: 'vechain',
  IMX: 'immutable-x', STX: 'blockstack', KAS: 'kaspa', CRO: 'crypto-com-chain',
};

@Injectable()
export class CryptoService {
  private readonly logger = new Logger(CryptoService.name);
  private readonly apiKey: string | undefined;

  constructor(
    private readonly dbService: DbService,
    private readonly cacheService: CacheService,
    private readonly configService: ConfigService,
  ) {
    this.apiKey = this.configService.get<string>('COINGECKO_API_KEY') || undefined;
  }

  // ═══════════════ MARKET DATA ═══════════════

  // ═══════════════ SEARCH ═══════════════

  async searchCoins(query: string) {
    const cacheKey = `crypto:search:${query.toLowerCase()}`;
    const cached = await this.cacheService.get<any[]>(cacheKey);
    if (cached) return cached;

    const data = await this.fetchCoinGecko(`/search?query=${encodeURIComponent(query)}`);
    if (!data?.coins) return [];

    const coins = data.coins.slice(0, 10).map((c: any) => ({
      id: c.id,
      symbol: c.symbol?.toUpperCase(),
      name: c.name,
      thumb: c.thumb,
      rank: c.market_cap_rank,
    }));

    await this.cacheService.set(cacheKey, coins, 300);
    return coins;
  }

  // ═══════════════ MARKET DATA ═══════════════

  async getTopCoins(limit: number = 20) {
    const cacheKey = `crypto:top:${limit}`;
    const cached = await this.cacheService.get<any[]>(cacheKey);
    if (cached) return cached;

    const data = await this.fetchCoinGecko(
      `/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=${limit}&page=1&sparkline=false&price_change_percentage=1h,24h,7d`,
    );

    if (!data || !Array.isArray(data)) return [];

    const coins = data.map((c: any) => ({
      id: c.id,
      symbol: c.symbol?.toUpperCase(),
      name: c.name,
      image: c.image,
      price: c.current_price,
      marketCap: c.market_cap,
      volume24h: c.total_volume,
      change1h: c.price_change_percentage_1h_in_currency,
      change24h: c.price_change_percentage_24h_in_currency,
      change7d: c.price_change_percentage_7d_in_currency,
      rank: c.market_cap_rank,
    }));

    await this.cacheService.set(cacheKey, coins, 10); // Cache 10s
    return coins;
  }

  async getCoinPrice(symbol: string) {
    const cacheKey = `crypto:price:${symbol}`;
    const cached = await this.cacheService.get<any>(cacheKey);
    if (cached) return cached;

    const id = await this.resolveSymbolToId(symbol);
    if (!id) return { symbol, price: 0, change24h: 0, error: 'Unknown symbol' };

    const data = await this.fetchCoinGecko(
      `/simple/price?ids=${id}&vs_currencies=usd&include_24hr_change=true&include_24hr_vol=true&include_market_cap=true`,
    );

    if (!data || !data[id]) return { symbol, price: 0, change24h: 0 };

    const result = {
      symbol,
      id,
      price: data[id].usd,
      change24h: data[id].usd_24h_change,
      volume24h: data[id].usd_24h_vol,
      marketCap: data[id].usd_market_cap,
    };

    await this.cacheService.set(cacheKey, result, 10); // Cache 10s
    return result;
  }

  async getCoinHistory(symbol: string, days: number = 30) {
    const cacheKey = `crypto:ohlc:${symbol}:${days}`;
    const cached = await this.cacheService.get<any>(cacheKey);
    if (cached) return cached;

    const id = await this.resolveSymbolToId(symbol);
    if (!id) return { symbol, days, data: [] };

    const data = await this.fetchCoinGecko(
      `/coins/${id}/ohlc?vs_currency=usd&days=${days}`,
    );

    if (!data || !Array.isArray(data)) return { symbol, days, data: [] };

    // CoinGecko OHLC format: [timestamp, open, high, low, close]
    const ohlc = data.map((candle: number[]) => ({
      timestamp: candle[0],
      open: candle[1],
      high: candle[2],
      low: candle[3],
      close: candle[4],
    }));

    const result = { symbol, days, data: ohlc };
    await this.cacheService.set(cacheKey, result, 60); // Cache 60s
    return result;
  }

  async getTrending() {
    const cacheKey = 'crypto:trending';
    const cached = await this.cacheService.get<any>(cacheKey);
    if (cached) return cached;

    const data = await this.fetchCoinGecko('/search/trending');

    if (!data?.coins) return [];

    const trending = data.coins.map((c: any) => ({
      id: c.item.id,
      symbol: c.item.symbol?.toUpperCase(),
      name: c.item.name,
      image: c.item.small,
      rank: c.item.market_cap_rank,
      pricebtc: c.item.price_btc,
    }));

    await this.cacheService.set(cacheKey, trending, 300); // Cache 5min
    return trending;
  }

  async getBinancePrice(symbol: string): Promise<number | null> {
    const pair = `${symbol.toUpperCase()}USDT`;
    const cacheKey = `crypto:binance-price:${pair}`;
    const cached = await this.cacheService.get<number>(cacheKey);
    if (cached) return cached;

    try {
      const url = `${BINANCE_BASE}/ticker/price?symbol=${pair}`;
      const response = await fetch(url, { headers: { Accept: 'application/json' } });
      if (!response.ok) return null;

      const data = await response.json();
      const price = parseFloat(data.price);
      if (!price || isNaN(price)) return null;

      await this.cacheService.set(cacheKey, price, 10); // Cache 10s
      return price;
    } catch (error) {
      this.logger.error(`Binance price fetch error for ${pair}:`, error);
      return null;
    }
  }

  // ═══════════════ KLINES (Binance → CoinGecko fallback) ═══════════════

  async getKlines(symbol: string, interval: string = '4h', limit: number = 300, endTime?: number) {
    interval = interval.toLowerCase();
    if (!VALID_INTERVALS.includes(interval as any)) {
      return { symbol, interval, data: [], source: 'binance' as const, error: 'Invalid interval' };
    }
    limit = Math.min(limit, 1000);

    const pair = `${symbol.toUpperCase()}USDT`;
    const cacheKey = `crypto:klines:${pair}:${interval}:${limit}:${endTime || 'latest'}`;
    const cached = await this.cacheService.get<any>(cacheKey);
    if (cached) return cached;

    // Try Binance first
    try {
      let url = `${BINANCE_BASE}/klines?symbol=${pair}&interval=${interval}&limit=${limit}`;
      if (endTime) {
        url += `&endTime=${endTime * 1000}`; // seconds → ms for Binance
      }
      const response = await fetch(url, { headers: { 'Accept': 'application/json' } });

      if (response.ok) {
        const raw: any[][] = await response.json();

        if (raw.length > 0 && !this.isKlinesStale(raw, interval)) {
          const data = raw.map((k) => ({
            time: Math.floor(k[0] / 1000),  // ms → seconds for lightweight-charts
            open: parseFloat(k[1]),
            high: parseFloat(k[2]),
            low: parseFloat(k[3]),
            close: parseFloat(k[4]),
            volume: parseFloat(k[5]),
          }));

          const cacheTtl = 10; // Cache 10s — Binance allows 1200 req/min
          const result = { symbol, interval, data, source: 'binance' as const };
          await this.cacheService.set(cacheKey, result, cacheTtl);
          return result;
        }

        this.logger.warn(`Stale/empty Binance data for ${pair} ${interval} — falling back to CoinGecko`);
      } else {
        const body = await response.text().catch(() => '');
        this.logger.warn(`Binance API error: ${response.status} for ${pair} ${interval} — ${body}`);
      }
    } catch (error) {
      this.logger.error(`Binance fetch error for ${pair} ${interval}:`, error);
    }

    // Fallback: CoinGecko OHLC
    return this.getKlinesFallback(symbol, interval, endTime);
  }

  private isKlinesStale(raw: any[][], interval: string): boolean {
    const lastCandle = raw[raw.length - 1];
    if (!lastCandle) return true;

    const lastCloseTime = lastCandle[6] as number; // Binance kline close time (ms)
    const intervalMs: Record<string, number> = {
      '15m': 15 * 60_000, '30m': 30 * 60_000, '1h': 60 * 60_000,
      '4h': 4 * 3_600_000, '1d': 86_400_000, '1w': 604_800_000,
    };
    const threshold = (intervalMs[interval] || 14_400_000) * 3;
    return (Date.now() - lastCloseTime) > threshold;
  }

  private async getKlinesFallback(symbol: string, interval: string, endTime?: number) {
    // CoinGecko OHLC granularity: days=30 → 4h candles, days=365 → 4-day candles
    const cgDaysMap: Record<string, number> = { '4h': 30, '1d': 365, '1w': 365 };
    const days = cgDaysMap[interval];

    // CoinGecko doesn't support fine-grained intervals or pagination
    if (!days || endTime) {
      return { symbol, interval, data: [], source: 'coingecko' as const };
    }

    const cacheKey = `crypto:klines-cg:${symbol}:${interval}`;
    const cached = await this.cacheService.get<any>(cacheKey);
    if (cached) return cached;

    const id = await this.resolveSymbolToId(symbol);
    if (!id) return { symbol, interval, data: [], source: 'coingecko' as const };

    const ohlc = await this.fetchCoinGecko(`/coins/${id}/ohlc?vs_currency=usd&days=${days}`);
    if (!ohlc || !Array.isArray(ohlc)) {
      return { symbol, interval, data: [], source: 'coingecko' as const };
    }

    const data = ohlc.map((candle: number[]) => ({
      time: Math.floor(candle[0] / 1000),
      open: candle[1],
      high: candle[2],
      low: candle[3],
      close: candle[4],
      volume: 0,
    }));

    const result = { symbol, interval, data, source: 'coingecko' as const };
    await this.cacheService.set(cacheKey, result, 60); // Cache 60s — CoinGecko fallback
    return result;
  }

  // ═══════════════ WATCHLIST ═══════════════

  async getUserWatchlist(userId: string) {
    return this.dbService.watchlist.findMany({
      where: { user_id: userId },
      orderBy: { added_at: 'desc' },
    });
  }

  async addToWatchlist(userId: string, symbol: string, name: string) {
    return this.dbService.watchlist.create({
      data: { user_id: userId, symbol, name },
    });
  }

  async removeFromWatchlist(userId: string, symbol: string) {
    return this.dbService.watchlist.delete({
      where: { user_id_symbol: { user_id: userId, symbol } },
    });
  }

  // ═══════════════ HELPERS ═══════════════

  async resolveSymbolToId(symbol: string): Promise<string | null> {
    const upper = symbol.toUpperCase();

    // Check known map first
    if (KNOWN_SYMBOLS[upper]) return KNOWN_SYMBOLS[upper];

    // Try fetching from CoinGecko coins list (cached 24h)
    const cacheKey = 'crypto:coins-list';
    let coinsList = await this.cacheService.get<Record<string, string>>(cacheKey);

    if (!coinsList) {
      const data = await this.fetchCoinGecko('/coins/list');
      if (data && Array.isArray(data)) {
        coinsList = {};
        for (const coin of data) {
          const sym = coin.symbol?.toUpperCase();
          if (sym && !coinsList[sym]) {
            coinsList[sym] = coin.id;
          }
        }
        await this.cacheService.set(cacheKey, coinsList, 86400); // 24h
      }
    }

    return coinsList?.[upper] || null;
  }

  private async fetchCoinGecko(endpoint: string): Promise<any> {
    try {
      const url = `${COINGECKO_BASE}${endpoint}`;
      const headers: Record<string, string> = { 'Accept': 'application/json' };
      if (this.apiKey) {
        headers['x-cg-demo-api-key'] = this.apiKey;
      }

      const response = await fetch(url, { headers });

      if (!response.ok) {
        const body = await response.text().catch(() => '');
        this.logger.warn(`CoinGecko API error: ${response.status} for ${endpoint} — ${body}`);
        return null;
      }

      return await response.json();
    } catch (error) {
      this.logger.error(`CoinGecko fetch error for ${endpoint}:`, error);
      return null;
    }
  }
}
