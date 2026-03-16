import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { AuthService } from '../../../core/auth/auth.service';

@Component({
  selector: 'app-signup',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, RouterLink, TranslocoPipe],
  template: `
    <h2 class="text-xl font-semibold mb-6">{{ 'auth.create_account' | transloco }}</h2>

    @if (auth.authError()) {
      <div class="mb-4 p-3 rounded bg-[var(--color-destructive)]/10 text-[var(--color-destructive)] text-sm">
        {{ auth.authError() }}
      </div>
    }

    @if (success()) {
      <div class="mb-4 p-3 rounded bg-[var(--color-primary)]/10 text-[var(--color-primary)] text-sm">
        {{ 'auth.account_created' | transloco }}
      </div>
    }

    <form (ngSubmit)="onSubmit()" class="space-y-4">
      <div>
        <label class="block text-sm font-medium mb-1">{{ 'auth.name' | transloco }}</label>
        <input type="text" [(ngModel)]="name" name="name" class="input" required />
      </div>
      <div>
        <label class="block text-sm font-medium mb-1">{{ 'auth.email' | transloco }}</label>
        <input type="email" [(ngModel)]="email" name="email" class="input" placeholder="you@example.com" required />
      </div>
      <div>
        <label class="block text-sm font-medium mb-1">{{ 'auth.password' | transloco }}</label>
        <input type="password" [(ngModel)]="password" name="password" class="input" [placeholder]="'auth.password_placeholder' | transloco" required />
      </div>
      <button type="submit" class="btn-primary w-full" [disabled]="loading()">
        {{ loading() ? ('auth.creating' | transloco) : ('auth.create_account' | transloco) }}
      </button>
    </form>

    <p class="mt-4 text-sm text-center text-[var(--color-muted-foreground)]">
      {{ 'auth.has_account' | transloco }}
      <a routerLink="/auth/login" class="text-[var(--color-primary)] hover:underline">{{ 'auth.sign_in' | transloco }}</a>
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
