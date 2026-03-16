import { Routes } from '@angular/router';
import { authGuard } from './core/auth/auth.guard';
import { guestGuard } from './core/auth/guest.guard';

export const routes: Routes = [
  // ── Public landing page ──
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () => import('./features/landing/landing').then((m) => m.Landing),
  },
  // ── Email activation (public) ──
  {
    path: 'activate-user',
    loadComponent: () =>
      import('./features/activate-user/activate-user').then((m) => m.ActivateUser),
  },
  // ── Auth routes (guest only) ──
  {
    path: 'auth',
    canActivate: [guestGuard],
    loadComponent: () => import('./layouts/auth-layout/auth-layout').then((m) => m.AuthLayout),
    children: [
      {
        path: 'login',
        loadComponent: () => import('./features/auth/login/login').then((m) => m.Login),
      },
      {
        path: 'signup',
        loadComponent: () => import('./features/auth/signup/signup').then((m) => m.Signup),
      },
      {
        path: 'forgot-password',
        loadComponent: () =>
          import('./features/auth/forgot-password/forgot-password').then((m) => m.ForgotPassword),
      },
      {
        path: '',
        redirectTo: 'login',
        pathMatch: 'full',
      },
    ],
  },
  // ── Protected routes ──
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./layouts/dashboard-layout/dashboard-layout').then((m) => m.DashboardLayout),
    children: [
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./features/dashboard/dashboard').then((m) => m.Dashboard),
      },
      {
        path: 'coin/:symbol',
        loadComponent: () =>
          import('./features/coin-detail/coin-detail').then((m) => m.CoinDetail),
      },
      {
        path: 'reports',
        loadComponent: () =>
          import('./features/ai-reports/ai-reports').then((m) => m.AiReports),
      },
      {
        path: 'reports/:id',
        loadComponent: () =>
          import('./features/ai-reports/report-detail/report-detail').then((m) => m.ReportDetail),
      },
    ],
  },
  {
    path: '**',
    redirectTo: '',
  },
];
