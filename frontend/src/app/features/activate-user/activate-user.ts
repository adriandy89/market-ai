import { ChangeDetectionStrategy, Component, inject, signal, OnInit } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-activate-user',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  template: `
    <div class="min-h-screen flex items-center justify-center p-4">
      <div class="w-full max-w-md text-center">
        <h1 class="text-3xl font-bold mb-4">
          <span class="text-[var(--color-primary)]">Market</span><span class="text-[var(--color-accent)]">AI</span>
        </h1>

        @if (loading()) {
          <div class="card">
            <p class="text-[var(--color-muted-foreground)]">Verifying your email...</p>
          </div>
        } @else if (success()) {
          <div class="card">
            <p class="text-[var(--color-primary)] text-lg font-semibold mb-2">Email Verified!</p>
            <p class="text-[var(--color-muted-foreground)] mb-4">Your account is now active. You can sign in.</p>
            <a routerLink="/auth/login" class="btn-primary inline-block">Sign In</a>
          </div>
        } @else {
          <div class="card">
            <p class="text-[var(--color-destructive)] text-lg font-semibold mb-2">Verification Failed</p>
            <p class="text-[var(--color-muted-foreground)] mb-4">{{ errorMsg() }}</p>
            <a routerLink="/auth/login" class="btn-secondary inline-block">Back to Login</a>
          </div>
        }
      </div>
    </div>
  `,
})
export class ActivateUser implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly http = inject(HttpClient);

  loading = signal(true);
  success = signal(false);
  errorMsg = signal('The verification link is invalid or has expired.');

  async ngOnInit() {
    const token = this.route.snapshot.queryParamMap.get('token');
    if (!token) {
      this.loading.set(false);
      this.errorMsg.set('No verification token provided.');
      return;
    }

    try {
      const result = await firstValueFrom(
        this.http.get<any>(`${environment.apiUrl}/auth/activate-email/${token}`),
      );
      if (result.success) {
        this.success.set(true);
      } else {
        this.errorMsg.set(result.error || 'Verification failed.');
      }
    } catch {
      this.errorMsg.set('The verification link is invalid or has expired.');
    } finally {
      this.loading.set(false);
    }
  }
}
