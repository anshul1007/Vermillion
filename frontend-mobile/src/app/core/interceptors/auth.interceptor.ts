import { HttpInterceptorFn, HttpRequest, HttpHandlerFn, HttpEvent } from '@angular/common/http';
import { inject } from '@angular/core';
import { ApiService } from '../services/api.service';
import { AuthService } from '../auth/auth.service';
import { Observable, throwError } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';

export const authInterceptor: HttpInterceptorFn = (req: HttpRequest<any>, next: HttpHandlerFn): Observable<HttpEvent<any>> => {
  const auth = inject(AuthService);
  const api = inject(ApiService);

  const token = auth.getToken?.() || localStorage.getItem('accessToken') || localStorage.getItem('auth_token');
  const authReq = token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;

  return next(authReq).pipe(
    catchError((err: any) => {
      const status = err?.status || err?.statusCode || (err?.error && err.error.status);
      if (status === 401) {
        const refresh = auth.getRefreshToken?.();
        if (!refresh) return throwError(() => err);
        return api.refreshToken(refresh).pipe(
          switchMap((refreshResp: any) => {
            if (refreshResp && refreshResp.data && refreshResp.data.accessToken) {
              auth.saveNewTokens(refreshResp.data.accessToken, refreshResp.data.refreshToken);
              const newReq = req.clone({ setHeaders: { Authorization: `Bearer ${refreshResp.data.accessToken}` } });
              return next(newReq);
            }
            return throwError(() => err);
          }),
          catchError(() => throwError(() => err))
        );
      }
      return throwError(() => err);
    })
  );
};

export const authInterceptorProvider = { provide: 'authInterceptor', useValue: authInterceptor };
// single exported interceptor defined above
