import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  effect,
  input,
  output,
  signal,
  viewChild,
  OnDestroy,
} from '@angular/core';
import {
  createChart,
  CandlestickSeries,
  LineSeries,
  HistogramSeries,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
  CrosshairMode,
  ColorType,
  LineStyle,
} from 'lightweight-charts';
import type { Kline } from '../../core/services/crypto.service';
import {
  calcEMA,
  calcSMA,
  calcRSI,
  calcMACD,
  calcBollingerBands,
  calcStochastic,
} from './indicators.util';

const TIMEFRAMES = ['15m', '30m', '1h', '4h', '1d', '1w'] as const;

interface IndicatorDef {
  key: string;
  label: string;
  pane: 'main' | 'sub';
}

const INDICATORS: IndicatorDef[] = [
  { key: 'ema9', label: 'EMA 9', pane: 'main' },
  { key: 'ema21', label: 'EMA 21', pane: 'main' },
  { key: 'sma50', label: 'SMA 50', pane: 'main' },
  { key: 'sma200', label: 'SMA 200', pane: 'main' },
  { key: 'bb', label: 'Bollinger', pane: 'main' },
  { key: 'rsi', label: 'RSI', pane: 'sub' },
  { key: 'macd', label: 'MACD', pane: 'sub' },
  { key: 'stoch', label: 'Stoch', pane: 'sub' },
];

@Component({
  selector: 'app-trading-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mb-3 flex flex-wrap items-center gap-2">
      <!-- Timeframe selector -->
      <div class="flex gap-1 mr-4">
        @for (tf of timeframes; track tf) {
          <button
            (click)="onTimeframeChange(tf)"
            class="px-3 py-1.5 text-xs font-medium rounded transition-colors"
            [class]="activeTimeframe() === tf
              ? 'bg-[var(--color-primary)] text-[var(--color-primary-foreground)]'
              : 'bg-[var(--color-secondary)] text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]'"
          >{{ tf.toUpperCase() }}</button>
        }
      </div>

      <!-- Indicator toggles -->
      <div class="flex flex-wrap gap-1">
        @for (ind of indicators; track ind.key) {
          <button
            (click)="toggleIndicator(ind.key)"
            class="px-2.5 py-1 text-xs font-medium rounded border transition-colors"
            [class]="enabled().has(ind.key)
              ? 'border-[var(--color-primary)] text-[var(--color-primary)] bg-[var(--color-primary)]/10'
              : 'border-[var(--color-border)] text-[var(--color-muted-foreground)] hover:border-[var(--color-muted-foreground)]'"
          >{{ ind.label }}</button>
        }
      </div>
    </div>

    <!-- Chart container -->
    <div class="relative w-full rounded border border-[var(--color-border)] overflow-hidden" style="height: 500px;">
      <!-- OHLCV Legend overlay -->
      @if (legend()) {
        <div class="absolute top-2 left-3 z-10 flex items-center gap-3 text-xs font-mono pointer-events-none">
          <span class="text-[var(--color-muted-foreground)]">O</span>
          <span [class]="legend()!.close >= legend()!.open ? 'text-[#22c55e]' : 'text-[#ef4444]'">{{ legend()!.open }}</span>
          <span class="text-[var(--color-muted-foreground)]">H</span>
          <span [class]="legend()!.close >= legend()!.open ? 'text-[#22c55e]' : 'text-[#ef4444]'">{{ legend()!.high }}</span>
          <span class="text-[var(--color-muted-foreground)]">L</span>
          <span [class]="legend()!.close >= legend()!.open ? 'text-[#22c55e]' : 'text-[#ef4444]'">{{ legend()!.low }}</span>
          <span class="text-[var(--color-muted-foreground)]">C</span>
          <span [class]="legend()!.close >= legend()!.open ? 'text-[#22c55e]' : 'text-[#ef4444]'">{{ legend()!.close }}</span>
          @if (legend()!.volume) {
            <span class="text-[var(--color-muted-foreground)] ml-2">Vol</span>
            <span class="text-[var(--color-foreground)]">{{ formatVol(legend()!.volume) }}</span>
          }
        </div>
      }
      <div #chartContainer class="w-full h-full"></div>
    </div>
  `,
})
export class TradingChart implements OnDestroy {
  ohlcData = input.required<Kline[]>();
  symbol = input<string>('BTC');
  activeTimeframe = input<string>('4h');
  timeframeChange = output<string>();
  loadMore = output<number>();

  readonly timeframes = TIMEFRAMES;
  readonly indicators = INDICATORS;
  enabled = signal<Set<string>>(new Set());
  legend = signal<{ open: number; high: number; low: number; close: number; volume: number } | null>(null);

  private chartEl = viewChild.required<ElementRef<HTMLElement>>('chartContainer');
  private chart: IChartApi | null = null;
  private candleSeries: ISeriesApi<'Candlestick'> | null = null;
  private seriesMap = new Map<string, ISeriesApi<any>[]>();
  private resizeObserver: ResizeObserver | null = null;
  private allData: Kline[] = [];
  private loadingMore = false;
  // WebSocket state
  private ws: WebSocket | null = null;
  private wsRetries = 0;
  private wsReconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly wsMaxRetries = 10;
  private wsDestroyed = false;
  private visibilityHandler: (() => void) | null = null;

  constructor() {
    effect(() => {
      const data = this.ohlcData();
      const el = this.chartEl();
      if (data.length > 0 && el) {
        this.buildChart(el.nativeElement, data);
      }
    });
  }

  ngOnDestroy() {
    this.disconnectWebSocket();
    this.resizeObserver?.disconnect();
    this.chart?.remove();
    this.chart = null;
  }

  onTimeframeChange(tf: string) {
    this.timeframeChange.emit(tf);
  }

  toggleIndicator(key: string) {
    const next = new Set(this.enabled());
    if (next.has(key)) {
      next.delete(key);
      this.removeIndicator(key);
    } else {
      next.add(key);
      this.addIndicator(key);
    }
    this.enabled.set(next);
  }

  prependData(olderKlines: Kline[]) {
    if (!olderKlines.length || !this.chart || !this.candleSeries) return;

    // Merge: older + existing, dedup by time
    const existingTimes = new Set(this.allData.map(k => k.time));
    const unique = olderKlines.filter(k => !existingTimes.has(k.time));
    if (!unique.length) { this.loadingMore = false; return; }

    this.allData = [...unique, ...this.allData].sort((a, b) => a.time - b.time);

    // Update candles
    this.candleSeries.setData(this.allData.map(k => ({
      time: k.time as UTCTimestamp,
      open: k.open, high: k.high, low: k.low, close: k.close,
    })));

    // Recalculate active indicators with full dataset
    for (const key of this.enabled()) {
      this.removeIndicator(key);
      this.addIndicatorFromData(key, this.allData);
    }

    this.loadingMore = false;
  }

  private buildChart(container: HTMLElement, data: Kline[]) {
    // Close old WS first to prevent stale messages hitting a destroyed chart
    this.disconnectWebSocket();
    this.wsDestroyed = false; // Allow new connection after disconnect

    this.resizeObserver?.disconnect();
    if (this.chart) {
      this.chart.remove();
      this.chart = null;
      this.candleSeries = null;
      this.seriesMap.clear();
    }

    this.allData = [...data];
    this.loadingMore = false;

    this.chart = createChart(container, {
      width: container.clientWidth,
      height: 500,
      layout: {
        background: { type: ColorType.Solid, color: '#0d1117' },
        textColor: '#6b7280',
        fontFamily: "'Inter', sans-serif",
      },
      grid: {
        vertLines: { color: '#1c2333' },
        horzLines: { color: '#1c2333' },
      },
      crosshair: { mode: CrosshairMode.Normal },
      timeScale: {
        borderColor: '#1c2333',
        timeVisible: true,
        secondsVisible: false,
      },
      rightPriceScale: { borderColor: '#1c2333' },
    });

    // Candlestick series (pane 0 = main)
    this.candleSeries = this.chart.addSeries(CandlestickSeries, {
      upColor: '#22c55e',
      downColor: '#ef4444',
      wickUpColor: '#22c55e',
      wickDownColor: '#ef4444',
      borderVisible: false,
    });

    this.candleSeries.setData(data.map(k => ({
      time: k.time as UTCTimestamp,
      open: k.open, high: k.high, low: k.low, close: k.close,
    })));

    this.chart.timeScale().fitContent();

    // Re-add enabled indicators
    for (const key of this.enabled()) {
      this.addIndicator(key);
    }

    // Infinite scroll: load older candles when user scrolls near the left edge
    this.chart.timeScale().subscribeVisibleLogicalRangeChange((range) => {
      if (!range || this.loadingMore || this.allData.length === 0) return;
      if (range.from <= 5) {
        this.loadingMore = true;
        this.loadMore.emit(this.allData[0].time);
      }
    });

    // OHLCV legend on crosshair move
    this.chart.subscribeCrosshairMove((param) => {
      if (!param.time || !this.candleSeries) {
        // Show last candle when mouse leaves
        const last = this.allData[this.allData.length - 1];
        if (last) this.legend.set({ open: last.open, high: last.high, low: last.low, close: last.close, volume: last.volume });
        return;
      }
      const d = param.seriesData.get(this.candleSeries) as any;
      if (d) this.legend.set({ open: d.open, high: d.high, low: d.low, close: d.close, volume: d.volume ?? 0 });
    });

    // Show last candle by default
    const last = data[data.length - 1];
    if (last) this.legend.set({ open: last.open, high: last.high, low: last.low, close: last.close, volume: last.volume });

    // Handle resize
    this.resizeObserver = new ResizeObserver(entries => {
      for (const entry of entries) {
        this.chart?.applyOptions({ width: entry.contentRect.width });
      }
    });
    this.resizeObserver.observe(container);

    // Real-time price via Binance WebSocket
    this.connectWebSocket();
  }

  private connectWebSocket() {
    if (this.wsDestroyed) return;
    this.ws?.close();

    const pair = this.symbol().toLowerCase() + 'usdt';
    const interval = this.activeTimeframe();
    const url = `wss://stream.binance.com:9443/ws/${pair}@kline_${interval}`;

    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      this.wsRetries = 0; // Reset backoff on successful connection
    };

    this.ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (!msg.k || !this.candleSeries) return;

      const k = msg.k;
      const time = Math.floor(k.t / 1000) as UTCTimestamp;
      const candle = {
        time,
        open: parseFloat(k.o),
        high: parseFloat(k.h),
        low: parseFloat(k.l),
        close: parseFloat(k.c),
      };
      const volume = parseFloat(k.v);

      // Update chart
      this.candleSeries.update(candle);

      // Update legend
      this.legend.set({ ...candle, volume });

      // Sync allData
      if (this.allData.length > 0) {
        const last = this.allData[this.allData.length - 1];
        if (last.time === time) {
          // Update current candle in-place
          last.open = candle.open;
          last.high = candle.high;
          last.low = candle.low;
          last.close = candle.close;
          last.volume = volume;
        } else {
          // New candle started — push it
          this.allData.push({ time, open: candle.open, high: candle.high, low: candle.low, close: candle.close, volume });
        }
      }
    };

    this.ws.onclose = () => {
      this.ws = null;
      if (!this.wsDestroyed) this.scheduleReconnect();
    };

    this.ws.onerror = () => {
      this.ws?.close(); // Triggers onclose → scheduleReconnect
    };

    // Setup Page Visibility handler (once)
    if (!this.visibilityHandler) {
      this.visibilityHandler = () => {
        if (document.hidden) {
          // Tab hidden — close to save resources
          this.ws?.close();
          this.ws = null;
          if (this.wsReconnectTimer) { clearTimeout(this.wsReconnectTimer); this.wsReconnectTimer = null; }
        } else if (!this.wsDestroyed && !this.ws) {
          // Tab visible — reconnect immediately
          this.wsRetries = 0;
          this.connectWebSocket();
        }
      };
      document.addEventListener('visibilitychange', this.visibilityHandler);
    }
  }

  private scheduleReconnect() {
    if (this.wsDestroyed || this.wsRetries >= this.wsMaxRetries) return;
    const delay = Math.min(1000 * Math.pow(2, this.wsRetries), 30_000); // 1s → 2s → 4s → ... → max 30s
    this.wsRetries++;
    this.wsReconnectTimer = setTimeout(() => this.connectWebSocket(), delay);
  }

  private disconnectWebSocket() {
    this.wsDestroyed = true;
    if (this.wsReconnectTimer) { clearTimeout(this.wsReconnectTimer); this.wsReconnectTimer = null; }
    this.ws?.close();
    this.ws = null;
    if (this.visibilityHandler) {
      document.removeEventListener('visibilitychange', this.visibilityHandler);
      this.visibilityHandler = null;
    }
  }

  formatVol(v: number): string {
    if (!v) return '';
    if (v >= 1e9) return (v / 1e9).toFixed(2) + 'B';
    if (v >= 1e6) return (v / 1e6).toFixed(2) + 'M';
    if (v >= 1e3) return (v / 1e3).toFixed(1) + 'K';
    return v.toFixed(0);
  }

  private addIndicator(key: string) {
    this.addIndicatorFromData(key, this.allData.length ? this.allData : this.ohlcData());
  }

  private addIndicatorFromData(key: string, data: Kline[]) {
    if (!this.chart || !data.length) return;

    switch (key) {
      case 'ema9': this.addLineOverlay(key, calcEMA(data, 9), '#f59e0b'); break;
      case 'ema21': this.addLineOverlay(key, calcEMA(data, 21), '#3b82f6'); break;
      case 'sma50': this.addLineOverlay(key, calcSMA(data, 50), '#8b5cf6'); break;
      case 'sma200': this.addLineOverlay(key, calcSMA(data, 200), '#ec4899'); break;
      case 'bb': this.addBollingerBands(data); break;
      case 'rsi': this.addRSI(data); break;
      case 'macd': this.addMACD(data); break;
      case 'stoch': this.addStochastic(data); break;
    }
  }

  private addLineOverlay(key: string, lineData: any[], color: string) {
    if (!this.chart || lineData.length === 0) return;
    const series = this.chart.addSeries(LineSeries, {
      color,
      lineWidth: 2,
      crosshairMarkerVisible: false,
      lastValueVisible: false,
      priceLineVisible: false,
      priceScaleId: 'right',
    });
    series.setData(lineData);
    this.seriesMap.set(key, [series]);
  }

  private addBollingerBands(data: Kline[]) {
    if (!this.chart) return;
    const bb = calcBollingerBands(data);
    if (!bb.upper.length) return;

    const bbOpts = { lineWidth: 1 as const, crosshairMarkerVisible: false, lastValueVisible: false, priceLineVisible: false, priceScaleId: 'right' };
    const upper = this.chart.addSeries(LineSeries, { ...bbOpts, color: '#6366f1' });
    const middle = this.chart.addSeries(LineSeries, { ...bbOpts, color: '#6366f180', lineStyle: LineStyle.Dashed });
    const lower = this.chart.addSeries(LineSeries, { ...bbOpts, color: '#6366f1' });
    upper.setData(bb.upper);
    middle.setData(bb.middle);
    lower.setData(bb.lower);
    this.seriesMap.set('bb', [upper, middle, lower]);
  }

  private addRSI(data: Kline[]) {
    if (!this.chart) return;
    const rsiData = calcRSI(data);
    if (!rsiData.length) return;

    const subOpts = { crosshairMarkerVisible: false, lastValueVisible: false, priceLineVisible: false };
    const rsiSeries = this.chart.addSeries(LineSeries, { ...subOpts, color: '#f59e0b', lineWidth: 2, priceScaleId: 'rsi' }, 1);
    rsiSeries.setData(rsiData);

    const zoneOpts = { crosshairMarkerVisible: false, priceLineVisible: false, lineWidth: 1 as const, lineStyle: LineStyle.Dashed, priceScaleId: 'rsi', lastValueVisible: true };
    const line70 = this.chart.addSeries(LineSeries, { ...zoneOpts, color: '#ef444450' }, 1);
    const line30 = this.chart.addSeries(LineSeries, { ...zoneOpts, color: '#22c55e50' }, 1);
    line70.setData(rsiData.map((d: any) => ({ time: d.time, value: 70 })));
    line30.setData(rsiData.map((d: any) => ({ time: d.time, value: 30 })));

    this.seriesMap.set('rsi', [rsiSeries, line70, line30]);
  }

  private addMACD(data: Kline[]) {
    if (!this.chart) return;
    const macdData = calcMACD(data);
    if (!macdData.macd.length) return;

    const subOpts = { crosshairMarkerVisible: false, lastValueVisible: false, priceLineVisible: false };
    const histSeries = this.chart.addSeries(HistogramSeries, { ...subOpts, priceScaleId: 'macd' }, 2);
    histSeries.setData(macdData.histogram);

    const macdLine = this.chart.addSeries(LineSeries, { ...subOpts, color: '#3b82f6', lineWidth: 2, priceScaleId: 'macd' }, 2);
    const signalLine = this.chart.addSeries(LineSeries, { ...subOpts, color: '#ef4444', lineWidth: 1, priceScaleId: 'macd' }, 2);
    macdLine.setData(macdData.macd);
    signalLine.setData(macdData.signal);

    this.seriesMap.set('macd', [histSeries, macdLine, signalLine]);
  }

  private addStochastic(data: Kline[]) {
    if (!this.chart) return;
    const stochData = calcStochastic(data);
    if (!stochData.k.length) return;

    const subOpts = { crosshairMarkerVisible: false, lastValueVisible: false, priceLineVisible: false };
    const kLine = this.chart.addSeries(LineSeries, { ...subOpts, color: '#10b981', lineWidth: 2, priceScaleId: 'stoch' }, 3);
    const dLine = this.chart.addSeries(LineSeries, { ...subOpts, color: '#f59e0b', lineWidth: 1, priceScaleId: 'stoch' }, 3);
    kLine.setData(stochData.k);
    dLine.setData(stochData.d);

    const zoneOpts = { ...subOpts, lineWidth: 1 as const, lineStyle: LineStyle.Dashed, priceScaleId: 'stoch' };
    const zone80 = this.chart.addSeries(LineSeries, { ...zoneOpts, color: '#ef444450' }, 3);
    const zone20 = this.chart.addSeries(LineSeries, { ...zoneOpts, color: '#22c55e50' }, 3);
    zone80.setData(stochData.k.map((d: any) => ({ time: d.time, value: 80 })));
    zone20.setData(stochData.k.map((d: any) => ({ time: d.time, value: 20 })));

    this.seriesMap.set('stoch', [kLine, dLine, zone80, zone20]);
  }

  private removeIndicator(key: string) {
    const series = this.seriesMap.get(key);
    if (series && this.chart) {
      for (const s of series) {
        this.chart.removeSeries(s);
      }
      this.seriesMap.delete(key);
    }
  }
}
