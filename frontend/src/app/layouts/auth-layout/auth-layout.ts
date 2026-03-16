import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-auth-layout',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet],
  template: `
    <div class="min-h-screen flex items-center justify-center p-4">
      <div class="w-full max-w-md">
        <div class="text-center mb-8">
          <h1 class="text-3xl font-bold text-[var(--color-primary)]">Market AI</h1>
          <p class="text-[var(--color-muted-foreground)] mt-2">Crypto Analysis with AI</p>
        </div>
        <div class="card">
          <router-outlet />
        </div>
      </div>
    </div>
  `,
})
export class AuthLayout { }
