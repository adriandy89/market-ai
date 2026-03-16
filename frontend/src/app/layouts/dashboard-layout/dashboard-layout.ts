import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router, RouterLink, RouterOutlet } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';

@Component({
  selector: 'app-dashboard-layout',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, RouterLink],
  template: `
    <div class="min-h-screen flex">
      <!-- Sidebar -->
      <aside class="w-64 bg-[var(--color-sidebar)] border-r border-[var(--color-sidebar-border)] flex flex-col">
        <div class="p-4 border-b border-[var(--color-sidebar-border)]">
          <h1 class="text-xl font-bold text-[var(--color-primary)]">Market AI</h1>
        </div>
        <nav class="flex-1 py-4">
          <a routerLink="/dashboard" class="nav-link">Dashboard</a>
          <a routerLink="/reports" class="nav-link">AI Reports</a>
        </nav>
        <div class="p-4 border-t border-[var(--color-sidebar-border)]">
          <div class="text-sm text-[var(--color-muted-foreground)] mb-2">
            {{ auth.user()?.email }}
          </div>
          <button (click)="onLogout()" class="btn-secondary w-full text-sm">
            Logout
          </button>
        </div>
      </aside>

      <!-- Main Content -->
      <main class="flex-1 overflow-auto">
        <div class="p-6">
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
      padding: 0.625rem 1rem;
      font-size: 0.875rem;
      font-weight: 500;
      color: var(--color-sidebar-foreground);
      text-decoration: none;
      border-left: 2px solid transparent;
      transition: all 0.2s;
    }
    .nav-link:hover {
      background: var(--color-secondary);
      border-color: hsl(160 80% 45% / 0.5);
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
