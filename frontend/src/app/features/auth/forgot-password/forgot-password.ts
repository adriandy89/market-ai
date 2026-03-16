import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';

@Component({
  selector: 'app-forgot-password',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, RouterLink],
  template: `
    <h2 class="text-xl font-semibold mb-6">Reset Password</h2>

    @if (sent()) {
      <div class="mb-4 p-3 rounded bg-[var(--color-primary)]/10 text-[var(--color-primary)] text-sm">
        If that email exists, you'll receive a reset link shortly.
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
      <button
        type="submit"
        class="btn-primary w-full"
        [disabled]="loading()"
      >
        {{ loading() ? 'Sending...' : 'Send Reset Link' }}
      </button>
    </form>

    <p class="mt-4 text-sm text-center">
      <a routerLink="/auth/login" class="text-[var(--color-primary)] hover:underline">Back to login</a>
    </p>
  `,
})
export class ForgotPassword {
  private readonly auth = inject(AuthService);

  email = '';
  loading = signal(false);
  sent = signal(false);

  async onSubmit() {
    if (!this.email) return;
    this.loading.set(true);
    try {
      await this.auth.forgotPassword({ email: this.email });
      this.sent.set(true);
    } catch {
      // Still show sent message for security
      this.sent.set(true);
    } finally {
      this.loading.set(false);
    }
  }
}
