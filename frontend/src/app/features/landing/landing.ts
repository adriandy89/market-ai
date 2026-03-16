import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';

@Component({
  selector: 'app-landing',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, TranslocoPipe],
  template: `
    <div class="min-h-screen flex flex-col items-center justify-center text-center p-6 sm:p-8">
      <h1 class="text-4xl sm:text-5xl font-bold mb-4">
        <span class="text-[var(--color-primary)]">Market</span>
        <span class="text-[var(--color-accent)]">AI</span>
      </h1>
      <p class="text-xl text-[var(--color-muted-foreground)] mb-8 max-w-2xl">
        {{ 'landing.subtitle' | transloco }}
      </p>
      <div class="flex flex-col sm:flex-row gap-3 sm:gap-4 w-full sm:w-auto">
        <a routerLink="/auth/signup" class="btn-primary text-lg px-8 py-3">{{ 'landing.get_started' | transloco }}</a>
        <a routerLink="/auth/login" class="btn-secondary text-lg px-8 py-3">{{ 'landing.sign_in' | transloco }}</a>
      </div>
    </div>
  `,
})
export class Landing { }
