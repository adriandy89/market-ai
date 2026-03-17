import { ChangeDetectionStrategy, Component, inject, signal, OnInit } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-activate-user',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, TranslocoPipe],
  template: `
    <div class="min-h-screen flex items-center justify-center p-4">
      <div class="w-full max-w-md text-center">
        <h1 class="text-3xl font-bold mb-4">
          <span class="text-[var(--color-primary)]">Market</span><span class="text-[var(--color-accent)]">AI</span>
        </h1>

        @if (loading()) {
          <div class="card">
            <p class="text-[var(--color-muted-foreground)]">{{ 'activate.verifying' | transloco }}</p>
          </div>
        } @else if (success()) {
          <div class="card">
            <p class="text-[var(--color-primary)] text-lg font-semibold mb-2">{{ 'activate.success_title' | transloco }}</p>
            <p class="text-[var(--color-muted-foreground)] mb-4">{{ 'activate.success_message' | transloco }}</p>
            <a routerLink="/auth/login" class="btn-primary inline-block">{{ 'auth.sign_in' | transloco }}</a>
          </div>
        } @else {
          <div class="card">
            <p class="text-[var(--color-destructive)] text-lg font-semibold mb-2">{{ 'activate.failed_title' | transloco }}</p>
            <p class="text-[var(--color-muted-foreground)] mb-4">{{ errorMsg() }}</p>
            <a routerLink="/auth/login" class="btn-secondary inline-block">{{ 'auth.back_to_login' | transloco }}</a>
          </div>
        }
      </div>
    </div>
  `,
})
export class ActivateUser implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly http = inject(HttpClient);
  private readonly transloco = inject(TranslocoService);

  loading = signal(true);
  success = signal(false);
  errorMsg = signal('');

  async ngOnInit() {
    this.errorMsg.set(this.transloco.translate('activate.invalid_link'));

    const token = this.route.snapshot.queryParamMap.get('token');
    if (!token) {
      this.loading.set(false);
      this.errorMsg.set(this.transloco.translate('activate.no_token'));
      return;
    }

    try {
      const result = await firstValueFrom(
        this.http.get<any>(`${environment.apiUrl}/auth/activate-email/${token}`),
      );
      if (result.success) {
        this.success.set(true);
      } else {
        this.errorMsg.set(result.error || this.transloco.translate('activate.failed'));
      }
    } catch {
      this.errorMsg.set(this.transloco.translate('activate.invalid_link'));
    } finally {
      this.loading.set(false);
    }
  }
}
