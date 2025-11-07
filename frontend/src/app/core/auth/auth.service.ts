import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';
import { map, tap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { User, AuthResponse, LoginRequest, UserRole } from '../../shared/models/user.model';
import { ApiResponse } from '../../shared/models/api-response.model';
// Backend DTOs returned by AuthAPI
interface BackendTenantDto {
  tenantId?: number;
  tenantName?: string;
  domain?: string;
  roleName?: string;
  permissions?: string[];
}

interface BackendUserDto {
  id?: number;
  username?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  tenants?: BackendTenantDto[];
  externalProvider?: string | null;
}

interface BackendLoginResponse {
  accessToken?: string;
  refreshToken?: string;
  token?: string; // permissive fallback
  user?: BackendUserDto;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private http = inject(HttpClient);
  private currentUserSubject = new BehaviorSubject<User | null>(null);
  public currentUser$ = this.currentUserSubject.asObservable();

  private readonly apiUrl = `${environment.apiUrl}/auth`;

  constructor() {
    this.loadUserFromStorage();
  }

  get currentUser(): User | null {
    return this.currentUserSubject.value;
  }

  get isAuthenticated(): boolean {
    return !!this.getToken();
  }

  login(credentials: LoginRequest): Observable<AuthResponse> {
    return this.http.post<ApiResponse<BackendLoginResponse>>(`${this.apiUrl}/login`, credentials)
      .pipe(
        map(response => {
          if (!response.success || !response.data) {
            throw new Error(response.error || 'Login failed');
          }
          const data = response.data as BackendLoginResponse;

          // Support different casing from backend (AccessToken / accessToken / token)
          const token = data.accessToken ?? data.token ?? '';
          const refreshToken = data.refreshToken ?? undefined;

          // User info
          const u = data.user ?? {} as BackendUserDto;

          // Determine primary role from tenant role names
          const tenants: BackendTenantDto[] = u.tenants ?? [];
          const roleNames: string[] = tenants.map(t => t.roleName ?? '').filter(Boolean);

          let primaryRole: UserRole = UserRole.Employee;
          if (roleNames.some(r => r === 'SystemAdmin')) primaryRole = UserRole.SystemAdmin;
          else if (roleNames.some(r => r === 'Admin')) primaryRole = UserRole.Admin;
          else if (roleNames.some(r => r === 'Manager')) primaryRole = UserRole.Manager;
          else if (roleNames.some(r => r === 'Guard')) primaryRole = UserRole.Guard;
          else primaryRole = UserRole.Employee;

          const user: User = {
            id: String(u.id ?? ''),
            email: u.email ?? '',
            firstName: u.firstName ?? '',
            lastName: u.lastName ?? '',
            employeeId: '',
            role: primaryRole,
            tenants: tenants.map(t => ({
              tenantId: t.tenantId,
              tenantName: t.tenantName,
              domain: t.domain,
              roleName: t.roleName,
              permissions: t.permissions
            })),
            managerId: undefined,
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date()
          };

          const authResponse: AuthResponse = {
            token: token,
            refreshToken: refreshToken,
            user
          };

          return authResponse;
        }),
        tap(authResponse => {
          if (authResponse.token) {
            this.setToken(authResponse.token);
          }
          if (authResponse.refreshToken) {
            this.setRefreshToken(authResponse.refreshToken);
          }
          this.currentUserSubject.next(authResponse.user);
          this.saveUserToStorage(authResponse.user);
        })
      );
  }

  logout(): Observable<any> {
    return this.http.post(`${this.apiUrl}/logout`, {})
      .pipe(
        tap(() => {
          this.clearAuthData();
        }),
        // Catch errors to ensure auth data is cleared even if API call fails
        tap({
          error: () => {
            this.clearAuthData();
          }
        })
      );
  }

  refreshToken(): Observable<string> {
    const refreshToken = this.getRefreshToken();
    return this.http.post<ApiResponse<{ token: string }>>(`${this.apiUrl}/refresh`, { token: refreshToken })
      .pipe(
        map(response => {
          if (response.success && response.data) {
            this.setToken(response.data.token);
            return response.data.token;
          }
          throw new Error('Token refresh failed');
        })
      );
  }

  getToken(): string | null {
    return localStorage.getItem(environment.tokenKey);
  }

  private setToken(token: string): void {
    localStorage.setItem(environment.tokenKey, token);
  }

  private getRefreshToken(): string | null {
    return localStorage.getItem(environment.refreshTokenKey);
  }

  private setRefreshToken(token: string): void {
    localStorage.setItem(environment.refreshTokenKey, token);
  }

  private saveUserToStorage(user: User): void {
    localStorage.setItem('currentUser', JSON.stringify(user));
  }

  private loadUserFromStorage(): void {
    const userJson = localStorage.getItem('currentUser');
    if (userJson) {
      try {
        const user = JSON.parse(userJson);
        this.currentUserSubject.next(user);
      } catch (error) {
        console.error('Error loading user from storage', error);
      }
    }
  }

  private clearAuthData(): void {
    localStorage.removeItem(environment.tokenKey);
    localStorage.removeItem(environment.refreshTokenKey);
    localStorage.removeItem('currentUser');
    this.currentUserSubject.next(null);
  }

  hasRole(role: string): boolean {
    return this.currentUser?.role === role;
  }

  hasAnyRole(roles: string[]): boolean {
    return roles.some(role => this.hasRole(role));
  }
}
