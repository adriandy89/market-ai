import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { AuthService } from '../../core/auth/auth.service';

@Component({
  selector: 'app-dashboard-layout',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, TranslocoPipe, NgTemplateOutlet],
  template: `
    <div class="min-h-screen flex flex-col md:flex-row">

      <!-- Mobile top bar -->
      <div class="md:hidden flex items-center justify-between p-4 border-b border-[var(--color-border)] bg-[var(--color-sidebar)] sticky top-0 z-40">
        <h1 class="text-lg font-bold text-[var(--color-primary)]">Market AI</h1>
        <button (click)="sidebarOpen.set(true)" class="text-[var(--color-foreground)] text-2xl leading-none p-1">
          &#9776;
        </button>
      </div>

      <!-- Desktop sidebar -->
      <aside class="hidden md:flex w-64 shrink-0 bg-[var(--color-sidebar)] border-r border-[var(--color-sidebar-border)] flex-col sticky top-0 h-screen">
        <div class="p-5 border-b border-[var(--color-sidebar-border)]">
          <h1 class="text-xl font-bold text-[var(--color-primary)]">Market AI</h1>
        </div>
        <ng-container *ngTemplateOutlet="navContent" />
      </aside>

      <!-- Mobile drawer overlay -->
      @if (sidebarOpen()) {
        <div class="fixed inset-0 z-50 md:hidden flex">
          <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" (click)="sidebarOpen.set(false)"></div>
          <aside class="relative w-72 max-w-[80vw] h-full bg-[var(--color-sidebar)] border-r border-[var(--color-sidebar-border)] flex flex-col shadow-2xl animate-slide-in">
            <div class="p-5 border-b border-[var(--color-sidebar-border)] flex items-center justify-between">
              <h1 class="text-xl font-bold text-[var(--color-primary)]">Market AI</h1>
              <button (click)="sidebarOpen.set(false)" class="text-[var(--color-muted-foreground)] text-xl leading-none p-1 hover:text-[var(--color-foreground)]">
                &#10005;
              </button>
            </div>
            <ng-container *ngTemplateOutlet="navContent" />
          </aside>
        </div>
      }

      <!-- Main content -->
      <main class="flex-1 overflow-auto">
        <div class="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full">
          <router-outlet />
        </div>
      </main>
    </div>

    <!-- Shared nav template -->
    <ng-template #navContent>
      <nav class="flex-1 py-3 space-y-0.5">
        <a routerLink="/dashboard" routerLinkActive="nav-link-active" class="nav-link" (click)="sidebarOpen.set(false)">{{ 'nav.dashboard' | transloco }}</a>
        <a routerLink="/reports" routerLinkActive="nav-link-active" class="nav-link" (click)="sidebarOpen.set(false)">{{ 'nav.reports' | transloco }}</a>
        <a routerLink="/profile" routerLinkActive="nav-link-active" class="nav-link" (click)="sidebarOpen.set(false)">{{ 'nav.profile' | transloco }}</a>
      </nav>
      <div class="p-4 border-t border-[var(--color-sidebar-border)]">
        <div class="text-xs text-[var(--color-muted-foreground)] mb-2 truncate">
          {{ auth.user()?.email }}
        </div>
        <button (click)="onLogout()" class="btn-secondary w-full text-sm">
          {{ 'nav.logout' | transloco }}
        </button>
      </div>
    </ng-template>
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
  sidebarOpen = signal(false);

  async onLogout() {
    this.sidebarOpen.set(false);
    await this.auth.logout();
    this.router.navigate(['/auth/login']);
  }
}
