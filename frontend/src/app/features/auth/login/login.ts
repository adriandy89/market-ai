import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';

@Component({
  selector: 'app-login',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, RouterLink],
  template: `
    <h2 class="text-xl font-semibold mb-6">Sign In</h2>

    @if (auth.authError()) {
      <div class="mb-4 p-3 rounded bg-[var(--color-destructive)]/10 text-[var(--color-destructive)] text-sm">
        {{ auth.authError() }}
      </div>
    }

    <form (ngSubmit)="onSubmit()" class="space-y-4">
      <div>
        <label class="block text-sm font-medium mb-1">Email</label>
        <input
          type="email"
          [(ngModel)]="email"
          name="email"
          class="input"
          placeholder="you@example.com"
          required
        />
      </div>
      <div>
        <label class="block text-sm font-medium mb-1">Password</label>
        <input
          type="password"
          [(ngModel)]="password"
          name="password"
          class="input"
          placeholder="Your password"
          required
        />
      </div>
      <button
        type="submit"
        class="btn-primary w-full"
        [disabled]="loading()"
      >
        {{ loading() ? 'Signing in...' : 'Sign In' }}
      </button>
    </form>

    <div class="mt-4 text-sm text-center space-y-2">
      <a routerLink="/auth/forgot-password" class="text-[var(--color-primary)] hover:underline block">
        Forgot password?
      </a>
      <p class="text-[var(--color-muted-foreground)]">
        Don't have an account?
        <a routerLink="/auth/signup" class="text-[var(--color-primary)] hover:underline">Sign up</a>
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
