import { ChangeDetectionStrategy, Component, inject, signal, computed, OnInit } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { TranslocoPipe } from '@jsverse/transloco';
import { AiApiService, type AiReport } from '../../../core/services/ai.service';
import { MarkdownPipe } from '../../../shared/pipes/markdown.pipe';
import { formatPrice } from '../../../shared/utils/format';

@Component({
  selector: 'app-report-detail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, DatePipe, TranslocoPipe],
  template: `
    <div class="animate-fade-in">
      <a routerLink="/reports" class="text-[var(--color-primary)] text-sm hover:underline mb-4 inline-block">&larr; {{ 'reports.back_to_reports' | transloco }}</a>

      @if (loading()) {
        <p class="text-[var(--color-muted-foreground)]">{{ 'common.loading_report' | transloco }}</p>
      } @else if (report()) {
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6">
          <h1 class="text-xl sm:text-2xl font-bold">
            <a [routerLink]="['/coin', report()!.symbol]" class="text-[var(--color-primary)] underline hover:brightness-125 transition-all">{{ report()!.symbol }}</a> {{ 'reports.report' | transloco }}
            @if (isComprehensive()) {
              <span class="ml-2 text-xs px-2 py-0.5 rounded bg-[var(--color-accent)]/20 text-[var(--color-accent)]">{{ 'reports.comprehensive' | transloco }}</span>
            }
          </h1>
          <span class="text-xs sm:text-sm text-[var(--color-muted-foreground)] shrink-0">
            {{ report()!.created_at | date:'medium' }} · {{ report()!.timeframe === 'multi' ? ('coin.multi_timeframe' | transloco) : report()!.timeframe }}
          </span>
        </div>

        <!-- Price at time of report -->
        @if (content()?.price) {
          <div class="card mb-6">
            <h3 class="text-sm font-medium text-[var(--color-muted-foreground)] mb-1">{{ 'reports.price_at_time' | transloco }}</h3>
            <span class="text-2xl font-bold font-mono">\${{ fp(content()!.price.price) }}</span>
          </div>
        }

        <!-- ═══ MARKDOWN REPORT (new format) ═══ -->
        @if (isMarkdown()) {
          <div class="card mb-6 prose max-w-none" [innerHTML]="markdownHtml()"></div>
        }

        <!-- ═══ LEGACY JSON: COMPREHENSIVE ═══ -->
        @else if (isComprehensive() && ai()) {
          <div class="card mb-6">
            <h2 class="text-lg font-semibold mb-3">{{ 'reports.executive_summary' | transloco }}</h2>
            <p class="text-[var(--color-foreground)] leading-relaxed">{{ ai().executiveSummary }}</p>
          </div>
          @if (ai().signals?.length) {
            <div class="card mb-6">
              <h2 class="text-lg font-semibold mb-4">{{ 'reports.signals' | transloco }}</h2>
              <div class="space-y-2">
                @for (sig of ai().signals; track sig.indicator + sig.source) {
                  <div class="flex items-center gap-3 text-sm">
                    <span class="w-2 h-2 rounded-full shrink-0"
                      [class]="sig.type === 'bullish' ? 'bg-[var(--color-bull)]' : sig.type === 'bearish' ? 'bg-[var(--color-bear)]' : 'bg-[var(--color-accent)]'"></span>
                    <span class="font-medium">{{ sig.indicator }}:</span>
                    <span class="text-[var(--color-muted-foreground)]">{{ sig.detail }}</span>
                  </div>
                }
              </div>
            </div>
          }
          @if (ai().outlook) {
            <div class="card mb-6">
              <h2 class="text-lg font-semibold mb-3">{{ 'reports.outlook' | transloco }}</h2>
              <p class="text-sm">{{ ai().outlook.shortTerm || ai().outlook }}</p>
            </div>
          }
        }

        <!-- ═══ LEGACY JSON: STANDARD ═══ -->
        @else if (content()?.aiAnalysis) {
          <div class="card mb-6">
            <h2 class="text-lg font-semibold mb-4">{{ 'reports.ai_analysis' | transloco }}</h2>
            <p class="text-[var(--color-foreground)] leading-relaxed mb-4">{{ content()!.aiAnalysis.summary }}</p>
            @if (content()!.aiAnalysis.signals?.length) {
              <div class="mb-4">
                <h3 class="text-sm font-medium text-[var(--color-muted-foreground)] mb-2">{{ 'reports.signals' | transloco }}</h3>
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
                <h3 class="text-sm font-medium text-[var(--color-muted-foreground)] mb-1">{{ 'reports.risk_assessment' | transloco }}</h3>
                <p class="text-sm">{{ content()!.aiAnalysis.riskAssessment }}</p>
              </div>
            }
            @if (content()!.aiAnalysis.outlook) {
              <div>
                <h3 class="text-sm font-medium text-[var(--color-muted-foreground)] mb-1">{{ 'reports.outlook' | transloco }}</h3>
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

  fp = formatPrice;
  report = signal<AiReport | null>(null);
  content = signal<any>(null);
  loading = signal(true);

  isComprehensive = computed(() => this.report()?.report_type === 'comprehensive');
  isMarkdown = computed(() => typeof this.content()?.aiAnalysis === 'string');
  ai = computed(() => {
    const analysis = this.content()?.aiAnalysis;
    return typeof analysis === 'object' ? analysis : {};
  });

  markdownHtml = computed(() => {
    const md = this.content()?.aiAnalysis;
    if (typeof md !== 'string') return '';
    const pipe = new MarkdownPipe();
    return pipe.transform(md);
  });

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
