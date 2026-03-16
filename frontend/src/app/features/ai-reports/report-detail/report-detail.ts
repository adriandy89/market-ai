import { ChangeDetectionStrategy, Component, inject, signal, OnInit } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { DatePipe, DecimalPipe } from '@angular/common';
import { AiApiService, type AiReport } from '../../../core/services/ai.service';

@Component({
  selector: 'app-report-detail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, DatePipe, DecimalPipe],
  template: `
    <div class="animate-fade-in">
      <a routerLink="/reports" class="text-[var(--color-primary)] text-sm hover:underline mb-4 inline-block">&larr; Back to Reports</a>

      @if (loading()) {
        <p class="text-[var(--color-muted-foreground)]">Loading report...</p>
      } @else if (report()) {
        <div class="flex items-center justify-between mb-6">
          <h1 class="text-2xl font-bold">
            <span class="text-[var(--color-primary)]">{{ report()!.symbol }}</span> Report
          </h1>
          <span class="text-sm text-[var(--color-muted-foreground)]">
            {{ report()!.created_at | date:'medium' }} · {{ report()!.timeframe }}
          </span>
        </div>

        <!-- Price at time of report -->
        @if (content()?.price) {
          <div class="card mb-6">
            <h3 class="text-sm font-medium text-[var(--color-muted-foreground)] mb-1">Price at Report Time</h3>
            <span class="text-2xl font-bold font-mono">\${{ content()!.price.price | number:'1.2-2' }}</span>
          </div>
        }

        <!-- AI Analysis -->
        @if (content()?.aiAnalysis) {
          <div class="card mb-6">
            <h2 class="text-lg font-semibold mb-4">AI Analysis</h2>
            <p class="text-[var(--color-foreground)] leading-relaxed mb-4">{{ content()!.aiAnalysis.summary }}</p>

            @if (content()!.aiAnalysis.technicalAnalysis) {
              <div class="mb-4">
                <h3 class="text-sm font-medium text-[var(--color-muted-foreground)] mb-1">Technical Analysis</h3>
                <p class="text-sm">{{ content()!.aiAnalysis.technicalAnalysis }}</p>
              </div>
            }

            @if (content()!.aiAnalysis.signals?.length) {
              <div class="mb-4">
                <h3 class="text-sm font-medium text-[var(--color-muted-foreground)] mb-2">Signals</h3>
                <div class="space-y-1">
                  @for (sig of content()!.aiAnalysis.signals; track sig.indicator) {
                    <div class="flex items-center gap-2 text-sm">
                      <span class="w-2 h-2 rounded-full"
                        [class]="sig.type === 'bullish' ? 'bg-[var(--color-bull)]' : sig.type === 'bearish' ? 'bg-[var(--color-bear)]' : 'bg-[var(--color-accent)]'"></span>
                      <span class="font-medium">{{ sig.indicator }}:</span>
                      <span class="text-[var(--color-muted-foreground)]">{{ sig.detail }}</span>
                    </div>
                  }
                </div>
              </div>
            }

            @if (content()!.aiAnalysis.riskAssessment) {
              <div class="mb-4">
                <h3 class="text-sm font-medium text-[var(--color-muted-foreground)] mb-1">Risk Assessment</h3>
                <p class="text-sm">{{ content()!.aiAnalysis.riskAssessment }}</p>
              </div>
            }

            @if (content()!.aiAnalysis.outlook) {
              <div>
                <h3 class="text-sm font-medium text-[var(--color-muted-foreground)] mb-1">Outlook</h3>
                <p class="text-sm">{{ content()!.aiAnalysis.outlook }}</p>
              </div>
            }
          </div>
        }
      }
    </div>
  `,
})
export class ReportDetail implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly aiApi = inject(AiApiService);

  report = signal<AiReport | null>(null);
  content = signal<any>(null);
  loading = signal(true);

  async ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id') || '';
    try {
      const data = await this.aiApi.getReport(id);
      this.report.set(data);
      this.content.set(data?.content);
    } catch (err) {
      console.error('Failed to load report:', err);
    } finally {
      this.loading.set(false);
    }
  }
}
