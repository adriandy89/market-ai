import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslocoPipe } from '@jsverse/transloco';
import { CryptoApiService, type SearchResult } from '../../core/services/crypto.service';
import { PriceAlertsApiService, type PriceAlert, type CreateAlertRequest, type UpdateAlertRequest } from '../../core/services/price-alerts.service';

@Component({
  selector: 'app-price-alerts',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoPipe, FormsModule],
  template: `
    <div class="animate-fade-in max-w-4xl mx-auto">
      <div class="flex items-center justify-between mb-6">
        <h1 class="text-2xl font-bold">{{ 'alerts.title' | transloco }}</h1>
        @if (!editingAlert()) {
          <button (click)="toggleForm()" class="btn-primary text-sm">
            {{ showForm() ? ('alerts.cancel' | transloco) : ('alerts.new_alert' | transloco) }}
          </button>
        }
      </div>

      <!-- Create / Edit Alert Form -->
      @if (showForm() || editingAlert()) {
        <div class="card mb-6 space-y-4">
          <h2 class="text-lg font-semibold">
            {{ (editingAlert() ? 'alerts.edit_alert' : 'alerts.new_alert') | transloco }}
          </h2>

          <!-- Symbol (only for create, read-only in edit) -->
          <div class="relative">
            <label class="block text-sm font-medium mb-1">{{ 'alerts.symbol' | transloco }}</label>
            @if (editingAlert()) {
              <div class="flex items-center gap-2 px-3 py-2 border border-[var(--color-border)] rounded bg-[var(--color-secondary)] opacity-70">
                <span class="font-medium">{{ editingAlert()!.symbol }}</span>
                <span class="text-sm text-[var(--color-muted-foreground)]">{{ editingAlert()!.name }}</span>
              </div>
            } @else if (selectedCoin()) {
              <div class="flex items-center gap-2 px-3 py-2 border border-[var(--color-border)] rounded bg-[var(--color-secondary)]">
                <span class="font-medium">{{ selectedCoin()!.symbol.toUpperCase() }}</span>
                <span class="text-sm text-[var(--color-muted-foreground)]">{{ selectedCoin()!.name }}</span>
                <button (click)="clearCoin()" class="ml-auto text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]">✕</button>
              </div>
            } @else {
              <input
                type="text"
                [ngModel]="searchQuery()"
                (ngModelChange)="onSearchChange($event)"
                placeholder="BTC, ETH..."
                class="input w-full"
              />
              @if (searchResults().length > 0) {
                <div class="absolute z-10 w-full mt-1 bg-[var(--color-card)] border border-[var(--color-border)] rounded-lg shadow-lg max-h-48 overflow-auto">
                  @for (coin of searchResults(); track coin.id) {
                    <button
                      (click)="selectCoin(coin)"
                      class="w-full px-3 py-2 text-left text-sm hover:bg-[var(--color-secondary)] flex items-center gap-2"
                    >
                      @if (coin.thumb) {
                        <img [src]="coin.thumb" class="w-5 h-5 rounded-full" alt="" />
                      }
                      <span class="font-medium">{{ coin.symbol.toUpperCase() }}</span>
                      <span class="text-[var(--color-muted-foreground)]">{{ coin.name }}</span>
                    </button>
                  }
                </div>
              }
            }
          </div>

          <!-- Alert Type (only for create, read-only in edit) -->
          <div>
            <label class="block text-sm font-medium mb-1">{{ 'alerts.type' | transloco }}</label>
            @if (editingAlert()) {
              <div class="px-3 py-2 border border-[var(--color-border)] rounded bg-[var(--color-secondary)] opacity-70 text-sm">
                {{ getTypeLabel(formAlertType) }}
              </div>
            } @else {
              <select [(ngModel)]="formAlertType" class="input w-full">
                <option value="PERCENTAGE_CHANGE_WINDOW">{{ 'alerts.type_pct_window' | transloco }}</option>
                <option value="PERCENTAGE_CHANGE_FROM_PRICE">{{ 'alerts.type_pct_from_price' | transloco }}</option>
                <option value="FIXED_PRICE">{{ 'alerts.type_fixed' | transloco }}</option>
              </select>
            }
          </div>

          <!-- Direction -->
          <div>
            <label class="block text-sm font-medium mb-1">{{ 'alerts.direction' | transloco }}</label>
            <div class="flex gap-2">
              @for (dir of directions; track dir.value) {
                <button
                  (click)="formDirection = dir.value"
                  class="px-4 py-2 rounded text-sm font-medium border transition-colors"
                  [class]="formDirection === dir.value
                    ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10 text-[var(--color-primary)]'
                    : 'border-[var(--color-border)] text-[var(--color-muted-foreground)] hover:border-[var(--color-primary)]/50'"
                >
                  {{ dir.labelKey | transloco }}
                </button>
              }
            </div>
          </div>

          <!-- Threshold Percent (for % alerts) -->
          @if (formAlertType !== 'FIXED_PRICE') {
            <div>
              <label class="block text-sm font-medium mb-1">{{ 'alerts.threshold_pct' | transloco }}</label>
              <input type="number" [(ngModel)]="formThresholdPercent" min="0.1" max="100" step="0.1" class="input w-full" placeholder="5" />
            </div>
          }

          <!-- Threshold Price (for fixed price) -->
          @if (formAlertType === 'FIXED_PRICE') {
            <div>
              <label class="block text-sm font-medium mb-1">{{ 'alerts.threshold_price' | transloco }}</label>
              <input type="number" [(ngModel)]="formThresholdPrice" min="0" step="0.01" class="input w-full" placeholder="50000" />
            </div>
          }

          <!-- Time Window (for window alerts) -->
          @if (formAlertType === 'PERCENTAGE_CHANGE_WINDOW') {
            <div>
              <label class="block text-sm font-medium mb-1">{{ 'alerts.time_window' | transloco }}</label>
              <input type="number" [(ngModel)]="formTimeWindow" min="1" max="168" step="1" class="input w-full" placeholder="1" />
            </div>
          }

          <!-- Recurring -->
          @if (formAlertType !== 'FIXED_PRICE') {
            <label class="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" [(ngModel)]="formRecurring" class="rounded" />
              {{ 'alerts.recurring' | transloco }}
            </label>
          }

          <!-- Base price info (edit mode only) -->
          @if (editingAlert(); as ea) {
            <p class="text-xs text-[var(--color-muted-foreground)]">
              {{ 'alerts.base_price' | transloco }}: {{ formatPrice(ea.base_price) }}
            </p>
          }

          <div class="flex gap-2">
            <button
              (click)="editingAlert() ? saveEdit() : createAlert()"
              [disabled]="saving() || (!editingAlert() && !selectedCoin())"
              class="btn-primary text-sm flex-1"
            >
              @if (saving()) {
                {{ (editingAlert() ? 'alerts.saving' : 'alerts.creating') | transloco }}
              } @else {
                {{ (editingAlert() ? 'alerts.save' : 'alerts.create') | transloco }}
              }
            </button>
            @if (editingAlert()) {
              <button (click)="cancelEdit()" class="btn-secondary text-sm">
                {{ 'alerts.cancel' | transloco }}
              </button>
            }
          </div>
        </div>
      }

      <!-- Alerts List -->
      @if (alerts().length === 0 && !loading()) {
        <div class="card text-center py-12 text-[var(--color-muted-foreground)]">
          <p class="text-lg mb-2">{{ 'alerts.no_alerts' | transloco }}</p>
        </div>
      } @else {
        <div class="space-y-3">
          @for (alert of alerts(); track alert.id) {
            <div class="card flex flex-col sm:flex-row sm:items-center gap-3">
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2 mb-1">
                  <span class="font-semibold">{{ alert.symbol }}</span>
                  <span class="text-xs px-2 py-0.5 rounded-full"
                    [class]="alert.is_active
                      ? 'bg-green-500/10 text-green-500'
                      : 'bg-gray-500/10 text-gray-500'"
                  >
                    {{ (alert.is_active ? 'alerts.active' : 'alerts.inactive') | transloco }}
                  </span>
                  @if (alert.is_recurring) {
                    <span class="text-xs text-[var(--color-primary)]">🔄</span>
                  }
                </div>
                <p class="text-sm text-[var(--color-muted-foreground)]">
                  {{ getAlertDescription(alert) }}
                </p>
                @if (alert.trigger_count > 0) {
                  <p class="text-xs text-[var(--color-muted-foreground)] mt-1">
                    {{ 'alerts.trigger_count' | transloco }}: {{ alert.trigger_count }}
                  </p>
                }
              </div>
              <div class="flex items-center gap-2 shrink-0">
                <button (click)="startEdit(alert)" class="btn-secondary text-xs px-3 py-1.5">
                  {{ 'alerts.edit' | transloco }}
                </button>
                <button (click)="toggle(alert)" class="btn-secondary text-xs px-3 py-1.5">
                  {{ (alert.is_active ? 'alerts.deactivate' : 'alerts.activate') | transloco }}
                </button>
                <button (click)="remove(alert)" class="text-red-500 hover:text-red-400 text-xs px-3 py-1.5 border border-red-500/30 rounded hover:bg-red-500/10 transition-colors">
                  {{ 'alerts.delete' | transloco }}
                </button>
              </div>
            </div>
          }
        </div>
      }
    </div>
  `,
})
export class PriceAlerts implements OnInit {
  private readonly alertsApi = inject(PriceAlertsApiService);
  private readonly cryptoApi = inject(CryptoApiService);

  alerts = signal<PriceAlert[]>([]);
  loading = signal(true);
  showForm = signal(false);
  saving = signal(false);
  editingAlert = signal<PriceAlert | null>(null);

  // Search
  searchQuery = signal('');
  searchResults = signal<SearchResult[]>([]);
  selectedCoin = signal<SearchResult | null>(null);
  private searchTimeout: any;

  // Form fields
  formAlertType: PriceAlert['alert_type'] = 'PERCENTAGE_CHANGE_WINDOW';
  formDirection: PriceAlert['direction'] = 'UP';
  formThresholdPercent = 5;
  formThresholdPrice = 0;
  formTimeWindow = 1;
  formRecurring = false;

  directions = [
    { value: 'UP' as const, labelKey: 'alerts.direction_up' },
    { value: 'DOWN' as const, labelKey: 'alerts.direction_down' },
    { value: 'BOTH' as const, labelKey: 'alerts.direction_both' },
  ];

  async ngOnInit() {
    await this.loadAlerts();
  }

  async loadAlerts() {
    this.loading.set(true);
    try {
      const data = await this.alertsApi.getAlerts();
      this.alerts.set(data);
    } catch {} finally {
      this.loading.set(false);
    }
  }

  toggleForm() {
    if (this.editingAlert()) {
      this.cancelEdit();
      return;
    }
    this.showForm.set(!this.showForm());
    if (!this.showForm()) this.resetForm();
  }

  onSearchChange(query: string) {
    this.searchQuery.set(query);
    clearTimeout(this.searchTimeout);
    if (query.length < 2) {
      this.searchResults.set([]);
      return;
    }
    this.searchTimeout = setTimeout(async () => {
      try {
        const results = await this.cryptoApi.searchCoins(query);
        this.searchResults.set(results.slice(0, 8));
      } catch {
        this.searchResults.set([]);
      }
    }, 300);
  }

  selectCoin(coin: SearchResult) {
    this.selectedCoin.set(coin);
    this.searchResults.set([]);
    this.searchQuery.set('');
  }

  clearCoin() {
    this.selectedCoin.set(null);
    this.searchQuery.set('');
  }

  // ── Edit ──

  startEdit(alert: PriceAlert) {
    this.editingAlert.set(alert);
    this.showForm.set(false);
    this.formAlertType = alert.alert_type;
    this.formDirection = alert.direction;
    this.formThresholdPercent = alert.threshold_percent ?? 5;
    this.formThresholdPrice = alert.threshold_price ?? 0;
    this.formTimeWindow = alert.time_window_hours ?? 1;
    this.formRecurring = alert.is_recurring;
  }

  cancelEdit() {
    this.editingAlert.set(null);
    this.resetForm();
  }

  async saveEdit() {
    const alert = this.editingAlert();
    if (!alert) return;

    this.saving.set(true);
    try {
      const dto: UpdateAlertRequest = {
        direction: this.formDirection,
        isRecurring: this.formAlertType === 'FIXED_PRICE' ? false : this.formRecurring,
      };

      if (this.formAlertType !== 'FIXED_PRICE') {
        dto.thresholdPercent = this.formThresholdPercent;
      }
      if (this.formAlertType === 'FIXED_PRICE') {
        dto.thresholdPrice = this.formThresholdPrice;
      }
      if (this.formAlertType === 'PERCENTAGE_CHANGE_WINDOW') {
        dto.timeWindowHours = this.formTimeWindow;
      }

      const updated = await this.alertsApi.updateAlert(alert.id, dto);
      this.alerts.update((list) => list.map((a) => (a.id === alert.id ? updated : a)));
      this.cancelEdit();
    } catch {} finally {
      this.saving.set(false);
    }
  }

  // ── Create ──

  async createAlert() {
    const coin = this.selectedCoin();
    if (!coin) return;

    this.saving.set(true);
    try {
      const dto: CreateAlertRequest = {
        symbol: coin.symbol.toUpperCase(),
        name: coin.name,
        alertType: this.formAlertType,
        direction: this.formDirection,
        isRecurring: this.formAlertType === 'FIXED_PRICE' ? false : this.formRecurring,
      };

      if (this.formAlertType !== 'FIXED_PRICE') {
        dto.thresholdPercent = this.formThresholdPercent;
      }
      if (this.formAlertType === 'FIXED_PRICE') {
        dto.thresholdPrice = this.formThresholdPrice;
      }
      if (this.formAlertType === 'PERCENTAGE_CHANGE_WINDOW') {
        dto.timeWindowHours = this.formTimeWindow;
      }

      await this.alertsApi.createAlert(dto);
      this.showForm.set(false);
      this.resetForm();
      await this.loadAlerts();
    } catch {} finally {
      this.saving.set(false);
    }
  }

  // ── Actions ──

  async toggle(alert: PriceAlert) {
    try {
      const updated = await this.alertsApi.toggleAlert(alert.id);
      this.alerts.update((list) => list.map((a) => (a.id === alert.id ? updated : a)));
    } catch {}
  }

  async remove(alert: PriceAlert) {
    try {
      await this.alertsApi.deleteAlert(alert.id);
      this.alerts.update((list) => list.filter((a) => a.id !== alert.id));
      if (this.editingAlert()?.id === alert.id) this.cancelEdit();
    } catch {}
  }

  // ── Helpers ──

  getAlertDescription(alert: PriceAlert): string {
    const dir = alert.direction === 'UP' ? '↑' : alert.direction === 'DOWN' ? '↓' : '↕';
    switch (alert.alert_type) {
      case 'PERCENTAGE_CHANGE_WINDOW':
        return `${dir} ${alert.threshold_percent}% en ${alert.time_window_hours}h`;
      case 'PERCENTAGE_CHANGE_FROM_PRICE':
        return `${dir} ${alert.threshold_percent}% desde $${this.fmt(alert.base_price)}`;
      case 'FIXED_PRICE':
        return `${dir} $${this.fmt(alert.threshold_price!)}`;
      default:
        return '';
    }
  }

  getTypeLabel(type: string): string {
    switch (type) {
      case 'PERCENTAGE_CHANGE_WINDOW': return '% cambio en ventana de tiempo';
      case 'PERCENTAGE_CHANGE_FROM_PRICE': return '% cambio desde precio base';
      case 'FIXED_PRICE': return 'Precio fijo';
      default: return type;
    }
  }

  formatPrice(price: number): string {
    return '$' + this.fmt(price);
  }

  fmt(price: number): string {
    if (price >= 1) return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return price.toPrecision(4);
  }

  private resetForm() {
    this.clearCoin();
    this.formAlertType = 'PERCENTAGE_CHANGE_WINDOW';
    this.formDirection = 'UP';
    this.formThresholdPercent = 5;
    this.formThresholdPrice = 0;
    this.formTimeWindow = 1;
    this.formRecurring = false;
  }
}
