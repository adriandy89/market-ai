import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-landing',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  template: `
    <div class="min-h-screen flex flex-col items-center justify-center text-center p-8">
      <h1 class="text-5xl font-bold mb-4">
        <span class="text-[var(--color-primary)]">Market</span>
        <span class="text-[var(--color-accent)]">AI</span>
      </h1>
      <p class="text-xl text-[var(--color-muted-foreground)] mb-8 max-w-2xl">
        AI-powered crypto market analysis platform. Real-time data, technical indicators,
        sentiment analysis, and intelligent reports — all in one place.
      </p>
      <div class="flex gap-4">
        <a routerLink="/auth/signup" class="btn-primary text-lg px-8 py-3">Get Started</a>
        <a routerLink="/auth/login" class="btn-secondary text-lg px-8 py-3">Sign In</a>
      </div>
    </div>
  `,
})
export class Landing { }
