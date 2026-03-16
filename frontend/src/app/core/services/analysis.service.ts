import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface IndicatorResult {
  symbol: string;
  timeframe: string;
  currentPrice: number;
  indicators: {
    rsi: { value: number | null; signal: string | null };
    macd: { macd: number | null; signal: number | null; histogram: number | null; trend: string | null };
    bollingerBands: { upper: number; middle: number; lower: number; position: string } | null;
    ema: { ema9: number | null; ema21: number | null; ema50: number | null; ema200: number | null };
    sma: { sma20: number | null; sma50: number | null; sma200: number | null };
    stochastic: { k: number; d: number; signal: string } | null;
    adx: { adx: number; pdi: number; mdi: number; trendStrength: string } | null;
  } | null;
}

export interface PatternResult {
  symbol: string;
  patterns: { name: string; type: 'bullish' | 'bearish' | 'neutral'; index: number }[];
}

export interface LevelsResult {
  symbol: string;
  pivot: number;
  resistance: { level: string; price: number }[];
  support: { level: string; price: number }[];
}

@Injectable({ providedIn: 'root' })
export class AnalysisApiService {
  private readonly http = inject(HttpClient);
  private readonly api = environment.apiUrl;

  getIndicators(symbol: string, timeframe = '4h'): Promise<IndicatorResult> {
    return firstValueFrom(
      this.http.get<IndicatorResult>(`${this.api}/analysis/${symbol}/indicators?timeframe=${timeframe}`),
    );
  }

  getPatterns(symbol: string, timeframe = '4h'): Promise<PatternResult> {
    return firstValueFrom(
      this.http.get<PatternResult>(`${this.api}/analysis/${symbol}/patterns?timeframe=${timeframe}`),
    );
  }

  getLevels(symbol: string, timeframe = '4h'): Promise<LevelsResult> {
    return firstValueFrom(
      this.http.get<LevelsResult>(`${this.api}/analysis/${symbol}/levels?timeframe=${timeframe}`),
    );
  }
}
