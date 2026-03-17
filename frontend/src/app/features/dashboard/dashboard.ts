import { ChangeDetectionStrategy, Component, inject, signal, computed, OnInit, OnDestroy } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { SearchBar } from '../../shared/components/search-bar/search-bar';
import { CryptoApiService, type CoinMarket } from '../../core/services/crypto.service';
import { MarketContextApiService, type SentimentContext } from '../../core/services/market-context.service';
import { formatPrice, formatPct, formatCompact } from '../../shared/utils/format';

type SortKey = 'rank' | 'price' | 'change24h' | 'change7d' | 'marketCap';

@Component({
  selector: 'app-dashboard',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, TranslocoPipe, SearchBar, DecimalPipe],
  template: `
    <div class="animate-fade-in">
      <!-- Search -->
      <div class="mb-6 max-w-md">
        <app-search-bar />
      </div>

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

      <div class="card mb-6">
        <h2 class="text-lg font-semibold mb-4">{{ 'dashboard.top_crypto' | transloco }}</h2>
        @if (loading()) {
          <p class="text-[var(--color-muted-foreground)]">{{ 'common.loading_market' | transloco }}</p>
        } @else {
          <div class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead>
                <tr class="text-[var(--color-muted-foreground)] border-b border-[var(--color-border)]">
                  <th class="text-left py-2 pr-4 cursor-pointer select-none hover:text-[var(--color-foreground)] transition-colors" (click)="onSort('rank')">
                    # {{ sortIcon('rank') }}
                  </th>
                  <th class="text-left py-2 pr-4">{{ 'dashboard.name' | transloco }}</th>
                  <th class="text-right py-2 pr-4 cursor-pointer select-none hover:text-[var(--color-foreground)] transition-colors" (click)="onSort('price')">
                    {{ 'dashboard.price' | transloco }} {{ sortIcon('price') }}
                  </th>
                  <th class="text-right py-2 pr-4 cursor-pointer select-none hover:text-[var(--color-foreground)] transition-colors" (click)="onSort('change24h')">
                    {{ 'dashboard.change_24h' | transloco }} {{ sortIcon('change24h') }}
                  </th>
                  <th class="hidden md:table-cell text-right py-2 pr-4 cursor-pointer select-none hover:text-[var(--color-foreground)] transition-colors" (click)="onSort('change7d')">
                    {{ 'dashboard.change_7d' | transloco }} {{ sortIcon('change7d') }}
                  </th>
                  <th class="hidden lg:table-cell text-right py-2 pr-4 cursor-pointer select-none hover:text-[var(--color-foreground)] transition-colors" (click)="onSort('marketCap')">
                    {{ 'dashboard.market_cap' | transloco }} {{ sortIcon('marketCap') }}
                  </th>
                </tr>
              </thead>
              <tbody>
                @for (coin of sortedCoins(); track coin.symbol) {
                  <tr class="border-b border-[var(--color-border)]/50 hover:bg-[var(--color-secondary)]/50">
                    <td class="py-3 pr-4 text-[var(--color-muted-foreground)]">{{ coin.rank }}</td>
                    <td class="py-3 pr-4">
                      <a [routerLink]="['/coin', coin.symbol]" class="flex items-center gap-2 hover:text-[var(--color-primary)] transition-colors">
                        <img [src]="coin.image" [alt]="coin.name" class="w-6 h-6 rounded-full" />
                        <span class="font-medium">{{ coin.name }}</span>
                        <span class="text-[var(--color-muted-foreground)] text-xs">{{ coin.symbol }}</span>
                      </a>
                    </td>
                    <td class="py-3 pr-4 text-right font-mono">\${{ fp(coin.price) }}</td>
                    <td class="py-3 pr-4 text-right font-mono" [class]="coin.change24h >= 0 ? 'price-up' : 'price-down'">
                      {{ coin.change24h >= 0 ? '+' : '' }}{{ fpct(coin.change24h) }}%
                    </td>
                    <td class="hidden md:table-cell py-3 pr-4 text-right font-mono" [class]="coin.change7d >= 0 ? 'price-up' : 'price-down'">
                      {{ coin.change7d >= 0 ? '+' : '' }}{{ fpct(coin.change7d) }}%
                    </td>
                    <td class="hidden lg:table-cell py-3 pr-4 text-right font-mono">\${{ formatMarketCap(coin.marketCap) }}</td>
                    <td class="hidden sm:table-cell py-3 text-right">
                      <a [routerLink]="['/coin', coin.symbol]" class="text-[var(--color-primary)] hover:underline text-xs">
                        {{ 'dashboard.analyze' | transloco }}
                      </a>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      </div>
    </div>
  `,
})
export class Dashboard implements OnInit, OnDestroy {
  private readonly cryptoApi = inject(CryptoApiService);
  private readonly marketContextApi = inject(MarketContextApiService);

  coins = signal<CoinMarket[]>([]);
  sentiment = signal<SentimentContext | null>(null);
  loading = signal(true);
  sortKey = signal<SortKey | null>(null);
  sortDir = signal<'asc' | 'desc'>('desc');

  sortedCoins = computed(() => {
    const key = this.sortKey();
    if (!key) return this.coins();
    const list = [...this.coins()];
    const dir = this.sortDir() === 'asc' ? 1 : -1;
    return list.sort((a, b) => ((a[key] ?? 0) - (b[key] ?? 0)) * dir);
  });

  private refreshTimer: ReturnType<typeof setInterval> | null = null;
  private visibilityHandler: (() => void) | null = null;

  async ngOnInit() {
    this.loadSentiment();
    await this.loadCoins();
    this.refreshTimer = setInterval(() => this.loadCoins(), 15_000);
    this.visibilityHandler = () => {
      if (!document.hidden) this.loadCoins();
    };
    document.addEventListener('visibilitychange', this.visibilityHandler);
  }

  ngOnDestroy() {
    if (this.refreshTimer) clearInterval(this.refreshTimer);
    if (this.visibilityHandler) document.removeEventListener('visibilitychange', this.visibilityHandler);
  }

  private async loadSentiment() {
    try {
      const data = await this.marketContextApi.getSentiment();
      this.sentiment.set(data);
    } catch (err) {
      console.error('Failed to load sentiment:', err);
    }
  }

  private async loadCoins() {
    try {
      const data = await this.cryptoApi.getTopCoins(200);
      this.coins.set(data);
    } catch (err) {
      console.error('Failed to load coins:', err);
    } finally {
      this.loading.set(false);
    }
  }

  onSort(key: SortKey) {
    if (this.sortKey() === key) {
      // cycle: desc → asc → off
      if (this.sortDir() === 'desc') {
        this.sortDir.set('asc');
      } else {
        this.sortKey.set(null);
      }
    } else {
      this.sortKey.set(key);
      this.sortDir.set('desc');
    }
  }

  sortIcon(key: SortKey): string {
    if (this.sortKey() !== key) return '';
    return this.sortDir() === 'asc' ? '\u25B2' : '\u25BC';
  }

  fp = formatPrice;
  fpct = formatPct;
  formatMarketCap = formatCompact;
}
