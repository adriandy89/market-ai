import { ChangeDetectionStrategy, Component, inject, signal, computed, viewChild, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { DecimalPipe, DatePipe } from '@angular/common';
import { CryptoApiService, type Kline } from '../../core/services/crypto.service';
import { AnalysisApiService } from '../../core/services/analysis.service';
import { AiApiService, type AiReport } from '../../core/services/ai.service';
import { MarketContextApiService, type SentimentContext, type NewsItem } from '../../core/services/market-context.service';
import { TranslocoPipe } from '@jsverse/transloco';
import { TradingChart } from '../../shared/trading-chart/trading-chart';
import { formatPrice, formatPct, formatCompact } from '../../shared/utils/format';

@Component({
  selector: 'app-coin-detail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TradingChart, DecimalPipe, DatePipe, RouterLink, TranslocoPipe],
  template: `
    <div class="animate-fade-in">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <h1 class="text-xl sm:text-2xl font-bold">{{ symbol() }} {{ 'coin.analysis' | transloco }}</h1>
        <div class="flex gap-2">
          <button (click)="onGenerateReport()" class="btn-primary text-xs sm:text-sm flex-1 sm:flex-initial" [disabled]="generating()">
            {{ generating() ? ('coin.generating' | transloco) : ('coin.ai_report' | transloco) }}
          </button>
          <button (click)="onGenerateComprehensive()" class="btn-primary !bg-[var(--color-accent)] !text-[var(--color-background)] text-xs sm:text-sm flex-1 sm:flex-initial" [disabled]="generatingComprehensive()">
            {{ generatingComprehensive() ? ('coin.analyzing' | transloco) : ('coin.comprehensive_report' | transloco) }}
          </button>
        </div>
      </div>

      <!-- Price Card -->
      @if (price()) {
        <div class="card mb-6">
          <div class="flex items-baseline gap-3 sm:gap-4">
            <span class="text-2xl sm:text-3xl font-bold font-mono">\${{ fp(price()!.price) }}</span>
            <span class="text-lg font-mono" [class]="price()!.change24h >= 0 ? 'price-up' : 'price-down'">
              {{ price()!.change24h >= 0 ? '+' : '' }}{{ fpct(price()!.change24h) }}%
            </span>
          </div>
          <p class="text-sm text-[var(--color-muted-foreground)] mt-1">
            Vol: \${{ fc(price()!.volume24h) }} · MCap: \${{ fc(price()!.marketCap) }}
          </p>
        </div>
      }

      <!-- Sentiment Mini-Card -->
      @if (sentiment()) {
        <div class="card mb-6">
          <div class="flex flex-wrap items-center gap-4 sm:gap-6 text-sm">
            <div>
              <span class="text-[var(--color-muted-foreground)]">{{ 'coin.fear_greed' | transloco }}</span>
              <span class="ml-2 font-bold font-mono text-lg"
                [class]="sentiment()!.fearGreedIndex.value > 60 ? 'text-[var(--color-bull)]' : sentiment()!.fearGreedIndex.value < 40 ? 'text-[var(--color-bear)]' : 'text-[var(--color-accent)]'">
                {{ sentiment()!.fearGreedIndex.value }}
              </span>
              <span class="ml-1 text-[var(--color-muted-foreground)]">({{ sentiment()!.fearGreedIndex.classification }})</span>
            </div>
            @if (sentiment()!.globalMarket.btcDominance) {
              <div>
                <span class="text-[var(--color-muted-foreground)]">{{ 'coin.btc_dom' | transloco }}</span>
                <span class="ml-2 font-mono font-medium">{{ sentiment()!.globalMarket.btcDominance | number:'1.1-1' }}%</span>
              </div>
            }
            @if (sentiment()!.globalMarket.marketCapChange24h) {
              <div>
                <span class="text-[var(--color-muted-foreground)]">{{ 'coin.market_24h' | transloco }}</span>
                <span class="ml-2 font-mono" [class]="sentiment()!.globalMarket.marketCapChange24h >= 0 ? 'price-up' : 'price-down'">
                  {{ sentiment()!.globalMarket.marketCapChange24h >= 0 ? '+' : '' }}{{ sentiment()!.globalMarket.marketCapChange24h | number:'1.1-2' }}%
                </span>
              </div>
            }
          </div>
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
      } @else if (chartUnavailable()) {
        <div class="card mb-6 flex items-center justify-center py-8 sm:py-12">
          <p class="text-[var(--color-muted-foreground)] text-sm">{{ symbol() }} chart not available on Binance</p>
        </div>
      } @else {
        <div class="card mb-6 flex items-center justify-center h-[300px] sm:h-[400px] md:h-[500px]">
          <p class="text-[var(--color-muted-foreground)]">{{ 'common.loading_chart' | transloco }}</p>
        </div>
      }

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <!-- Technical Indicators -->
        <div class="card">
          <h2 class="text-lg font-semibold mb-4">{{ 'coin.technical_indicators' | transloco }}</h2>
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
          <h2 class="text-lg font-semibold mb-4">{{ 'coin.support_resistance' | transloco }}</h2>
          @if (levels()) {
            <div class="space-y-2 text-sm">
              @for (r of levels()!.resistance; track r.level) {
                <div class="flex justify-between">
                  <span class="text-[var(--color-bear)]">{{ r.level }}</span>
                  <span class="font-mono">\${{ fp(r.price) }}</span>
                </div>
              }
              <div class="flex justify-between font-semibold border-y border-[var(--color-border)] py-2 my-2">
                <span>{{ 'coin.pivot' | transloco }}</span>
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
          <h2 class="text-lg font-semibold mb-4">{{ 'coin.detected_patterns' | transloco }}</h2>
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

      <!-- News Feed -->
      @if (news().length > 0) {
        <div class="card mt-6">
          <h2 class="text-lg font-semibold mb-4">{{ 'coin.recent_news' | transloco }}</h2>
          <div class="space-y-3">
            @for (n of news(); track n.url) {
              <a [href]="n.url" target="_blank" rel="noopener" class="flex items-start gap-3 text-sm hover:bg-[var(--color-muted)]/30 rounded p-2 -mx-2 transition-colors">
                <span class="w-2 h-2 rounded-full mt-1.5 shrink-0 bg-[var(--color-muted-foreground)]"></span>
                <div class="min-w-0">
                  <p class="text-[var(--color-foreground)] line-clamp-1">{{ n.title }}</p>
                  <span class="text-xs text-[var(--color-muted-foreground)]">{{ n.source }}</span>
                </div>
              </a>
            }
          </div>
        </div>
      }

      <!-- Report History -->
      <div class="card mt-6">
        <h2 class="text-lg font-semibold mb-4">{{ 'coin.report_history' | transloco }}</h2>
        @if (loadingReports()) {
          <p class="text-[var(--color-muted-foreground)] text-sm">{{ 'common.loading_reports' | transloco }}</p>
        } @else if (reportHistory().length === 0) {
          <p class="text-[var(--color-muted-foreground)] text-sm">{{ 'coin.no_reports' | transloco }} {{ symbol() }}.</p>
        } @else {
          <div class="space-y-2">
            @for (r of reportHistory(); track r.id) {
              <a [routerLink]="['/reports', r.id]"
                 class="flex items-center justify-between text-sm hover:bg-[var(--color-muted)]/30 rounded p-2 -mx-2 transition-colors">
                <div class="flex items-center gap-2 min-w-0">
                  @if (r.report_type === 'comprehensive') {
                    <span class="text-xs px-1.5 py-0.5 rounded bg-[var(--color-accent)]/20 text-[var(--color-accent)] shrink-0">Comprehensive</span>
                  } @else {
                    <span class="text-xs px-1.5 py-0.5 rounded bg-[var(--color-muted)] text-[var(--color-muted-foreground)] shrink-0">Standard</span>
                  }
                  <span class="text-[var(--color-muted-foreground)] shrink-0">{{ r.timeframe === 'multi' ? '4h·1d·1w' : r.timeframe }}</span>
                  <span class="truncate text-[var(--color-foreground)]">{{ r.content?.aiSummary || r.content?.aiAnalysis?.executiveSummary || r.content?.aiAnalysis?.summary || '' }}</span>
                </div>
                <span class="text-xs text-[var(--color-muted-foreground)] shrink-0 ml-3">{{ r.created_at | date:'short' }}</span>
              </a>
            }
          </div>

          <!-- Pagination -->
          @if (reportTotal() > 5) {
            <div class="flex items-center justify-between mt-4 pt-3 border-t border-[var(--color-border)]">
              <button (click)="loadReportHistory(reportPage() - 1)" [disabled]="reportPage() <= 1"
                class="text-sm text-[var(--color-primary)] disabled:opacity-30 disabled:cursor-default hover:underline">
                &larr; Prev
              </button>
              <span class="text-xs text-[var(--color-muted-foreground)]">
                Page {{ reportPage() }} of {{ reportTotalPages() }}
              </span>
              <button (click)="loadReportHistory(reportPage() + 1)" [disabled]="reportPage() >= reportTotalPages()"
                class="text-sm text-[var(--color-primary)] disabled:opacity-30 disabled:cursor-default hover:underline">
                Next &rarr;
              </button>
            </div>
          }
        }
      </div>
    </div>
  `,
})
export class CoinDetail implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly cryptoApi = inject(CryptoApiService);
  private readonly analysisApi = inject(AnalysisApiService);
  private readonly aiApi = inject(AiApiService);
  private readonly marketContextApi = inject(MarketContextApiService);

  private tradingChart = viewChild<TradingChart>('tradingChart');

  symbol = signal('');
  price = signal<any>(null);
  indicators = signal<any>(null);
  levels = signal<any>(null);
  patterns = signal<any[]>([]);
  klines = signal<Kline[]>([]);
  chartUnavailable = signal(false);
  timeframe = signal('4h');
  generating = signal(false);
  generatingComprehensive = signal(false);
  sentiment = signal<SentimentContext | null>(null);
  news = signal<NewsItem[]>([]);
  reportHistory = signal<AiReport[]>([]);
  reportPage = signal(1);
  reportTotal = signal(0);
  loadingReports = signal(false);
  reportTotalPages = computed(() => Math.ceil(this.reportTotal() / 5) || 1);

  async ngOnInit() {
    const sym = this.route.snapshot.paramMap.get('symbol')?.toUpperCase() || '';
    this.symbol.set(sym);

    const tf = this.timeframe();
    // Load all data in parallel
    const [priceData, klinesData, sentimentData, newsData] = await Promise.allSettled([
      this.cryptoApi.getCoinPrice(sym),
      this.cryptoApi.getKlines(sym, tf, 300),
      this.marketContextApi.getSentiment(),
      this.marketContextApi.getNews(sym),
    ]);

    if (priceData.status === 'fulfilled') this.price.set(priceData.value);
    if (klinesData.status === 'fulfilled' && klinesData.value?.data?.length) {
      this.klines.set(klinesData.value.data);
    } else {
      this.chartUnavailable.set(true);
    }
    if (sentimentData.status === 'fulfilled') this.sentiment.set(sentimentData.value);
    if (newsData.status === 'fulfilled') this.news.set(newsData.value?.items || []);

    // Load analysis data and report history
    await this.loadAnalysis(sym, tf);
    this.loadReportHistory();
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

  async loadReportHistory(page = 1) {
    this.loadingReports.set(true);
    try {
      const result = await this.aiApi.getReports(page, 5, this.symbol());
      this.reportHistory.set(result.data);
      this.reportPage.set(page);
      this.reportTotal.set(result.meta.itemCount);
    } catch (err) {
      console.error('Failed to load report history:', err);
    } finally {
      this.loadingReports.set(false);
    }
  }

  async onGenerateReport() {
    this.generating.set(true);
    try {
      const report = await this.aiApi.generateReport(this.symbol(), this.timeframe());
      await this.loadReportHistory();
      this.router.navigate(['/reports', report.id]);
    } catch (err) {
      console.error('Failed to generate report:', err);
    } finally {
      this.generating.set(false);
    }
  }

  async onGenerateComprehensive() {
    this.generatingComprehensive.set(true);
    try {
      const report = await this.aiApi.generateComprehensiveReport(this.symbol());
      await this.loadReportHistory();
      this.router.navigate(['/reports', report.id]);
    } catch (err) {
      console.error('Failed to generate comprehensive report:', err);
    } finally {
      this.generatingComprehensive.set(false);
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
