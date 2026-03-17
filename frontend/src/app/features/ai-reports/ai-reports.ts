import { ChangeDetectionStrategy, Component, inject, signal, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { TranslocoPipe } from '@jsverse/transloco';
import { AiApiService, type AiReport } from '../../core/services/ai.service';

@Component({
  selector: 'app-ai-reports',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, DatePipe, TranslocoPipe],
  template: `
    <div class="animate-fade-in">
      <h1 class="text-2xl font-bold mb-6">{{ 'reports.title' | transloco }}</h1>

      @if (loading()) {
        <p class="text-[var(--color-muted-foreground)]">{{ 'common.loading_reports' | transloco }}</p>
      } @else if (reports().length === 0) {
        <div class="card text-center py-12">
          <p class="text-[var(--color-muted-foreground)] mb-4">{{ 'reports.no_reports' | transloco }}</p>
          <a routerLink="/dashboard" class="btn-primary">{{ 'reports.go_dashboard' | transloco }}</a>
        </div>
      } @else {
        <div class="space-y-3">
          @for (report of reports(); track report.id) {
            <a [routerLink]="['/reports', report.id]"
               class="card block hover:border-[var(--color-primary)]/50 transition-colors cursor-pointer">
              <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-1 sm:gap-2">
                <div class="flex items-center gap-2 flex-wrap">
                  <span class="font-semibold text-[var(--color-primary)]">{{ report.symbol }}</span>
                  <span class="text-[var(--color-muted-foreground)] text-sm">{{ report.timeframe === 'multi' ? ('coin.multi_timeframe' | transloco) : report.timeframe }}</span>
                  @if (report.report_type === 'comprehensive') {
                    <span class="text-xs px-1.5 py-0.5 rounded bg-[var(--color-accent)]/20 text-[var(--color-accent)]">{{ 'reports.comprehensive' | transloco }}</span>
                  } @else {
                    <span class="text-xs px-1.5 py-0.5 rounded bg-[var(--color-muted)] text-[var(--color-muted-foreground)]">{{ 'reports.standard' | transloco }}</span>
                  }
                </div>
                <span class="text-xs sm:text-sm text-[var(--color-muted-foreground)] shrink-0">{{ report.created_at | date:'short' }}</span>
              </div>
              @if (report.content?.aiSummary || report.content?.aiAnalysis?.executiveSummary || report.content?.aiAnalysis?.summary) {
                <p class="text-sm text-[var(--color-muted-foreground)] mt-2 line-clamp-2">
                  {{ report.content.aiSummary || report.content.aiAnalysis?.executiveSummary || report.content.aiAnalysis?.summary }}
                </p>
              }
            </a>
          }
        </div>
      }
    </div>
  `,
})
export class AiReports implements OnInit {
  private readonly aiApi = inject(AiApiService);

  reports = signal<AiReport[]>([]);
  loading = signal(true);

  async ngOnInit() {
    try {
      const result = await this.aiApi.getReports(1, 20);
      this.reports.set(result.data);
    } catch (err) {
      console.error('Failed to load reports:', err);
    } finally {
      this.loading.set(false);
    }
  }
}
