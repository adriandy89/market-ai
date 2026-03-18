import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { AuthService } from '../../core/auth/auth.service';
import { LanguageService, type SupportedLang } from '../../core/services/language.service';
import { TelegramApiService } from '../../core/services/telegram.service';

@Component({
  selector: 'app-profile',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoPipe],
  template: `
    <div class="animate-fade-in max-w-3xl mx-auto">
      <h1 class="text-2xl font-bold mb-6">{{ 'profile.title' | transloco }}</h1>

      <!-- Language -->
      <div class="card mb-6">
        <h2 class="text-lg font-semibold mb-2">{{ 'profile.language' | transloco }}</h2>
        <p class="text-sm text-[var(--color-muted-foreground)] mb-4">{{ 'profile.language_desc' | transloco }}</p>
        <div class="flex gap-2">
          @for (lang of langs; track lang.code) {
            <button
              (click)="onSetLanguage(lang.code)"
              class="px-4 py-2 rounded text-sm font-medium border transition-colors"
              [class]="langService.currentLang() === lang.code
                ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10 text-[var(--color-primary)]'
                : 'border-[var(--color-border)] text-[var(--color-muted-foreground)] hover:border-[var(--color-primary)]/50'"
            >
              {{ lang.labelKey | transloco }}
            </button>
          }
        </div>
      </div>

      <!-- Telegram -->
      <div class="card mb-6">
        <div class="flex items-center justify-between mb-2">
          <h2 class="text-lg font-semibold">Telegram</h2>
          @if (telegramLinked()) {
            <span class="inline-flex items-center gap-1.5 text-xs font-medium text-green-500">
              <span class="w-2 h-2 rounded-full bg-green-500"></span>
              {{ 'profile.telegram_linked' | transloco }}
            </span>
          } @else {
            <span class="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--color-muted-foreground)]">
              <span class="w-2 h-2 rounded-full bg-gray-400"></span>
              {{ 'profile.telegram_not_linked' | transloco }}
            </span>
          }
        </div>
        <p class="text-sm text-[var(--color-muted-foreground)] mb-4">{{ 'profile.telegram_desc' | transloco }}</p>

        @if (telegramLinked()) {
          <button (click)="unlinkTelegram()" class="btn-secondary text-sm">
            {{ 'profile.telegram_unlink' | transloco }}
          </button>
        } @else if (telegramCode()) {
          <div class="bg-[var(--color-secondary)] rounded-lg p-4 space-y-3">
            <p class="text-sm font-medium">{{ 'profile.telegram_code_instructions' | transloco }}</p>
            <div class="flex items-center gap-2">
              <code class="bg-[var(--color-background)] px-3 py-2 rounded text-sm font-mono flex-1">
                /verify {{ telegramCode() }}
              </code>
              <button (click)="copyCode()" class="btn-secondary text-sm px-3 py-2">
                {{ codeCopied() ? '✓' : 'Copy' }}
              </button>
            </div>
            <div class="flex gap-2 text-sm">
              <a [href]="botLink()" target="_blank" rel="noopener" class="btn-primary text-sm px-4 py-2">
                {{ 'profile.telegram_open_bot' | transloco }}
              </a>
            </div>
            <p class="text-xs text-[var(--color-muted-foreground)]">{{ 'profile.telegram_code_expires' | transloco }}</p>
          </div>
        } @else {
          <button (click)="linkTelegram()" [disabled]="loadingTelegram()" class="btn-primary text-sm">
            @if (loadingTelegram()) {
              {{ 'profile.telegram_generating' | transloco }}
            } @else {
              {{ 'profile.telegram_generate' | transloco }}
            }
          </button>
        }
      </div>

      <!-- Account Info -->
      <div class="card">
        <h2 class="text-lg font-semibold mb-4">{{ 'profile.account' | transloco }}</h2>
        <div class="space-y-3 text-sm">
          <div class="flex justify-between">
            <span class="text-[var(--color-muted-foreground)]">{{ 'profile.name' | transloco }}</span>
            <span class="font-medium">{{ auth.user()?.name }}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-[var(--color-muted-foreground)]">{{ 'profile.email' | transloco }}</span>
            <span class="font-medium">{{ auth.user()?.email }}</span>
          </div>
        </div>
      </div>
    </div>
  `,
})
export class Profile implements OnInit {
  protected readonly auth = inject(AuthService);
  protected readonly langService = inject(LanguageService);
  private readonly telegramApi = inject(TelegramApiService);

  botLink = signal('');
  telegramLinked = signal(false);
  telegramCode = signal<string | null>(null);
  loadingTelegram = signal(false);
  codeCopied = signal(false);

  langs: { code: SupportedLang; labelKey: string }[] = [
    { code: 'es', labelKey: 'profile.spanish' },
    { code: 'en', labelKey: 'profile.english' },
  ];

  async ngOnInit() {
    try {
      const { linked } = await this.telegramApi.getStatus();
      this.telegramLinked.set(linked);
    } catch {}
  }

  onSetLanguage(lang: SupportedLang) {
    this.langService.setLanguage(lang);
    this.langService.syncToBackend(lang);
  }

  async linkTelegram() {
    this.loadingTelegram.set(true);
    try {
      const res = await this.telegramApi.generateCode();
      if (res.success && res.code) {
        this.telegramCode.set(res.code);
        this.botLink.set(res.botLink ?? '');
      }
    } catch {} finally {
      this.loadingTelegram.set(false);
    }
  }

  async unlinkTelegram() {
    try {
      await this.telegramApi.unlink();
      this.telegramLinked.set(false);
      this.telegramCode.set(null);
    } catch {}
  }

  async copyCode() {
    const code = this.telegramCode();
    if (!code) return;
    try {
      await navigator.clipboard.writeText(`/verify ${code}`);
      this.codeCopied.set(true);
      setTimeout(() => this.codeCopied.set(false), 2000);
    } catch {}
  }
}
