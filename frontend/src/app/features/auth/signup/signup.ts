import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';

@Component({
  selector: 'app-signup',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, RouterLink],
  template: `
    <h2 class="text-xl font-semibold mb-6">Create Account</h2>

    @if (auth.authError()) {
      <div class="mb-4 p-3 rounded bg-[var(--color-destructive)]/10 text-[var(--color-destructive)] text-sm">
        {{ auth.authError() }}
      </div>
    }

    @if (success()) {
      <div class="mb-4 p-3 rounded bg-[var(--color-primary)]/10 text-[var(--color-primary)] text-sm">
        Account created! Check your email to verify your account.
      </div>
    }

    <form (ngSubmit)="onSubmit()" class="space-y-4">
      <div>
        <label class="block text-sm font-medium mb-1">Name</label>
        <input
          type="text"
          [(ngModel)]="name"
          name="name"
          class="input"
          placeholder="Your name"
          required
        />
      </div>
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
          placeholder="Min 8 chars, uppercase, number, special"
          required
        />
      </div>
      <button
        type="submit"
        class="btn-primary w-full"
        [disabled]="loading()"
      >
        {{ loading() ? 'Creating...' : 'Create Account' }}
      </button>
    </form>

    <p class="mt-4 text-sm text-center text-[var(--color-muted-foreground)]">
      Already have an account?
      <a routerLink="/auth/login" class="text-[var(--color-primary)] hover:underline">Sign in</a>
    </p>
  `,
})
export class Signup {
  protected readonly auth = inject(AuthService);

  name = '';
  email = '';
  password = '';
  loading = signal(false);
  success = signal(false);

  async onSubmit() {
    if (!this.name || !this.email || !this.password) return;
    this.loading.set(true);
    this.success.set(false);
    try {
      const response = await this.auth.signUp({
        name: this.name,
        email: this.email,
        password: this.password,
      });
      if (response.ok) {
        this.success.set(true);
      }
    } catch {
      // Error handled by AuthService
    } finally {
      this.loading.set(false);
    }
  }
}
