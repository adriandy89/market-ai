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
  { key: 'sr', label: 'S&R', pane: 'main' },
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
    <div #chartWrapper class="relative w-full rounded border border-[var(--color-border)] overflow-hidden h-[300px] sm:h-[400px] md:h-[500px]">
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
      <!-- Loading overlay -->
      @if (chartLoading()) {
        <div class="absolute inset-0 z-20 flex items-center justify-center bg-[#0d1117]/70 backdrop-blur-[1px]">
          <div class="flex items-center gap-2 text-sm text-[var(--color-muted-foreground)]">
            <svg class="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" class="opacity-25"></circle>
              <path d="M4 12a8 8 0 018-8" stroke="currentColor" stroke-width="3" stroke-linecap="round" class="opacity-75"></path>
            </svg>
            Loading...
          </div>
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
  // levels input removed — S&R calculated from allData (Binance klines)
  timeframeChange = output<string>();
  loadMore = output<number>();

  readonly timeframes = TIMEFRAMES;
  readonly indicators = INDICATORS;
  enabled = signal<Set<string>>(new Set());
  legend = signal<{ open: number; high: number; low: number; close: number; volume: number } | null>(null);
  chartLoading = signal(false);

  private chartEl = viewChild.required<ElementRef<HTMLElement>>('chartContainer');
  private chart: IChartApi | null = null;
  private candleSeries: ISeriesApi<'Candlestick'> | null = null;
  private seriesMap = new Map<string, ISeriesApi<any>[]>();
  private resizeObserver: ResizeObserver | null = null;
  private allData: Kline[] = [];
  private loadingMore = false;
  private priceLines: any[] = []; // IPriceLine refs for S&R
  // WebSocket state
  private ws: WebSocket | null = null;
  private wsConnId = 0; // Increments on each connect — stale handlers check this
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
        // Defer so Angular renders loading overlay before buildChart clears it
        setTimeout(() => this.buildChart(el.nativeElement, data), 0);
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
    this.chartLoading.set(true);
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

    const existingTimes = new Set(this.allData.map(k => k.time));
    const unique = olderKlines.filter(k => !existingTimes.has(k.time));
    if (!unique.length) { this.loadingMore = false; return; }

    this.allData = [...unique, ...this.allData].sort((a, b) => a.time - b.time);

    this.candleSeries.setData(this.allData.map(k => ({
      time: k.time as UTCTimestamp,
      open: k.open, high: k.high, low: k.low, close: k.close,
    })));

    for (const key of this.enabled()) {
      this.removeIndicator(key);
      this.addIndicatorFromData(key, this.allData);
    }

    this.loadingMore = false;
  }

  private buildChart(container: HTMLElement, data: Kline[]) {
    // Stop old WS cleanly
    this.disconnectWebSocket();

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
      height: container.parentElement?.clientHeight || container.clientHeight || 500,
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

    for (const key of this.enabled()) {
      this.addIndicator(key);
    }

    // Infinite scroll
    this.chart.timeScale().subscribeVisibleLogicalRangeChange((range) => {
      if (!range || this.loadingMore || this.allData.length === 0) return;
      if (range.from <= 5) {
        this.loadingMore = true;
        this.loadMore.emit(this.allData[0].time);
      }
    });

    // OHLCV legend
    this.chart.subscribeCrosshairMove((param) => {
      if (!param.time || !this.candleSeries) {
        const last = this.allData[this.allData.length - 1];
        if (last) this.legend.set({ open: last.open, high: last.high, low: last.low, close: last.close, volume: last.volume });
        return;
      }
      const d = param.seriesData.get(this.candleSeries) as any;
      if (d) this.legend.set({ open: d.open, high: d.high, low: d.low, close: d.close, volume: d.volume ?? 0 });
    });

    const last = data[data.length - 1];
    if (last) this.legend.set({ open: last.open, high: last.high, low: last.low, close: last.close, volume: last.volume });

    // Resize
    this.resizeObserver = new ResizeObserver(entries => {
      for (const entry of entries) {
        this.chart?.applyOptions({ width: entry.contentRect.width });
      }
    });
    this.resizeObserver.observe(container);

    // Clear loading AFTER chart is built
    this.chartLoading.set(false);

    // Start WS for real-time updates
    this.wsDestroyed = false;
    this.wsRetries = 0;
    this.connectWebSocket();
  }

  // ═══════════════ WEBSOCKET ═══════════════

  private connectWebSocket() {
    if (this.wsDestroyed) return;

    // Close previous if any (without triggering stale reconnect)
    if (this.ws) {
      const oldWs = this.ws;
      this.ws = null;
      oldWs.onclose = null;
      oldWs.onerror = null;
      oldWs.onmessage = null;
      oldWs.close();
    }

    const connId = ++this.wsConnId;
    const pair = this.symbol().toLowerCase() + 'usdt';
    const interval = this.activeTimeframe().toLowerCase();
    const url = `wss://stream.binance.com:9443/ws/${pair}@kline_${interval}`;

    const ws = new WebSocket(url);
    this.ws = ws;

    ws.onopen = () => {
      if (connId !== this.wsConnId) return;
      this.wsRetries = 0;
    };

    ws.onmessage = (event) => {
      if (connId !== this.wsConnId || !this.candleSeries) return;

      const msg = JSON.parse(event.data);
      if (!msg.k) return;

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

      this.candleSeries.update(candle);
      this.legend.set({ ...candle, volume });

      if (this.allData.length > 0) {
        const last = this.allData[this.allData.length - 1];
        if (last.time === time) {
          last.open = candle.open;
          last.high = candle.high;
          last.low = candle.low;
          last.close = candle.close;
          last.volume = volume;
        } else {
          this.allData.push({ time, open: candle.open, high: candle.high, low: candle.low, close: candle.close, volume });
        }
      }
    };

    ws.onclose = () => {
      if (connId !== this.wsConnId) return; // Stale — do nothing
      this.ws = null;
      if (!this.wsDestroyed) this.scheduleReconnect();
    };

    ws.onerror = () => {
      if (connId !== this.wsConnId) return;
      ws.close();
    };

    // Page Visibility handler (register once)
    if (!this.visibilityHandler) {
      this.visibilityHandler = () => {
        if (document.hidden) {
          // Pause WS when tab hidden
          if (this.ws) {
            const old = this.ws;
            this.ws = null;
            old.onclose = null;
            old.onerror = null;
            old.onmessage = null;
            old.close();
          }
          if (this.wsReconnectTimer) { clearTimeout(this.wsReconnectTimer); this.wsReconnectTimer = null; }
        } else if (!this.wsDestroyed && !this.ws) {
          this.wsRetries = 0;
          this.connectWebSocket();
        }
      };
      document.addEventListener('visibilitychange', this.visibilityHandler);
    }
  }

  private scheduleReconnect() {
    if (this.wsDestroyed || this.wsRetries >= this.wsMaxRetries) return;
    const delay = Math.min(1000 * Math.pow(2, this.wsRetries), 30_000);
    this.wsRetries++;
    this.wsReconnectTimer = setTimeout(() => this.connectWebSocket(), delay);
  }

  private disconnectWebSocket() {
    this.wsDestroyed = true;
    this.wsConnId++; // Invalidate all current handlers
    if (this.wsReconnectTimer) { clearTimeout(this.wsReconnectTimer); this.wsReconnectTimer = null; }
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.onerror = null;
      this.ws.onmessage = null;
      this.ws.close();
      this.ws = null;
    }
    if (this.visibilityHandler) {
      document.removeEventListener('visibilitychange', this.visibilityHandler);
      this.visibilityHandler = null;
    }
  }

  // ═══════════════ UTILS ═══════════════

  formatVol(v: number): string {
    if (!v) return '';
    if (v >= 1e9) return (v / 1e9).toFixed(2) + 'B';
    if (v >= 1e6) return (v / 1e6).toFixed(2) + 'M';
    if (v >= 1e3) return (v / 1e3).toFixed(1) + 'K';
    return v.toFixed(0);
  }

  // ═══════════════ INDICATORS ═══════════════

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
      case 'sr': this.addSupportResistance(); break;
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

  private addSupportResistance() {
    if (!this.candleSeries || this.allData.length < 2) return;

    this.removeSRLines();

    // Calculate pivots from last COMPLETED candle in allData
    const last = this.allData[this.allData.length - 2];
    const pivot = (last.high + last.low + last.close) / 3;
    const r1 = 2 * pivot - last.low;
    const s1 = 2 * pivot - last.high;
    const r2 = pivot + (last.high - last.low);
    const s2 = pivot - (last.high - last.low);
    const r3 = last.high + 2 * (pivot - last.low);
    const s3 = last.low - 2 * (last.high - pivot);

    const mkLine = (price: number, color: string, title: string, style: number) =>
      this.candleSeries!.createPriceLine({ price, color, lineWidth: 1, lineStyle: style, axisLabelVisible: false, title });

    this.priceLines.push(mkLine(r3, '#ef4444', 'R3', LineStyle.Dashed));
    this.priceLines.push(mkLine(r2, '#ef4444', 'R2', LineStyle.Dashed));
    this.priceLines.push(mkLine(r1, '#ef4444', 'R1', LineStyle.Dashed));
    this.priceLines.push(mkLine(pivot, '#6b7280', 'Pivot', LineStyle.Dotted));
    this.priceLines.push(mkLine(s1, '#22c55e', 'S1', LineStyle.Dashed));
    this.priceLines.push(mkLine(s2, '#22c55e', 'S2', LineStyle.Dashed));
    this.priceLines.push(mkLine(s3, '#22c55e', 'S3', LineStyle.Dashed));
  }

  private removeSRLines() {
    if (this.candleSeries) {
      for (const line of this.priceLines) {
        this.candleSeries.removePriceLine(line);
      }
    }
    this.priceLines = [];
  }

  private removeIndicator(key: string) {
    if (key === 'sr') { this.removeSRLines(); return; }
    const series = this.seriesMap.get(key);
    if (series && this.chart) {
      for (const s of series) {
        this.chart.removeSeries(s);
      }
      this.seriesMap.delete(key);
    }
  }
}
