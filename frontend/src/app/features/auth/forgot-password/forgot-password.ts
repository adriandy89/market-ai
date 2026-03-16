import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { AuthService } from '../../../core/auth/auth.service';

@Component({
  selector: 'app-forgot-password',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, RouterLink, TranslocoPipe],
  template: `
    <h2 class="text-xl font-semibold mb-6">{{ 'auth.reset_password' | transloco }}</h2>

    @if (sent()) {
      <div class="mb-4 p-3 rounded bg-[var(--color-primary)]/10 text-[var(--color-primary)] text-sm">
        {{ 'auth.reset_sent' | transloco }}
      </div>
    }

    <form (ngSubmit)="onSubmit()" class="space-y-4">
      <div>
        <label class="block text-sm font-medium mb-1">{{ 'auth.email' | transloco }}</label>
        <input type="email" [(ngModel)]="email" name="email" class="input" placeholder="you@example.com" required />
      </div>
      <button type="submit" class="btn-primary w-full" [disabled]="loading()">
        {{ loading() ? ('auth.sending' | transloco) : ('auth.send_reset' | transloco) }}
      </button>
    </form>

    <p class="mt-4 text-sm text-center">
      <a routerLink="/auth/login" class="text-[var(--color-primary)] hover:underline">{{ 'auth.back_to_login' | transloco }}</a>
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
      this.sent.set(true);
    } finally {
      this.loading.set(false);
    }
  }
}
