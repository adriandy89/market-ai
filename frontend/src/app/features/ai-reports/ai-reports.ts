import { ChangeDetectionStrategy, Component, inject, signal, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { AiApiService, type AiReport } from '../../core/services/ai.service';

@Component({
  selector: 'app-ai-reports',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, DatePipe],
  template: `
    <div class="animate-fade-in">
      <h1 class="text-2xl font-bold mb-6">AI Reports</h1>

      @if (loading()) {
        <p class="text-[var(--color-muted-foreground)]">Loading reports...</p>
      } @else if (reports().length === 0) {
        <div class="card text-center py-12">
          <p class="text-[var(--color-muted-foreground)] mb-4">No reports yet. Generate your first AI analysis!</p>
          <a routerLink="/dashboard" class="btn-primary">Go to Dashboard</a>
        </div>
      } @else {
        <div class="space-y-3">
          @for (report of reports(); track report.id) {
            <a [routerLink]="['/reports', report.id]"
               class="card block hover:border-[var(--color-primary)]/50 transition-colors cursor-pointer">
              <div class="flex items-center justify-between">
                <div>
                  <span class="font-semibold text-[var(--color-primary)]">{{ report.symbol }}</span>
                  <span class="text-[var(--color-muted-foreground)] text-sm ml-2">{{ report.timeframe }}</span>
                  <span class="text-[var(--color-muted-foreground)] text-xs ml-2">{{ report.report_type }}</span>
                </div>
                <span class="text-sm text-[var(--color-muted-foreground)]">{{ report.created_at | date:'short' }}</span>
              </div>
              @if (report.content?.aiAnalysis?.summary) {
                <p class="text-sm text-[var(--color-muted-foreground)] mt-2 line-clamp-2">
                  {{ report.content.aiAnalysis.summary }}
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
