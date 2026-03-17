import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';

@Component({
  selector: 'app-auth-layout',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, RouterLink, TranslocoPipe],
  template: `
    <div class="min-h-screen flex items-center justify-center p-4">
      <div class="w-full max-w-md">
        <div class="text-center mb-8">
          <a routerLink="/" class="text-3xl font-bold text-[var(--color-primary)] no-underline hover:brightness-125 transition-all">Market AI</a>
          <p class="text-[var(--color-muted-foreground)] mt-2">{{ 'auth.tagline' | transloco }}</p>
        </div>
        <div class="card">
          <router-outlet />
        </div>
        <div class="text-center mt-4">
          <a routerLink="/" class="text-sm text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)] transition-colors">
            &larr; {{ 'auth.back_to_home' | transloco }}
          </a>
        </div>
      </div>
    </div>
  `,
})
export class AuthLayout { }
