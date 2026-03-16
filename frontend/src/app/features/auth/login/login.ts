import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { AuthService } from '../../../core/auth/auth.service';

@Component({
  selector: 'app-login',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, RouterLink, TranslocoPipe],
  template: `
    <h2 class="text-xl font-semibold mb-6">{{ 'auth.sign_in' | transloco }}</h2>

    @if (auth.authError()) {
      <div class="mb-4 p-3 rounded bg-[var(--color-destructive)]/10 text-[var(--color-destructive)] text-sm">
        {{ auth.authError() }}
      </div>
    }

    <form (ngSubmit)="onSubmit()" class="space-y-4">
      <div>
        <label class="block text-sm font-medium mb-1">{{ 'auth.email' | transloco }}</label>
        <input type="email" [(ngModel)]="email" name="email" class="input" placeholder="you@example.com" required />
      </div>
      <div>
        <label class="block text-sm font-medium mb-1">{{ 'auth.password' | transloco }}</label>
        <input type="password" [(ngModel)]="password" name="password" class="input" required />
      </div>
      <button type="submit" class="btn-primary w-full" [disabled]="loading()">
        {{ loading() ? ('auth.signing_in' | transloco) : ('auth.sign_in' | transloco) }}
      </button>
    </form>

    <div class="mt-4 text-sm text-center space-y-2">
      <a routerLink="/auth/forgot-password" class="text-[var(--color-primary)] hover:underline block">
        {{ 'auth.forgot_password' | transloco }}
      </a>
      <p class="text-[var(--color-muted-foreground)]">
        {{ 'auth.no_account' | transloco }}
        <a routerLink="/auth/signup" class="text-[var(--color-primary)] hover:underline">{{ 'auth.sign_up' | transloco }}</a>
      </p>
    </div>
  `,
})
export class Login {
  protected readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  email = '';
  password = '';
  loading = signal(false);

  async onSubmit() {
    if (!this.email || !this.password) return;
    this.loading.set(true);
    try {
      await this.auth.signIn({ username: this.email, password: this.password });
      this.router.navigate(['/dashboard']);
    } catch {
      // Error is handled by AuthService
    } finally {
      this.loading.set(false);
    }
  }
}
