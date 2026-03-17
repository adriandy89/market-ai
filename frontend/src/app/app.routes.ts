import { Routes } from '@angular/router';
import { adminGuard } from './core/auth/admin.guard';
import { authGuard } from './core/auth/auth.guard';
import { guestGuard } from './core/auth/guest.guard';

export const routes: Routes = [
  // ── Public landing page ──
  {
    path: '',
    pathMatch: 'full',
    title: 'Market AI - Análisis Cripto con IA',
    loadComponent: () => import('./features/landing/landing').then((m) => m.Landing),
  },
  // ── Email activation (public) ──
  {
    path: 'activate-user',
    title: 'Verificar Email | Market AI',
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
        title: 'Iniciar Sesión | Market AI',
        loadComponent: () => import('./features/auth/login/login').then((m) => m.Login),
      },
      {
        path: 'signup',
        title: 'Crear Cuenta | Market AI',
        loadComponent: () => import('./features/auth/signup/signup').then((m) => m.Signup),
      },
      {
        path: 'forgot-password',
        title: 'Recuperar Contraseña | Market AI',
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
  // ── Public routes (with layout, no auth) ──
  {
    path: '',
    loadComponent: () =>
      import('./layouts/dashboard-layout/dashboard-layout').then((m) => m.DashboardLayout),
    children: [
      {
        path: 'dashboard',
        title: 'Dashboard | Market AI',
        loadComponent: () =>
          import('./features/dashboard/dashboard').then((m) => m.Dashboard),
      },
      {
        path: 'reports',
        title: 'Reportes AI | Market AI',
        loadComponent: () =>
          import('./features/ai-reports/ai-reports').then((m) => m.AiReports),
      },
      {
        path: 'reports/:id',
        title: 'Reporte | Market AI',
        loadComponent: () =>
          import('./features/ai-reports/report-detail/report-detail').then((m) => m.ReportDetail),
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
        path: 'coin/:symbol',
        title: 'Análisis | Market AI',
        loadComponent: () =>
          import('./features/coin-detail/coin-detail').then((m) => m.CoinDetail),
      },
      {
        path: 'profile',
        title: 'Perfil | Market AI',
        loadComponent: () =>
          import('./features/profile/profile').then((m) => m.Profile),
      },
    ],
  },
  // ── Admin routes ──
  {
    path: '',
    canActivate: [adminGuard],
    loadComponent: () =>
      import('./layouts/dashboard-layout/dashboard-layout').then((m) => m.DashboardLayout),
    children: [
      {
        path: 'admin/scheduled-reports',
        title: 'Reportes Programados | Market AI',
        loadComponent: () =>
          import('./features/admin/scheduled-reports-config').then((m) => m.ScheduledReportsConfig),
      },
    ],
  },
  {
    path: '**',
    redirectTo: '',
  },
];
