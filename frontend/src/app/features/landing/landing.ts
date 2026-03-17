import { ChangeDetectionStrategy, Component, inject, signal, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { TranslocoPipe } from '@jsverse/transloco';
import { LanguageService, type SupportedLang } from '../../core/services/language.service';
import { AuthService } from '../../core/auth/auth.service';
import { AiApiService, type AiReport } from '../../core/services/ai.service';

@Component({
  selector: 'app-landing',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, TranslocoPipe, DatePipe],
  template: `
    <div class="min-h-screen bg-[var(--color-background)] relative overflow-hidden">

      <!-- Animated background -->
      <div class="hero-bg">
        <div class="hero-grid"></div>
        <div class="hero-glow hero-glow-1"></div>
        <div class="hero-glow hero-glow-2"></div>
        <div class="hero-particles">
          <span class="particle" style="left:10%;animation-delay:0s"></span>
          <span class="particle" style="left:20%;animation-delay:1.5s"></span>
          <span class="particle" style="left:35%;animation-delay:3s"></span>
          <span class="particle" style="left:50%;animation-delay:0.8s"></span>
          <span class="particle" style="left:65%;animation-delay:2.2s"></span>
          <span class="particle" style="left:78%;animation-delay:4s"></span>
          <span class="particle" style="left:88%;animation-delay:1s"></span>
          <span class="particle" style="left:5%;animation-delay:3.5s"></span>
          <span class="particle" style="left:42%;animation-delay:2.8s"></span>
          <span class="particle" style="left:92%;animation-delay:0.3s"></span>
        </div>
        <div class="hero-scanline"></div>
      </div>

      <!-- Top bar -->
      <nav class="relative z-10 flex items-center justify-between px-6 py-4 max-w-7xl mx-auto">
        <span class="text-xl font-bold">
          <span class="text-[var(--color-primary)]">Market</span><span class="text-[var(--color-accent)]">AI</span>
        </span>
        <div class="flex items-center gap-3">
          <div class="flex rounded-lg overflow-hidden border border-[var(--color-border)]">
            <button (click)="setLang('es')"
              class="px-3 py-1.5 text-xs font-medium transition-all"
              [class]="langService.currentLang() === 'es' ? 'bg-[var(--color-primary)] text-[var(--color-primary-foreground)]' : 'bg-[var(--color-secondary)] text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]'">
              ES
            </button>
            <button (click)="setLang('en')"
              class="px-3 py-1.5 text-xs font-medium transition-all"
              [class]="langService.currentLang() === 'en' ? 'bg-[var(--color-primary)] text-[var(--color-primary-foreground)]' : 'bg-[var(--color-secondary)] text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]'">
              EN
            </button>
          </div>
          @if (auth.isAuthenticated()) {
            <a routerLink="/dashboard" class="btn-primary text-sm px-4 py-2">{{ 'landing.explore' | transloco }}</a>
          } @else {
            <a routerLink="/auth/login" class="btn-secondary text-sm px-4 py-2">{{ 'landing.sign_in' | transloco }}</a>
          }
        </div>
      </nav>

      <!-- Hero -->
      <section class="relative z-10 flex flex-col items-center justify-center text-center px-6 pt-16 pb-20 sm:pt-24 sm:pb-28">
        <div class="animate-fade-in-up">
          <span class="inline-block px-4 py-1.5 rounded-full text-xs font-semibold tracking-wide uppercase mb-6 bg-[var(--color-primary)]/10 text-[var(--color-primary)] border border-[var(--color-primary)]/20">
            {{ 'landing.tagline' | transloco }}
          </span>
        </div>
        <h1 class="text-5xl sm:text-6xl lg:text-7xl font-extrabold mb-6 animate-fade-in-up" style="animation-delay: 0.1s">
          <span class="text-[var(--color-primary)]">Market</span><span class="text-[var(--color-accent)]">AI</span>
        </h1>
        <p class="text-lg sm:text-xl text-[var(--color-muted-foreground)] mb-10 max-w-2xl animate-fade-in-up" style="animation-delay: 0.2s">
          {{ 'landing.subtitle' | transloco }}
        </p>
        <div class="flex flex-col sm:flex-row gap-3 sm:gap-4 w-full sm:w-auto animate-fade-in-up" style="animation-delay: 0.3s">
          <a routerLink="/dashboard" class="btn-primary text-lg px-8 py-3.5 animate-pulse-glow">{{ 'landing.explore' | transloco }}</a>
          @if (!auth.isAuthenticated()) {
            <a routerLink="/auth/login" class="btn-secondary text-lg px-8 py-3.5">{{ 'landing.sign_in' | transloco }}</a>
          }
        </div>
      </section>

      <!-- Features -->
      <section class="relative z-10 px-6 pb-20 max-w-6xl mx-auto">
        <h2 class="text-2xl sm:text-3xl font-bold text-center mb-12 animate-fade-in-up">
          {{ 'landing.features_title' | transloco }}
        </h2>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <!-- Real-time -->
          <div class="card hover:border-[var(--color-primary)]/50 group animate-fade-in-up" style="animation-delay: 0.1s">
            <div class="w-12 h-12 rounded-lg bg-[var(--color-primary)]/10 flex items-center justify-center mb-4 group-hover:bg-[var(--color-primary)]/20 transition-colors">
              <svg class="w-6 h-6 text-[var(--color-primary)]" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/></svg>
            </div>
            <h3 class="font-semibold mb-2">{{ 'landing.feature_realtime_title' | transloco }}</h3>
            <p class="text-sm text-[var(--color-muted-foreground)]">{{ 'landing.feature_realtime_desc' | transloco }}</p>
          </div>
          <!-- Technical -->
          <div class="card hover:border-[var(--color-primary)]/50 group animate-fade-in-up" style="animation-delay: 0.2s">
            <div class="w-12 h-12 rounded-lg bg-[var(--color-accent)]/10 flex items-center justify-center mb-4 group-hover:bg-[var(--color-accent)]/20 transition-colors">
              <svg class="w-6 h-6 text-[var(--color-accent)]" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>
            </div>
            <h3 class="font-semibold mb-2">{{ 'landing.feature_technical_title' | transloco }}</h3>
            <p class="text-sm text-[var(--color-muted-foreground)]">{{ 'landing.feature_technical_desc' | transloco }}</p>
          </div>
          <!-- Sentiment -->
          <div class="card hover:border-[var(--color-primary)]/50 group animate-fade-in-up" style="animation-delay: 0.3s">
            <div class="w-12 h-12 rounded-lg bg-[var(--color-bull)]/10 flex items-center justify-center mb-4 group-hover:bg-[var(--color-bull)]/20 transition-colors">
              <svg class="w-6 h-6 text-[var(--color-bull)]" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            </div>
            <h3 class="font-semibold mb-2">{{ 'landing.feature_sentiment_title' | transloco }}</h3>
            <p class="text-sm text-[var(--color-muted-foreground)]">{{ 'landing.feature_sentiment_desc' | transloco }}</p>
          </div>
          <!-- AI Reports -->
          <div class="card hover:border-[var(--color-primary)]/50 group animate-fade-in-up" style="animation-delay: 0.4s">
            <div class="w-12 h-12 rounded-lg bg-[var(--color-bear)]/10 flex items-center justify-center mb-4 group-hover:bg-[var(--color-bear)]/20 transition-colors">
              <svg class="w-6 h-6 text-[var(--color-bear)]" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/></svg>
            </div>
            <h3 class="font-semibold mb-2">{{ 'landing.feature_reports_title' | transloco }}</h3>
            <p class="text-sm text-[var(--color-muted-foreground)]">{{ 'landing.feature_reports_desc' | transloco }}</p>
          </div>
        </div>
      </section>

      <!-- Latest Reports -->
      <section class="relative z-10 px-6 pb-20 max-w-6xl mx-auto">
        <div class="text-center mb-10 animate-fade-in-up">
          <h2 class="text-2xl sm:text-3xl font-bold mb-3">{{ 'landing.latest_reports' | transloco }}</h2>
          <p class="text-[var(--color-muted-foreground)]">{{ 'landing.latest_reports_desc' | transloco }}</p>
        </div>

        @if (reports().length > 0) {
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            @for (report of reports(); track report.id; let i = $index) {
              <a [routerLink]="['/reports', report.id]"
                class="card hover:border-[var(--color-primary)]/50 transition-all group animate-fade-in-up"
                [style.animation-delay]="(i * 0.05) + 's'">
                <div class="flex items-center justify-between mb-3">
                  <span class="text-lg font-bold text-[var(--color-primary)]">{{ report.symbol }}</span>
                  <div class="flex items-center gap-2">
                    @if (report.report_type === 'comprehensive') {
                      <span class="text-xs px-2 py-0.5 rounded-full bg-[var(--color-accent)]/15 text-[var(--color-accent)]">{{ 'reports.comprehensive' | transloco }}</span>
                    } @else {
                      <span class="text-xs px-2 py-0.5 rounded-full bg-[var(--color-muted)] text-[var(--color-muted-foreground)]">{{ 'reports.standard' | transloco }}</span>
                    }
                  </div>
                </div>
                <p class="text-sm text-[var(--color-muted-foreground)] line-clamp-2 mb-3">
                  {{ report.content?.aiSummary || '' }}
                </p>
                <div class="flex items-center justify-between text-xs text-[var(--color-muted-foreground)]">
                  <span>{{ report.created_at | date:'mediumDate' }}</span>
                  <span class="text-[var(--color-primary)] group-hover:underline">{{ 'landing.view_report' | transloco }} &rarr;</span>
                </div>
              </a>
            }
          </div>
        } @else {
          <p class="text-center text-[var(--color-muted-foreground)]">{{ 'landing.no_reports_yet' | transloco }}</p>
        }
      </section>

      <!-- Footer -->
      <footer class="relative z-10 border-t border-[var(--color-border)] px-6 py-8">
        <div class="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-[var(--color-muted-foreground)]">
          <span>
            <span class="text-[var(--color-primary)] font-semibold">Market</span><span class="text-[var(--color-accent)] font-semibold">AI</span>
            &copy; {{ currentYear }} &mdash; {{ 'landing.footer_rights' | transloco }}
          </span>
          <div class="flex gap-4">
            <a routerLink="/dashboard" class="hover:text-[var(--color-foreground)] transition-colors">{{ 'nav.dashboard' | transloco }}</a>
            <a routerLink="/reports" class="hover:text-[var(--color-foreground)] transition-colors">{{ 'nav.reports' | transloco }}</a>
          </div>
        </div>
      </footer>

    </div>
  `,
  styles: [`
    :host { display: block; }
    .line-clamp-2 {
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }

    /* ── Animated background ── */
    .hero-bg {
      position: absolute;
      inset: 0;
      pointer-events: none;
      overflow: hidden;
      z-index: 0;
    }

    /* Grid pattern */
    .hero-grid {
      position: absolute;
      inset: 0;
      background-image:
        linear-gradient(rgba(34, 197, 94, 0.03) 1px, transparent 1px),
        linear-gradient(90deg, rgba(34, 197, 94, 0.03) 1px, transparent 1px);
      background-size: 60px 60px;
      mask-image: radial-gradient(ellipse 80% 60% at 50% 30%, black 20%, transparent 70%);
      -webkit-mask-image: radial-gradient(ellipse 80% 60% at 50% 30%, black 20%, transparent 70%);
      animation: grid-drift 20s linear infinite;
    }

    @keyframes grid-drift {
      0% { transform: translateY(0); }
      100% { transform: translateY(60px); }
    }

    /* Glowing orbs */
    .hero-glow {
      position: absolute;
      border-radius: 50%;
      filter: blur(80px);
      opacity: 0.15;
      animation: glow-float 8s ease-in-out infinite;
    }
    .hero-glow-1 {
      width: 500px;
      height: 500px;
      background: hsl(160 80% 45%);
      top: -10%;
      left: 20%;
      animation-delay: 0s;
    }
    .hero-glow-2 {
      width: 400px;
      height: 400px;
      background: hsl(45 90% 55%);
      top: 10%;
      right: 10%;
      animation-delay: -4s;
      opacity: 0.08;
    }

    @keyframes glow-float {
      0%, 100% { transform: translate(0, 0) scale(1); }
      33% { transform: translate(30px, -20px) scale(1.05); }
      66% { transform: translate(-20px, 15px) scale(0.95); }
    }

    /* Floating particles */
    .hero-particles {
      position: absolute;
      inset: 0;
    }
    .particle {
      position: absolute;
      bottom: -10px;
      width: 2px;
      height: 2px;
      border-radius: 50%;
      background: hsl(160 80% 45%);
      opacity: 0;
      animation: particle-rise 6s ease-in infinite;
    }
    .particle:nth-child(even) {
      background: hsl(45 90% 55%);
      width: 3px;
      height: 3px;
    }

    @keyframes particle-rise {
      0% { opacity: 0; transform: translateY(0) scale(1); }
      10% { opacity: 0.6; }
      90% { opacity: 0.1; }
      100% { opacity: 0; transform: translateY(-100vh) scale(0.3); }
    }

    /* Scanline sweep */
    .hero-scanline {
      position: absolute;
      inset: 0;
      background: linear-gradient(
        180deg,
        transparent 0%,
        rgba(34, 197, 94, 0.02) 50%,
        transparent 100%
      );
      background-size: 100% 8px;
      animation: scanline-move 4s linear infinite;
      opacity: 0.5;
    }

    @keyframes scanline-move {
      0% { transform: translateY(-100%); }
      100% { transform: translateY(100%); }
    }
  `],
})
export class Landing implements OnInit {
  protected readonly langService = inject(LanguageService);
  protected readonly auth = inject(AuthService);
  private readonly aiApi = inject(AiApiService);

  reports = signal<AiReport[]>([]);
  currentYear = new Date().getFullYear();

  async ngOnInit() {
    try {
      const result = await this.aiApi.getReports(1, 12);
      this.reports.set(result.data);
    } catch (err) {
      console.error('Failed to load reports:', err);
    }
  }

  setLang(lang: SupportedLang) {
    this.langService.setLanguage(lang);
  }
}
