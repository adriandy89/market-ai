import { ChangeDetectionStrategy, Component, inject, signal, viewChild, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CryptoApiService, type Kline } from '../../core/services/crypto.service';
import { AnalysisApiService } from '../../core/services/analysis.service';
import { AiApiService } from '../../core/services/ai.service';
import { TradingChart } from '../../shared/trading-chart/trading-chart';
import { formatPrice, formatPct, formatCompact } from '../../shared/utils/format';

@Component({
  selector: 'app-coin-detail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TradingChart],
  template: `
    <div class="animate-fade-in">
      <div class="flex items-center justify-between mb-6">
        <h1 class="text-2xl font-bold">{{ symbol() }} Analysis</h1>
        <button (click)="onGenerateReport()" class="btn-primary" [disabled]="generating()">
          {{ generating() ? 'Generating...' : 'Generate AI Report' }}
        </button>
      </div>

      <!-- Price Card -->
      @if (price()) {
        <div class="card mb-6">
          <div class="flex items-baseline gap-4">
            <span class="text-3xl font-bold font-mono">\${{ fp(price()!.price) }}</span>
            <span class="text-lg font-mono" [class]="price()!.change24h >= 0 ? 'price-up' : 'price-down'">
              {{ price()!.change24h >= 0 ? '+' : '' }}{{ fpct(price()!.change24h) }}%
            </span>
          </div>
          <p class="text-sm text-[var(--color-muted-foreground)] mt-1">
            Vol: \${{ fc(price()!.volume24h) }} · MCap: \${{ fc(price()!.marketCap) }}
          </p>
        </div>
      }

      <!-- Trading Chart -->
      @if (klines().length > 0) {
        <div class="card mb-6 !p-3">
          <app-trading-chart #tradingChart
            [ohlcData]="klines()"
            [symbol]="symbol()"
            [activeTimeframe]="timeframe()"
            (timeframeChange)="onTimeframeChange($event)"
            (loadMore)="onLoadMore($event)"
          />
        </div>
      } @else {
        <div class="card mb-6 flex items-center justify-center" style="height: 500px;">
          <p class="text-[var(--color-muted-foreground)]">Loading chart...</p>
        </div>
      }

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <!-- Technical Indicators -->
        <div class="card">
          <h2 class="text-lg font-semibold mb-4">Technical Indicators</h2>
          @if (indicators()) {
            <div class="space-y-3 text-sm">
              @if (indicators()!.rsi) {
                <div class="flex justify-between">
                  <span>RSI (14)</span>
                  <span class="font-mono" [class]="getSignalClass(indicators()!.rsi.signal)">
                    {{ indicators()!.rsi.value }} · {{ indicators()!.rsi.signal }}
                  </span>
                </div>
              }
              @if (indicators()!.macd) {
                <div class="flex justify-between">
                  <span>MACD</span>
                  <span class="font-mono" [class]="getSignalClass(indicators()!.macd.trend)">
                    {{ indicators()!.macd.histogram }} · {{ indicators()!.macd.trend }}
                  </span>
                </div>
              }
              @if (indicators()!.stochastic) {
                <div class="flex justify-between">
                  <span>Stochastic</span>
                  <span class="font-mono" [class]="getSignalClass(indicators()!.stochastic.signal)">
                    K:{{ indicators()!.stochastic.k }} D:{{ indicators()!.stochastic.d }} · {{ indicators()!.stochastic.signal }}
                  </span>
                </div>
              }
              @if (indicators()!.adx) {
                <div class="flex justify-between">
                  <span>ADX</span>
                  <span class="font-mono">{{ indicators()!.adx.adx }} · {{ indicators()!.adx.trendStrength }}</span>
                </div>
              }
              @if (indicators()!.bollingerBands) {
                <div class="flex justify-between">
                  <span>Bollinger Bands</span>
                  <span class="font-mono text-xs">
                    L:{{ indicators()!.bollingerBands.lower }} M:{{ indicators()!.bollingerBands.middle }} U:{{ indicators()!.bollingerBands.upper }}
                  </span>
                </div>
              }
            </div>
          } @else {
            <p class="text-[var(--color-muted-foreground)]">Loading indicators...</p>
          }
        </div>

        <!-- Support / Resistance -->
        <div class="card">
          <h2 class="text-lg font-semibold mb-4">Support & Resistance</h2>
          @if (levels()) {
            <div class="space-y-2 text-sm">
              @for (r of levels()!.resistance; track r.level) {
                <div class="flex justify-between">
                  <span class="text-[var(--color-bear)]">{{ r.level }}</span>
                  <span class="font-mono">\${{ fp(r.price) }}</span>
                </div>
              }
              <div class="flex justify-between font-semibold border-y border-[var(--color-border)] py-2 my-2">
                <span>Pivot</span>
                <span class="font-mono">\${{ fp(levels()!.pivot) }}</span>
              </div>
              @for (s of levels()!.support; track s.level) {
                <div class="flex justify-between">
                  <span class="text-[var(--color-bull)]">{{ s.level }}</span>
                  <span class="font-mono">\${{ fp(s.price) }}</span>
                </div>
              }
            </div>
          } @else {
            <p class="text-[var(--color-muted-foreground)]">Loading levels...</p>
          }
        </div>
      </div>

      <!-- Patterns -->
      @if (patterns() && patterns()!.length > 0) {
        <div class="card mt-6">
          <h2 class="text-lg font-semibold mb-4">Detected Patterns</h2>
          <div class="flex flex-wrap gap-2">
            @for (p of patterns()!; track p.name + p.index) {
              <span class="px-3 py-1 rounded text-xs font-medium"
                [class]="p.type === 'bullish' ? 'bg-[var(--color-bull)]/15 text-[var(--color-bull)]' : p.type === 'bearish' ? 'bg-[var(--color-bear)]/15 text-[var(--color-bear)]' : 'bg-[var(--color-muted)] text-[var(--color-muted-foreground)]'">
                {{ p.name }}
              </span>
            }
          </div>
        </div>
      }
    </div>
  `,
})
export class CoinDetail implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly cryptoApi = inject(CryptoApiService);
  private readonly analysisApi = inject(AnalysisApiService);
  private readonly aiApi = inject(AiApiService);

  private tradingChart = viewChild<TradingChart>('tradingChart');

  symbol = signal('');
  price = signal<any>(null);
  indicators = signal<any>(null);
  levels = signal<any>(null);
  patterns = signal<any[]>([]);
  klines = signal<Kline[]>([]);
  timeframe = signal('4h');
  generating = signal(false);

  async ngOnInit() {
    const sym = this.route.snapshot.paramMap.get('symbol')?.toUpperCase() || '';
    this.symbol.set(sym);

    const tf = this.timeframe();
    // Load all data in parallel
    const [priceData, klinesData] = await Promise.allSettled([
      this.cryptoApi.getCoinPrice(sym),
      this.cryptoApi.getKlines(sym, tf, 300),
    ]);

    if (priceData.status === 'fulfilled') this.price.set(priceData.value);
    if (klinesData.status === 'fulfilled') this.klines.set(klinesData.value?.data || []);

    // Load analysis data with timeframe
    await this.loadAnalysis(sym, tf);
  }

  async onTimeframeChange(tf: string) {
    this.timeframe.set(tf);
    const sym = this.symbol();
    try {
      // Reload chart + analysis in parallel
      const [klinesData] = await Promise.allSettled([
        this.cryptoApi.getKlines(sym, tf, 300),
      ]);
      if (klinesData.status === 'fulfilled') this.klines.set(klinesData.value?.data || []);
      await this.loadAnalysis(sym, tf);
    } catch (err) {
      console.error('Failed to load data:', err);
    }
  }

  private async loadAnalysis(sym: string, tf: string) {
    const [indData, levelsData, patternsData] = await Promise.allSettled([
      this.analysisApi.getIndicators(sym, tf),
      this.analysisApi.getLevels(sym, tf),
      this.analysisApi.getPatterns(sym, tf),
    ]);

    if (indData.status === 'fulfilled') this.indicators.set(indData.value?.indicators);
    if (levelsData.status === 'fulfilled') this.levels.set(levelsData.value);
    if (patternsData.status === 'fulfilled') this.patterns.set(patternsData.value?.patterns || []);
  }

  async onLoadMore(oldestTime: number) {
    try {
      const result = await this.cryptoApi.getKlines(this.symbol(), this.timeframe(), 300, oldestTime);
      this.tradingChart()?.prependData(result.data || []);
    } catch (err) {
      console.error('Failed to load more klines:', err);
    }
  }

  async onGenerateReport() {
    this.generating.set(true);
    try {
      const report = await this.aiApi.generateReport(this.symbol(), this.timeframe());
      this.router.navigate(['/reports', report.id]);
    } catch (err) {
      console.error('Failed to generate report:', err);
    } finally {
      this.generating.set(false);
    }
  }

  getSignalClass(signal: string | null): string {
    if (signal === 'overbought' || signal === 'bearish') return 'text-[var(--color-bear)]';
    if (signal === 'oversold' || signal === 'bullish') return 'text-[var(--color-bull)]';
    return 'text-[var(--color-muted-foreground)]';
  }

  fp = formatPrice;
  fpct = formatPct;
  fc = formatCompact;
}
