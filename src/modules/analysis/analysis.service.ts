import { Injectable, Logger } from '@nestjs/common';
import { RSI, MACD, BollingerBands, EMA, SMA, Stochastic, ADX } from 'technicalindicators';
import { CacheService } from 'src/libs';
import { CryptoService } from '../crypto/crypto.service';

@Injectable()
export class AnalysisService {
  private readonly logger = new Logger(AnalysisService.name);

  constructor(
    private readonly cacheService: CacheService,
    private readonly cryptoService: CryptoService,
  ) { }

  async getIndicators(symbol: string, timeframe: string = '1D') {
    const cacheKey = `analysis:indicators:${symbol}:${timeframe}`;
    const cached = await this.cacheService.get<any>(cacheKey);
    if (cached) return cached;

    const daysMap: Record<string, number> = {
      '1h': 1, '4h': 1, '1D': 30, '1W': 90, '1M': 365,
    };
    const days = daysMap[timeframe] || 30;

    const history = await this.cryptoService.getCoinHistory(symbol, days);
    if (!history.data || history.data.length < 14) {
      return { symbol, timeframe, indicators: null, error: 'Insufficient data' };
    }

    const closes = history.data.map((c: any) => c.close);
    const highs = history.data.map((c: any) => c.high);
    const lows = history.data.map((c: any) => c.low);
    const currentPrice = closes[closes.length - 1];

    // RSI (14)
    const rsiValues = RSI.calculate({ values: closes, period: 14 });
    const rsiCurrent = rsiValues.length > 0 ? rsiValues[rsiValues.length - 1] : null;

    // MACD (12, 26, 9)
    const macdValues = MACD.calculate({
      values: closes, fastPeriod: 12, slowPeriod: 26, signalPeriod: 9,
      SimpleMAOscillator: false, SimpleMASignal: false,
    });
    const macdCurrent = macdValues.length > 0 ? macdValues[macdValues.length - 1] : null;

    // Bollinger Bands (20, 2)
    const bbValues = BollingerBands.calculate({ period: 20, values: closes, stdDev: 2 });
    const bbCurrent = bbValues.length > 0 ? bbValues[bbValues.length - 1] : null;

    // EMAs
    const ema9 = this.lastVal(EMA.calculate({ values: closes, period: 9 }));
    const ema21 = this.lastVal(EMA.calculate({ values: closes, period: 21 }));
    const ema50 = closes.length >= 50 ? this.lastVal(EMA.calculate({ values: closes, period: 50 })) : null;
    const ema200 = closes.length >= 200 ? this.lastVal(EMA.calculate({ values: closes, period: 200 })) : null;

    // SMAs
    const sma20 = this.lastVal(SMA.calculate({ values: closes, period: 20 }));
    const sma50 = closes.length >= 50 ? this.lastVal(SMA.calculate({ values: closes, period: 50 })) : null;
    const sma200 = closes.length >= 200 ? this.lastVal(SMA.calculate({ values: closes, period: 200 })) : null;

    // Stochastic (14, 3)
    const stochValues = Stochastic.calculate({ high: highs, low: lows, close: closes, period: 14, signalPeriod: 3 });
    const stochCurrent = stochValues.length > 0 ? stochValues[stochValues.length - 1] : null;

    // ADX (14)
    const adxValues = ADX.calculate({ high: highs, low: lows, close: closes, period: 14 });
    const adxCurrent = adxValues.length > 0 ? adxValues[adxValues.length - 1] : null;

    const result = {
      symbol,
      timeframe,
      currentPrice,
      indicators: {
        rsi: {
          value: this.round(rsiCurrent),
          signal: rsiCurrent != null ? (rsiCurrent > 70 ? 'overbought' : rsiCurrent < 30 ? 'oversold' : 'neutral') : null,
        },
        macd: {
          macd: this.round(macdCurrent?.MACD),
          signal: this.round(macdCurrent?.signal),
          histogram: this.round(macdCurrent?.histogram),
          trend: macdCurrent?.histogram != null ? (macdCurrent.histogram > 0 ? 'bullish' : 'bearish') : null,
        },
        bollingerBands: bbCurrent ? {
          upper: this.round(bbCurrent.upper),
          middle: this.round(bbCurrent.middle),
          lower: this.round(bbCurrent.lower),
          position: currentPrice > bbCurrent.upper ? 'above_upper' : currentPrice < bbCurrent.lower ? 'below_lower' : 'within',
        } : null,
        ema: { ema9, ema21, ema50, ema200 },
        sma: { sma20, sma50, sma200 },
        stochastic: stochCurrent ? {
          k: this.round(stochCurrent.k),
          d: this.round(stochCurrent.d),
          signal: stochCurrent.k > 80 ? 'overbought' : stochCurrent.k < 20 ? 'oversold' : 'neutral',
        } : null,
        adx: adxCurrent ? {
          adx: this.round(adxCurrent.adx),
          pdi: this.round(adxCurrent.pdi),
          mdi: this.round(adxCurrent.mdi),
          trendStrength: adxCurrent.adx > 25 ? 'strong' : 'weak',
        } : null,
      },
    };

    await this.cacheService.set(cacheKey, result, 300);
    return result;
  }

  async getPatterns(symbol: string) {
    const history = await this.cryptoService.getCoinHistory(symbol, 7);
    if (!history.data || history.data.length < 5) {
      return { symbol, patterns: [] };
    }

    const candles = history.data.slice(-10);
    const patterns: { name: string; type: 'bullish' | 'bearish' | 'neutral'; index: number }[] = [];

    for (let i = 1; i < candles.length; i++) {
      const c = candles[i];
      const prev = candles[i - 1];
      const body = Math.abs(c.close - c.open);
      const range = c.high - c.low;
      if (range === 0) continue;

      // Doji
      if (body / range < 0.1) {
        patterns.push({ name: 'Doji', type: 'neutral', index: i });
      }

      // Hammer
      const upperShadow = c.high - Math.max(c.open, c.close);
      const lowerShadow = Math.min(c.open, c.close) - c.low;
      if (body / range < 0.3 && lowerShadow > body * 2 && upperShadow < body) {
        patterns.push({ name: 'Hammer', type: 'bullish', index: i });
      }

      // Shooting Star
      if (body / range < 0.3 && upperShadow > body * 2 && lowerShadow < body) {
        patterns.push({ name: 'Shooting Star', type: 'bearish', index: i });
      }

      // Bullish Engulfing
      if (prev.close < prev.open && c.close > c.open && c.open <= prev.close && c.close >= prev.open) {
        patterns.push({ name: 'Bullish Engulfing', type: 'bullish', index: i });
      }

      // Bearish Engulfing
      if (prev.close > prev.open && c.close < c.open && c.open >= prev.close && c.close <= prev.open) {
        patterns.push({ name: 'Bearish Engulfing', type: 'bearish', index: i });
      }
    }

    return { symbol, patterns };
  }

  async getSupportResistance(symbol: string) {
    const history = await this.cryptoService.getCoinHistory(symbol, 30);
    if (!history.data || history.data.length < 5) {
      return { symbol, support: [], resistance: [] };
    }

    const last = history.data[history.data.length - 1];
    const pivot = (last.high + last.low + last.close) / 3;
    const r1 = 2 * pivot - last.low;
    const s1 = 2 * pivot - last.high;
    const r2 = pivot + (last.high - last.low);
    const s2 = pivot - (last.high - last.low);
    const r3 = last.high + 2 * (pivot - last.low);
    const s3 = last.low - 2 * (last.high - pivot);

    return {
      symbol,
      pivot: this.round(pivot),
      resistance: [
        { level: 'R1', price: this.round(r1) },
        { level: 'R2', price: this.round(r2) },
        { level: 'R3', price: this.round(r3) },
      ],
      support: [
        { level: 'S1', price: this.round(s1) },
        { level: 'S2', price: this.round(s2) },
        { level: 'S3', price: this.round(s3) },
      ],
    };
  }

  private lastVal(arr: number[]): number | null {
    if (!arr || arr.length === 0) return null;
    return Math.round(arr[arr.length - 1] * 100) / 100;
  }

  private round(val: number | null | undefined): number | null {
    if (val == null) return null;
    return Math.round(val * 100) / 100;
  }
}
