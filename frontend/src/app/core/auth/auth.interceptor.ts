import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);
  const auth = inject(AuthService);

  if (req.url.startsWith(environment.apiUrl)) {
    req = req.clone({ withCredentials: true });
  }

  return next(req).pipe(
    tap({
      error: (error) => {
        if (error.status === 401 && !req.url.includes('/auth/')) {
          auth.logout().then(() => router.navigate(['/auth/login']));
        }
      },
    }),
  );
};
