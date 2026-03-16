import { ChangeDetectionStrategy, Component, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { SearchBar } from '../../shared/components/search-bar/search-bar';
import { AuthService } from '../../core/auth/auth.service';
import { CryptoApiService, type CoinMarket } from '../../core/services/crypto.service';
import { formatPrice, formatPct, formatCompact } from '../../shared/utils/format';

@Component({
  selector: 'app-dashboard',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, TranslocoPipe, SearchBar],
  template: `
    <div class="animate-fade-in">
      <!-- Search -->
      <div class="mb-6 max-w-md">
        <app-search-bar />
      </div>

      <div class="card mb-6">
        <h2 class="text-lg font-semibold mb-4">{{ 'dashboard.top_crypto' | transloco }}</h2>
        @if (loading()) {
          <p class="text-[var(--color-muted-foreground)]">{{ 'common.loading_market' | transloco }}</p>
        } @else {
          <div class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead>
                <tr class="text-[var(--color-muted-foreground)] border-b border-[var(--color-border)]">
                  <th class="text-left py-2 pr-4">#</th>
                  <th class="text-left py-2 pr-4">{{ 'dashboard.name' | transloco }}</th>
                  <th class="text-right py-2 pr-4">{{ 'dashboard.price' | transloco }}</th>
                  <th class="text-right py-2 pr-4">{{ 'dashboard.change_24h' | transloco }}</th>
                  <th class="text-right py-2 pr-4">{{ 'dashboard.change_7d' | transloco }}</th>
                  <th class="text-right py-2 pr-4">{{ 'dashboard.market_cap' | transloco }}</th>
                  <th class="text-right py-2"></th>
                </tr>
              </thead>
              <tbody>
                @for (coin of coins(); track coin.symbol) {
                  <tr class="border-b border-[var(--color-border)]/50 hover:bg-[var(--color-secondary)]/50">
                    <td class="py-3 pr-4 text-[var(--color-muted-foreground)]">{{ coin.rank }}</td>
                    <td class="py-3 pr-4">
                      <div class="flex items-center gap-2">
                        <img [src]="coin.image" [alt]="coin.name" class="w-6 h-6 rounded-full" />
                        <span class="font-medium">{{ coin.name }}</span>
                        <span class="text-[var(--color-muted-foreground)] text-xs">{{ coin.symbol }}</span>
                      </div>
                    </td>
                    <td class="py-3 pr-4 text-right font-mono">\${{ fp(coin.price) }}</td>
                    <td class="py-3 pr-4 text-right font-mono" [class]="coin.change24h >= 0 ? 'price-up' : 'price-down'">
                      {{ coin.change24h >= 0 ? '+' : '' }}{{ fpct(coin.change24h) }}%
                    </td>
                    <td class="py-3 pr-4 text-right font-mono" [class]="coin.change7d >= 0 ? 'price-up' : 'price-down'">
                      {{ coin.change7d >= 0 ? '+' : '' }}{{ fpct(coin.change7d) }}%
                    </td>
                    <td class="py-3 pr-4 text-right font-mono">\${{ formatMarketCap(coin.marketCap) }}</td>
                    <td class="py-3 text-right">
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
  protected readonly auth = inject(AuthService);
  private readonly cryptoApi = inject(CryptoApiService);

  coins = signal<CoinMarket[]>([]);
  loading = signal(true);

  private refreshTimer: ReturnType<typeof setInterval> | null = null;
  private visibilityHandler: (() => void) | null = null;

  async ngOnInit() {
    await this.loadCoins();
    this.refreshTimer = setInterval(() => this.loadCoins(), 60_000);
    this.visibilityHandler = () => {
      if (!document.hidden) this.loadCoins();
    };
    document.addEventListener('visibilitychange', this.visibilityHandler);
  }

  ngOnDestroy() {
    if (this.refreshTimer) clearInterval(this.refreshTimer);
    if (this.visibilityHandler) document.removeEventListener('visibilitychange', this.visibilityHandler);
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

  fp = formatPrice;
  fpct = formatPct;
  formatMarketCap = formatCompact;
}
