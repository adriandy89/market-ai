import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { AuthService } from '../../core/auth/auth.service';

@Component({
  selector: 'app-dashboard-layout',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, TranslocoPipe],
  template: `
    <div class="min-h-screen flex">
      <!-- Sidebar -->
      <aside class="w-64 shrink-0 bg-[var(--color-sidebar)] border-r border-[var(--color-sidebar-border)] flex flex-col sticky top-0 h-screen">
        <div class="p-5 border-b border-[var(--color-sidebar-border)]">
          <h1 class="text-xl font-bold text-[var(--color-primary)]">Market AI</h1>
        </div>
        <nav class="flex-1 py-3 space-y-0.5">
          <a routerLink="/dashboard" routerLinkActive="nav-link-active" class="nav-link">{{ 'nav.dashboard' | transloco }}</a>
          <a routerLink="/reports" routerLinkActive="nav-link-active" class="nav-link">{{ 'nav.reports' | transloco }}</a>
          <a routerLink="/profile" routerLinkActive="nav-link-active" class="nav-link">{{ 'nav.profile' | transloco }}</a>
        </nav>
        <div class="p-4 border-t border-[var(--color-sidebar-border)]">
          <div class="text-xs text-[var(--color-muted-foreground)] mb-2 truncate">
            {{ auth.user()?.email }}
          </div>
          <button (click)="onLogout()" class="btn-secondary w-full text-sm">
            {{ 'nav.logout' | transloco }}
          </button>
        </div>
      </aside>

      <!-- Main Content -->
      <main class="flex-1 overflow-auto min-h-screen bg-[var(--color-background)]">
        <div class="p-6 lg:p-8 max-w-7xl mx-auto w-full">
          <router-outlet />
        </div>
      </main>
    </div>
  `,
  styles: [`
    .nav-link {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.625rem 1.25rem;
      margin: 0 0.5rem;
      font-size: 0.875rem;
      font-weight: 500;
      color: var(--color-sidebar-foreground);
      text-decoration: none;
      border-radius: 0.375rem;
      transition: all 0.15s;
    }
    .nav-link:hover {
      background: var(--color-secondary);
      color: var(--color-foreground);
    }
    .nav-link-active {
      background: hsl(160 80% 45% / 0.1);
      color: var(--color-primary);
      font-weight: 600;
    }
  `],
})
export class DashboardLayout {
  protected readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  async onLogout() {
    await this.auth.logout();
    this.router.navigate(['/auth/login']);
  }
}
