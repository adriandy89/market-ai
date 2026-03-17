import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { AuthService } from '../../core/auth/auth.service';
import { LanguageService, type SupportedLang } from '../../core/services/language.service';

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
export class Profile {
  protected readonly auth = inject(AuthService);
  protected readonly langService = inject(LanguageService);

  langs: { code: SupportedLang; labelKey: string }[] = [
    { code: 'es', labelKey: 'profile.spanish' },
    { code: 'en', labelKey: 'profile.english' },
  ];

  onSetLanguage(lang: SupportedLang) {
    this.langService.setLanguage(lang);
    this.langService.syncToBackend(lang);
  }
}
