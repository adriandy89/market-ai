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

  async getIndicators(symbol: string, timeframe: string = '4h') {
    const cacheKey = `analysis:indicators:${symbol}:${timeframe}`;
    const cached = await this.cacheService.get<any>(cacheKey);
    if (cached) return cached;

    const klines = await this.cryptoService.getKlines(symbol, timeframe, 300);
    if (!klines.data || klines.data.length < 14) {
      return { symbol, timeframe, indicators: null, source: klines.source, error: 'Insufficient data' };
    }

    const closes = klines.data.map((c: any) => c.close);
    const highs = klines.data.map((c: any) => c.high);
    const lows = klines.data.map((c: any) => c.low);
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
      source: klines.source,
      indicators: {
        rsi: {
          value: rsiCurrent,
          signal: rsiCurrent != null ? (rsiCurrent > 70 ? 'overbought' : rsiCurrent < 30 ? 'oversold' : 'neutral') : null,
        },
        macd: {
          macd: macdCurrent?.MACD ?? null,
          signal: macdCurrent?.signal ?? null,
          histogram: macdCurrent?.histogram ?? null,
          trend: macdCurrent?.histogram != null ? (macdCurrent.histogram > 0 ? 'bullish' : 'bearish') : null,
        },
        bollingerBands: bbCurrent ? {
          upper: bbCurrent.upper,
          middle: bbCurrent.middle,
          lower: bbCurrent.lower,
          position: currentPrice > bbCurrent.upper ? 'above_upper' : currentPrice < bbCurrent.lower ? 'below_lower' : 'within',
        } : null,
        ema: { ema9, ema21, ema50, ema200 },
        sma: { sma20, sma50, sma200 },
        stochastic: stochCurrent ? {
          k: stochCurrent.k,
          d: stochCurrent.d,
          signal: stochCurrent.k > 80 ? 'overbought' : stochCurrent.k < 20 ? 'oversold' : 'neutral',
        } : null,
        adx: adxCurrent ? {
          adx: adxCurrent.adx,
          pdi: adxCurrent.pdi,
          mdi: adxCurrent.mdi,
          trendStrength: adxCurrent.adx > 25 ? 'strong' : 'weak',
        } : null,
      },
    };

    await this.cacheService.set(cacheKey, result, 10); // Cache 10s
    return result;
  }

  async getPatterns(symbol: string, timeframe: string = '4h') {
    const cacheKey = `analysis:patterns:${symbol}:${timeframe}`;
    const cached = await this.cacheService.get<any>(cacheKey);
    if (cached) return cached;

    const klines = await this.cryptoService.getKlines(symbol, timeframe, 20);
    if (!klines.data || klines.data.length < 5) {
      return { symbol, patterns: [], source: klines.source };
    }

    const candles = klines.data.slice(-10);
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

    const result = { symbol, patterns, source: klines.source };
    await this.cacheService.set(cacheKey, result, 10); // Cache 10s
    return result;
  }

  async getSupportResistance(symbol: string, timeframe: string = '4h') {
    const cacheKey = `analysis:levels:${symbol}:${timeframe}`;
    const cached = await this.cacheService.get<any>(cacheKey);
    if (cached) return cached;

    const klines = await this.cryptoService.getKlines(symbol, timeframe, 5);
    if (!klines.data || klines.data.length < 2) {
      return { symbol, support: [], resistance: [], source: klines.source };
    }

    // Use the last COMPLETED candle (second to last), not the current open one
    const last = klines.data[klines.data.length - 2];
    const pivot = (last.high + last.low + last.close) / 3;
    const r1 = 2 * pivot - last.low;
    const s1 = 2 * pivot - last.high;
    const r2 = pivot + (last.high - last.low);
    const s2 = pivot - (last.high - last.low);
    const r3 = last.high + 2 * (pivot - last.low);
    const s3 = last.low - 2 * (last.high - pivot);

    const result = {
      symbol,
      pivot,
      source: klines.source,
      resistance: [
        { level: 'R1', price: r1 },
        { level: 'R2', price: r2 },
        { level: 'R3', price: r3 },
      ],
      support: [
        { level: 'S1', price: s1 },
        { level: 'S2', price: s2 },
        { level: 'S3', price: s3 },
      ],
    };

    await this.cacheService.set(cacheKey, result, 10); // Cache 10s
    return result;
  }

  async getMultiTimeframeAnalysis(symbol: string) {
    const timeframes = ['4h', '1d', '1w'] as const;

    const [tf4h, tf1d, tf1w] = await Promise.all(
      timeframes.map((tf) =>
        Promise.all([
          this.getIndicators(symbol, tf),
          this.getPatterns(symbol, tf),
          this.getSupportResistance(symbol, tf),
        ]),
      ),
    );

    const data = {
      '4h': { indicators: tf4h[0], patterns: tf4h[1], levels: tf4h[2] },
      '1d': { indicators: tf1d[0], patterns: tf1d[1], levels: tf1d[2] },
      '1w': { indicators: tf1w[0], patterns: tf1w[1], levels: tf1w[2] },
    };

    const confluence = this.computeConfluence(data);

    return { symbol, timeframes: data, confluence };
  }

  private computeConfluence(data: Record<string, { indicators: any; patterns: any; levels: any }>) {
    const biases: Record<string, string> = {};
    const observations: string[] = [];

    for (const [tf, { indicators }] of Object.entries(data)) {
      const ind = indicators?.indicators;
      if (!ind) {
        biases[tf] = 'neutral';
        continue;
      }

      let bullish = 0;
      let bearish = 0;

      // RSI
      if (ind.rsi?.signal === 'oversold') bullish++;
      if (ind.rsi?.signal === 'overbought') bearish++;

      // MACD
      if (ind.macd?.trend === 'bullish') bullish++;
      if (ind.macd?.trend === 'bearish') bearish++;

      // Stochastic
      if (ind.stochastic?.signal === 'oversold') bullish++;
      if (ind.stochastic?.signal === 'overbought') bearish++;

      // EMA alignment: price above EMA50 = bullish
      const price = indicators?.currentPrice;
      if (price && ind.ema?.ema50) {
        if (price > ind.ema.ema50) bullish++;
        else bearish++;
      }

      // Bollinger
      if (ind.bollingerBands?.position === 'below_lower') bullish++;
      if (ind.bollingerBands?.position === 'above_upper') bearish++;

      biases[tf] = bullish > bearish ? 'bullish' : bearish > bullish ? 'bearish' : 'neutral';
    }

    // Cross-timeframe observations
    const rsiSignals = Object.entries(data)
      .map(([tf, d]) => ({ tf, signal: d.indicators?.indicators?.rsi?.signal }))
      .filter((r) => r.signal);

    const uniqueRsi = new Set(rsiSignals.map((r) => r.signal));
    if (uniqueRsi.size > 1) {
      observations.push(
        `RSI divergence: ${rsiSignals.map((r) => `${r.tf}=${r.signal}`).join(', ')}`,
      );
    }

    const macdTrends = Object.entries(data)
      .map(([tf, d]) => ({ tf, trend: d.indicators?.indicators?.macd?.trend }))
      .filter((r) => r.trend);

    const uniqueMacd = new Set(macdTrends.map((r) => r.trend));
    if (uniqueMacd.size > 1) {
      observations.push(
        `MACD divergence: ${macdTrends.map((r) => `${r.tf}=${r.trend}`).join(', ')}`,
      );
    }

    // ADX strength across timeframes
    const adxStrong = Object.entries(data)
      .filter(([, d]) => d.indicators?.indicators?.adx?.trendStrength === 'strong')
      .map(([tf]) => tf);
    if (adxStrong.length > 0) {
      observations.push(`Strong trend on: ${adxStrong.join(', ')}`);
    }

    const biasValues = Object.values(biases);
    const allSame = biasValues.every((b) => b === biasValues[0]);

    let trendAlignment: string;
    if (allSame && biasValues[0] !== 'neutral') {
      trendAlignment = `aligned-${biasValues[0]}`;
    } else if (allSame) {
      trendAlignment = 'neutral';
    } else {
      trendAlignment = 'divergent';
    }

    const alignedCount = biasValues.filter((b) => b === biasValues[0]).length;
    const strength = alignedCount === 3 ? 'strong' : alignedCount === 2 ? 'moderate' : 'weak';

    return {
      trendAlignment,
      strength,
      biasPerTimeframe: biases,
      keyObservations: observations,
    };
  }

  private lastVal(arr: number[]): number | null {
    if (!arr || arr.length === 0) return null;
    return arr[arr.length - 1];
  }
}
