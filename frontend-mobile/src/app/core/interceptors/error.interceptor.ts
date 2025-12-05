import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from '../auth/auth.service';
import { catchError, tap } from 'rxjs/operators';
import { throwError } from 'rxjs';
import { NotificationService } from '../services/notification.service';

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const notifier = inject(NotificationService);

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      // Handle unauthorized globally
      if (error.status === 401) {
        try {
          authService.logout();
        } catch (e) {
          // ignore
        }
      }

      // For 4xx/5xx show a user-facing message centrally.
      if (typeof error.status === 'number' && error.status >= 400 && error.status < 600) {
        const msg =
          (error && (error.error?.message || error.error?.Message)) || error.message || `Request failed (${error.status})`;
        try {
          notifier.showError(msg, 6000);
        } catch (e) {
          // ignore notifier failures
        }
      }

      return throwError(() => error);
    })
  );
};
