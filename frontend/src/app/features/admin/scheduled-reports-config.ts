import { ChangeDetectionStrategy, Component, inject, signal, computed, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslocoPipe } from '@jsverse/transloco';
import {
  ScheduledReportsApiService,
  type ScheduledReportItem,
  type ScheduledRunStatus,
  type CreateScheduleRequest,
} from '../../core/services/scheduled-reports.service';

@Component({
  selector: 'app-scheduled-reports-config',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, TranslocoPipe],
  template: `
    <div class="animate-fade-in max-w-4xl mx-auto">
      <div class="flex items-center justify-between mb-6">
        <h1 class="text-xl sm:text-2xl font-bold">{{ 'admin.scheduled_reports' | transloco }}</h1>
        <button (click)="openNew()" class="btn-primary text-sm">
          + {{ 'admin.new_schedule' | transloco }}
        </button>
      </div>

      <!-- Form (create / edit) -->
      @if (showForm()) {
        <div class="card mb-6 border border-[var(--color-primary)]/30">
          <h2 class="text-lg font-semibold mb-4">
            {{ editing() ? ('admin.edit_schedule' | transloco) : ('admin.new_schedule' | transloco) }}
          </h2>

          <div class="space-y-4">
            <!-- Label -->
            <div>
              <label class="block text-sm text-[var(--color-muted-foreground)] mb-1">{{ 'admin.label' | transloco }}</label>
              <input
                type="text"
                [(ngModel)]="formLabel"
                class="w-full bg-[var(--color-secondary)] border border-[var(--color-border)] rounded px-3 py-2 text-sm"
                [placeholder]="'admin.label_placeholder' | transloco"
              />
            </div>

            <!-- Enabled -->
            <div class="flex items-center gap-3">
              <label class="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" [(ngModel)]="formEnabled" class="sr-only peer" />
                <div class="w-9 h-5 bg-[var(--color-border)] rounded-full peer peer-checked:bg-[var(--color-primary)] transition-colors after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-full"></div>
              </label>
              <span class="text-sm">{{ 'admin.enabled' | transloco }}</span>
            </div>

            <!-- Schedule Time -->
            <div>
              <label class="block text-sm text-[var(--color-muted-foreground)] mb-1">{{ 'admin.schedule_time' | transloco }}</label>
              <div class="flex items-center gap-2">
                <select [(ngModel)]="formHour" class="bg-[var(--color-secondary)] border border-[var(--color-border)] rounded px-3 py-2 text-sm font-mono">
                  @for (h of hours; track h) {
                    <option [value]="h">{{ pad(h) }}</option>
                  }
                </select>
                <span class="text-lg font-bold">:</span>
                <select [(ngModel)]="formMinute" class="bg-[var(--color-secondary)] border border-[var(--color-border)] rounded px-3 py-2 text-sm font-mono">
                  @for (m of minutes; track m) {
                    <option [value]="m">{{ pad(m) }}</option>
                  }
                </select>
                <span class="text-xs text-[var(--color-muted-foreground)]">UTC</span>
              </div>
            </div>

            <!-- Coins -->
            <div>
              <label class="block text-sm text-[var(--color-muted-foreground)] mb-1">{{ 'admin.coins' | transloco }}</label>
              <div class="flex flex-wrap gap-2 mb-2">
                @for (sym of formSymbols; track sym; let i = $index) {
                  <span class="inline-flex items-center gap-1 bg-[var(--color-primary)]/15 text-[var(--color-primary)] text-xs font-mono font-semibold px-2 py-1 rounded">
                    {{ sym }}
                    <button (click)="removeSymbol(i)" class="hover:text-[var(--color-bear)] transition-colors">&times;</button>
                  </span>
                }
              </div>
              <div class="flex gap-2">
                <input
                  type="text"
                  [(ngModel)]="coinInput"
                  (keydown.enter)="addSymbol()"
                  class="flex-1 bg-[var(--color-secondary)] border border-[var(--color-border)] rounded px-3 py-2 text-sm font-mono uppercase"
                  [placeholder]="'admin.add_coin' | transloco"
                />
                <button (click)="addSymbol()" class="btn-secondary text-sm px-3">+</button>
              </div>
            </div>

            <!-- Actions -->
            <div class="flex gap-3 pt-2">
              <button (click)="saveForm()" class="btn-primary text-sm" [disabled]="saving()">
                {{ saving() ? ('admin.saving' | transloco) : ('admin.save' | transloco) }}
              </button>
              <button (click)="cancelForm()" class="btn-secondary text-sm">
                {{ 'admin.cancel' | transloco }}
              </button>
            </div>
          </div>
        </div>
      }

      <!-- Schedule List -->
      @if (loading()) {
        <p class="text-[var(--color-muted-foreground)]">{{ 'common.loading' | transloco }}...</p>
      } @else if (schedules().length === 0 && !showForm()) {
        <div class="card text-center py-12">
          <p class="text-[var(--color-muted-foreground)] mb-4">{{ 'admin.no_schedules' | transloco }}</p>
          <button (click)="openNew()" class="btn-primary text-sm">+ {{ 'admin.new_schedule' | transloco }}</button>
        </div>
      } @else {
        <div class="space-y-4">
          @for (s of schedules(); track s.id) {
            <div class="card">
              <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2 mb-1">
                    <span class="w-2 h-2 rounded-full shrink-0" [class]="s.enabled ? 'bg-[var(--color-bull)]' : 'bg-[var(--color-muted-foreground)]'"></span>
                    <h3 class="font-semibold truncate">{{ s.label }}</h3>
                    <span class="text-xs font-mono text-[var(--color-muted-foreground)] shrink-0">
                      {{ pad(s.cron_hour) }}:{{ pad(s.cron_minute) }} UTC
                    </span>
                  </div>
                  <div class="flex flex-wrap gap-1.5 mb-2">
                    @for (sym of s.symbols; track sym) {
                      <span class="text-xs font-mono bg-[var(--color-secondary)] px-1.5 py-0.5 rounded">{{ sym }}</span>
                    }
                  </div>
                  <!-- Status -->
                  @if (statuses()[s.id]; as status) {
                    <div class="text-xs text-[var(--color-muted-foreground)]">
                      {{ 'admin.last_run' | transloco }}:
                      @if (status.status === 'running') {
                        <span class="text-[var(--color-accent)]">{{ 'admin.status_running' | transloco }} ({{ status.completed + status.failed }}/{{ status.total }})</span>
                      } @else if (status.status === 'completed') {
                        <span class="text-[var(--color-bull)]">{{ 'admin.status_completed' | transloco }} ({{ status.completed }}/{{ status.total }})</span>
                      } @else if (status.status === 'completed_with_errors') {
                        <span class="text-[var(--color-bear)]">{{ 'admin.status_errors' | transloco }} ({{ status.completed }}/{{ status.total }}, {{ status.failed }} {{ 'admin.failed' | transloco }})</span>
                      }
                    </div>
                  }
                </div>

                <!-- Actions -->
                <div class="flex gap-2 shrink-0">
                  <button (click)="triggerSchedule(s)" class="btn-secondary text-xs px-3" [disabled]="triggering()[s.id]" [title]="'admin.trigger_now' | transloco">
                    {{ triggering()[s.id] ? '...' : '&#9654;' }}
                  </button>
                  <button (click)="editSchedule(s)" class="btn-secondary text-xs px-3" [title]="'admin.edit' | transloco">&#9998;</button>
                  <button (click)="deleteSchedule(s)" class="btn-secondary text-xs px-3 hover:!border-[var(--color-bear)] hover:!text-[var(--color-bear)]" [title]="'admin.delete' | transloco">&#10005;</button>
                </div>
              </div>
            </div>
          }
        </div>
      }
    </div>
  `,
})
export class ScheduledReportsConfig implements OnInit {
  private readonly api = inject(ScheduledReportsApiService);

  schedules = signal<ScheduledReportItem[]>([]);
  statuses = signal<Record<string, ScheduledRunStatus>>({});
  loading = signal(true);
  saving = signal(false);
  triggering = signal<Record<string, boolean>>({});

  // Form state
  showForm = signal(false);
  editing = signal<string | null>(null);
  formLabel = '';
  formEnabled = true;
  formHour = 0;
  formMinute = 30;
  formSymbols: string[] = [];
  coinInput = '';

  hours = Array.from({ length: 24 }, (_, i) => i);
  minutes = Array.from({ length: 12 }, (_, i) => i * 5);

  async ngOnInit() {
    await this.load();
  }

  async load() {
    this.loading.set(true);
    try {
      const list = await this.api.getAll();
      this.schedules.set(list);
      // Load statuses in parallel
      const statusEntries = await Promise.allSettled(
        list.map(async (s) => {
          const status = await this.api.getStatus(s.id);
          return [s.id, status] as const;
        }),
      );
      const statusMap: Record<string, ScheduledRunStatus> = {};
      for (const result of statusEntries) {
        if (result.status === 'fulfilled' && result.value[1]) {
          statusMap[result.value[0]] = result.value[1];
        }
      }
      this.statuses.set(statusMap);
    } catch (err) {
      console.error('Failed to load schedules:', err);
    } finally {
      this.loading.set(false);
    }
  }

  openNew() {
    this.editing.set(null);
    this.formLabel = '';
    this.formEnabled = true;
    this.formHour = 0;
    this.formMinute = 30;
    this.formSymbols = [];
    this.coinInput = '';
    this.showForm.set(true);
  }

  editSchedule(s: ScheduledReportItem) {
    this.editing.set(s.id);
    this.formLabel = s.label;
    this.formEnabled = s.enabled;
    this.formHour = s.cron_hour;
    this.formMinute = s.cron_minute;
    this.formSymbols = [...s.symbols];
    this.coinInput = '';
    this.showForm.set(true);
  }

  cancelForm() {
    this.showForm.set(false);
    this.editing.set(null);
  }

  addSymbol() {
    const sym = this.coinInput.trim().toUpperCase();
    if (sym && !this.formSymbols.includes(sym)) {
      this.formSymbols = [...this.formSymbols, sym];
    }
    this.coinInput = '';
  }

  removeSymbol(index: number) {
    this.formSymbols = this.formSymbols.filter((_, i) => i !== index);
  }

  async saveForm() {
    if (!this.formLabel.trim() || this.formSymbols.length === 0) return;
    this.saving.set(true);
    try {
      const dto: CreateScheduleRequest = {
        label: this.formLabel.trim(),
        enabled: this.formEnabled,
        symbols: this.formSymbols,
        cronHour: +this.formHour,
        cronMinute: +this.formMinute,
      };
      if (this.editing()) {
        await this.api.update(this.editing()!, dto);
      } else {
        await this.api.create(dto);
      }
      this.showForm.set(false);
      this.editing.set(null);
      await this.load();
    } catch (err) {
      console.error('Failed to save schedule:', err);
    } finally {
      this.saving.set(false);
    }
  }

  async deleteSchedule(s: ScheduledReportItem) {
    if (!confirm(`Delete "${s.label}"?`)) return;
    try {
      await this.api.remove(s.id);
      await this.load();
    } catch (err) {
      console.error('Failed to delete schedule:', err);
    }
  }

  async triggerSchedule(s: ScheduledReportItem) {
    this.triggering.update((t) => ({ ...t, [s.id]: true }));
    try {
      await this.api.triggerNow(s.id);
      // Refresh status after a short delay
      setTimeout(() => this.loadStatus(s.id), 2000);
    } catch (err) {
      console.error('Failed to trigger schedule:', err);
    } finally {
      this.triggering.update((t) => ({ ...t, [s.id]: false }));
    }
  }

  private async loadStatus(id: string) {
    try {
      const status = await this.api.getStatus(id);
      if (status) {
        this.statuses.update((s) => ({ ...s, [id]: status }));
      }
    } catch {}
  }

  pad(n: number): string {
    return String(n).padStart(2, '0');
  }
}
