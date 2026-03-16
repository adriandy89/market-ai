import { RSI, MACD, BollingerBands, EMA, SMA, Stochastic } from 'technicalindicators';
import type { UTCTimestamp, LineData, HistogramData } from 'lightweight-charts';

interface OhlcInput {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

function toLine(values: number[], times: number[], offset: number): LineData[] {
  return values.map((v, i) => ({
    time: times[i + offset] as UTCTimestamp,
    value: v,
  }));
}

export function calcEMA(data: OhlcInput[], period: number): LineData[] {
  const closes = data.map(d => d.close);
  const times = data.map(d => d.time);
  const values = EMA.calculate({ values: closes, period });
  return toLine(values, times, closes.length - values.length);
}

export function calcSMA(data: OhlcInput[], period: number): LineData[] {
  const closes = data.map(d => d.close);
  const times = data.map(d => d.time);
  const values = SMA.calculate({ values: closes, period });
  return toLine(values, times, closes.length - values.length);
}

export function calcRSI(data: OhlcInput[], period = 14): LineData[] {
  const closes = data.map(d => d.close);
  const times = data.map(d => d.time);
  const values = RSI.calculate({ values: closes, period });
  return toLine(values, times, closes.length - values.length);
}

export function calcMACD(data: OhlcInput[]): {
  macd: LineData[];
  signal: LineData[];
  histogram: HistogramData[];
} {
  const closes = data.map(d => d.close);
  const times = data.map(d => d.time);
  const result = MACD.calculate({
    values: closes,
    fastPeriod: 12,
    slowPeriod: 26,
    signalPeriod: 9,
    SimpleMAOscillator: false,
    SimpleMASignal: false,
  });
  const offset = closes.length - result.length;

  return {
    macd: result.map((r, i) => ({
      time: times[i + offset] as UTCTimestamp,
      value: r.MACD ?? 0,
    })),
    signal: result.map((r, i) => ({
      time: times[i + offset] as UTCTimestamp,
      value: r.signal ?? 0,
    })),
    histogram: result.map((r, i) => ({
      time: times[i + offset] as UTCTimestamp,
      value: r.histogram ?? 0,
      color: (r.histogram ?? 0) >= 0 ? '#26a69a' : '#ef5350',
    })),
  };
}

export function calcBollingerBands(data: OhlcInput[]): {
  upper: LineData[];
  middle: LineData[];
  lower: LineData[];
} {
  const closes = data.map(d => d.close);
  const times = data.map(d => d.time);
  const result = BollingerBands.calculate({ period: 20, values: closes, stdDev: 2 });
  const offset = closes.length - result.length;

  return {
    upper: result.map((r, i) => ({ time: times[i + offset] as UTCTimestamp, value: r.upper })),
    middle: result.map((r, i) => ({ time: times[i + offset] as UTCTimestamp, value: r.middle })),
    lower: result.map((r, i) => ({ time: times[i + offset] as UTCTimestamp, value: r.lower })),
  };
}

export function calcStochastic(data: OhlcInput[]): { k: LineData[]; d: LineData[] } {
  const highs = data.map(d => d.high);
  const lows = data.map(d => d.low);
  const closes = data.map(d => d.close);
  const times = data.map(d => d.time);
  const result = Stochastic.calculate({ high: highs, low: lows, close: closes, period: 14, signalPeriod: 3 });
  const offset = closes.length - result.length;

  return {
    k: result.map((r, i) => ({ time: times[i + offset] as UTCTimestamp, value: r.k })),
    d: result.map((r, i) => ({ time: times[i + offset] as UTCTimestamp, value: r.d })),
  };
}
