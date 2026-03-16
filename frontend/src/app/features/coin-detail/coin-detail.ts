import { ChangeDetectionStrategy, Component, inject, signal, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { DecimalPipe } from '@angular/common';
import { CryptoApiService } from '../../core/services/crypto.service';
import { AiApiService } from '../../core/services/ai.service';

@Component({
  selector: 'app-coin-detail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DecimalPipe],
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
            <span class="text-3xl font-bold font-mono">\${{ price()!.price | number:'1.2-2' }}</span>
            <span class="text-lg font-mono" [class]="price()!.change24h >= 0 ? 'price-up' : 'price-down'">
              {{ price()!.change24h >= 0 ? '+' : '' }}{{ price()!.change24h | number:'1.2-2' }}%
            </span>
          </div>
          <p class="text-sm text-[var(--color-muted-foreground)] mt-1">
            Vol: \${{ formatNum(price()!.volume24h) }} · MCap: \${{ formatNum(price()!.marketCap) }}
          </p>
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
                  <span class="font-mono">\${{ r.price | number:'1.2-2' }}</span>
                </div>
              }
              <div class="flex justify-between font-semibold border-y border-[var(--color-border)] py-2 my-2">
                <span>Pivot</span>
                <span class="font-mono">\${{ levels()!.pivot | number:'1.2-2' }}</span>
              </div>
              @for (s of levels()!.support; track s.level) {
                <div class="flex justify-between">
                  <span class="text-[var(--color-bull)]">{{ s.level }}</span>
                  <span class="font-mono">\${{ s.price | number:'1.2-2' }}</span>
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
  private readonly aiApi = inject(AiApiService);

  symbol = signal('');
  price = signal<any>(null);
  indicators = signal<any>(null);
  levels = signal<any>(null);
  patterns = signal<any[]>([]);
  generating = signal(false);

  async ngOnInit() {
    const sym = this.route.snapshot.paramMap.get('symbol')?.toUpperCase() || '';
    this.symbol.set(sym);

    // Load all data in parallel
    const [priceData, indData, levelsData, patternsData] = await Promise.allSettled([
      fetch(`/api/v1/crypto/price/${sym}`).then(r => r.json()),
      fetch(`/api/v1/analysis/${sym}/indicators`).then(r => r.json()),
      fetch(`/api/v1/analysis/${sym}/levels`).then(r => r.json()),
      fetch(`/api/v1/analysis/${sym}/patterns`).then(r => r.json()),
    ]);

    if (priceData.status === 'fulfilled') this.price.set(priceData.value);
    if (indData.status === 'fulfilled') this.indicators.set(indData.value?.indicators);
    if (levelsData.status === 'fulfilled') this.levels.set(levelsData.value);
    if (patternsData.status === 'fulfilled') this.patterns.set(patternsData.value?.patterns || []);
  }

  async onGenerateReport() {
    this.generating.set(true);
    try {
      const report = await this.aiApi.generateReport(this.symbol());
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

  formatNum(val: number): string {
    if (!val) return '—';
    if (val >= 1e12) return (val / 1e12).toFixed(2) + 'T';
    if (val >= 1e9) return (val / 1e9).toFixed(2) + 'B';
    if (val >= 1e6) return (val / 1e6).toFixed(2) + 'M';
    return val.toLocaleString();
  }
}
