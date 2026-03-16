import { ChangeDetectionStrategy, Component, inject, signal, ElementRef, HostListener } from '@angular/core';
import { Router } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { CryptoApiService, type SearchResult } from '../../../core/services/crypto.service';

@Component({
  selector: 'app-search-bar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoPipe],
  template: `
    <div class="relative">
      <input
        type="text"
        [placeholder]="'search.placeholder' | transloco"
        [value]="query()"
        (input)="onInput($event)"
        (keydown.escape)="close()"
        (focus)="onFocus()"
        class="w-full px-3 py-2 text-sm rounded bg-[var(--color-secondary)] border border-[var(--color-border)] text-[var(--color-foreground)] placeholder:text-[var(--color-muted-foreground)] outline-none focus:border-[var(--color-primary)] transition-colors"
      />

      @if (open() && query().length >= 2) {
        <div class="absolute top-full left-0 right-0 mt-1 bg-[var(--color-card)] border border-[var(--color-border)] rounded shadow-lg z-50 max-h-80 overflow-auto">
          @if (loading()) {
            <div class="px-3 py-4 text-sm text-[var(--color-muted-foreground)] text-center">
              {{ 'common.loading' | transloco }}
            </div>
          } @else if (results().length === 0) {
            <div class="px-3 py-4 text-sm text-[var(--color-muted-foreground)] text-center">
              {{ 'search.no_results' | transloco }}
            </div>
          } @else {
            @for (coin of results(); track coin.id) {
              <button
                (click)="onSelect(coin)"
                class="w-full flex items-center gap-3 px-3 py-2.5 text-sm hover:bg-[var(--color-secondary)] transition-colors text-left"
              >
                <img [src]="coin.thumb" [alt]="coin.name" class="w-6 h-6 rounded-full shrink-0" />
                <div class="flex-1 min-w-0">
                  <span class="font-medium">{{ coin.name }}</span>
                  <span class="text-[var(--color-muted-foreground)] ml-1.5 text-xs">{{ coin.symbol }}</span>
                </div>
                @if (coin.rank) {
                  <span class="text-xs text-[var(--color-muted-foreground)] shrink-0">#{{ coin.rank }}</span>
                }
              </button>
            }
          }
        </div>
      }
    </div>
  `,
})
export class SearchBar {
  private readonly cryptoApi = inject(CryptoApiService);
  private readonly router = inject(Router);
  private readonly el = inject(ElementRef);

  query = signal('');
  results = signal<SearchResult[]>([]);
  loading = signal(false);
  open = signal(false);

  private debounceTimer: ReturnType<typeof setTimeout> | null = null;

  @HostListener('document:click', ['$event'])
  onClickOutside(event: MouseEvent) {
    if (!this.el.nativeElement.contains(event.target)) {
      this.close();
    }
  }

  onFocus() {
    if (this.query().length >= 2) {
      this.open.set(true);
    }
  }

  onInput(event: Event) {
    const value = (event.target as HTMLInputElement).value;
    this.query.set(value);

    if (this.debounceTimer) clearTimeout(this.debounceTimer);

    if (value.length < 2) {
      this.results.set([]);
      this.open.set(false);
      return;
    }

    this.open.set(true);
    this.loading.set(true);

    this.debounceTimer = setTimeout(async () => {
      try {
        const data = await this.cryptoApi.searchCoins(value);
        this.results.set(data);
      } catch {
        this.results.set([]);
      } finally {
        this.loading.set(false);
      }
    }, 300);
  }

  onSelect(coin: SearchResult) {
    this.close();
    this.query.set('');
    this.router.navigate(['/coin', coin.symbol]);
  }

  close() {
    this.open.set(false);
  }
}
