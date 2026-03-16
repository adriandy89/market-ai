import { ChangeDetectionStrategy, Component, inject, signal, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DecimalPipe } from '@angular/common';
import { AuthService } from '../../core/auth/auth.service';
import { CryptoApiService, type CoinMarket } from '../../core/services/crypto.service';
import { AiApiService } from '../../core/services/ai.service';

@Component({
  selector: 'app-dashboard',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, DecimalPipe],
  template: `
    <div class="animate-fade-in">
      <h1 class="text-2xl font-bold mb-6">
        Welcome, <span class="text-[var(--color-primary)]">{{ auth.user()?.name }}</span>
      </h1>

      <!-- Top Coins Table -->
      <div class="card mb-6">
        <h2 class="text-lg font-semibold mb-4">Top Cryptocurrencies</h2>
        @if (loading()) {
          <p class="text-[var(--color-muted-foreground)]">Loading market data...</p>
        } @else {
          <div class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead>
                <tr class="text-[var(--color-muted-foreground)] border-b border-[var(--color-border)]">
                  <th class="text-left py-2 pr-4">#</th>
                  <th class="text-left py-2 pr-4">Name</th>
                  <th class="text-right py-2 pr-4">Price</th>
                  <th class="text-right py-2 pr-4">24h %</th>
                  <th class="text-right py-2 pr-4">7d %</th>
                  <th class="text-right py-2 pr-4">Market Cap</th>
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
                    <td class="py-3 pr-4 text-right font-mono">\${{ coin.price | number:'1.2-2' }}</td>
                    <td class="py-3 pr-4 text-right font-mono" [class]="coin.change24h >= 0 ? 'price-up' : 'price-down'">
                      {{ coin.change24h >= 0 ? '+' : '' }}{{ coin.change24h | number:'1.2-2' }}%
                    </td>
                    <td class="py-3 pr-4 text-right font-mono" [class]="coin.change7d >= 0 ? 'price-up' : 'price-down'">
                      {{ coin.change7d >= 0 ? '+' : '' }}{{ coin.change7d | number:'1.2-2' }}%
                    </td>
                    <td class="py-3 pr-4 text-right font-mono">\${{ formatMarketCap(coin.marketCap) }}</td>
                    <td class="py-3 text-right">
                      <a [routerLink]="['/coin', coin.symbol]" class="text-[var(--color-primary)] hover:underline text-xs">
                        Analyze
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
export class Dashboard implements OnInit {
  protected readonly auth = inject(AuthService);
  private readonly cryptoApi = inject(CryptoApiService);
  private readonly aiApi = inject(AiApiService);

  coins = signal<CoinMarket[]>([]);
  loading = signal(true);

  async ngOnInit() {
    try {
      const data = await this.cryptoApi.getTopCoins(15);
      this.coins.set(data);
    } catch (err) {
      console.error('Failed to load coins:', err);
    } finally {
      this.loading.set(false);
    }
  }

  formatMarketCap(value: number): string {
    if (!value) return '—';
    if (value >= 1e12) return (value / 1e12).toFixed(2) + 'T';
    if (value >= 1e9) return (value / 1e9).toFixed(2) + 'B';
    if (value >= 1e6) return (value / 1e6).toFixed(2) + 'M';
    return value.toLocaleString();
  }
}
