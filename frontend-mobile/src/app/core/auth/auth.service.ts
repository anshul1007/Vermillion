import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap, map, forkJoin, throwError } from 'rxjs';
import { take } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

export interface LoginRequest {
  email: string;
  password: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: {
    id: number;
    username: string;
    email: string;
    tenants: Array<{
      tenantId: number;
      tenantName: string;
      domain: string;
      roleName: string;
      permissions: string[];
    }>;
    externalProvider?: string;
  };
}

export interface GuardProfile {
  id: number;
  authUserId: number;
  firstName: string;
  lastName: string;
  guardId: string;
  phoneNumber: string;
  projectId: number;
  projectName: string;
  isActive: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private http = inject(HttpClient);
  private router = inject(Router);
  
  private readonly TOKEN_KEY = 'auth_token';
  private readonly USER_KEY = 'current_user';
  
  currentUser = signal<LoginResponse | null>(null);
  guardProfile = signal<GuardProfile | null>(null);
  isAuthenticated = signal(false);

  constructor() {
    this.loadAuthState();
  }

  login(credentials: LoginRequest): Observable<LoginResponse> {
    return this.http.post<ApiResponse<LoginResponse>>(
      `${environment.authApiUrl}/auth/login`,
      { ...credentials, tenantDomain: 'entryexit' }
    ).pipe(
      map(apiResponse => {
        if (!apiResponse.success || !apiResponse.data) {
          throw new Error(apiResponse.message || 'Login failed');
        }
        return apiResponse.data;
      }),
      tap(response => {
        this.saveAuthState(response);
        this.currentUser.set(response);
        this.isAuthenticated.set(true);
        
        // Load guard profile after login
        const guardRole = response.user.tenants.find(t => t.roleName === 'Guard');
        if (guardRole) {
          this.loadGuardProfile().pipe(take(1)).subscribe();
        }
      })
    );
  }

  loadGuardProfile(): Observable<GuardProfile> {
    const user = this.currentUser();
    if (!user) {
      return throwError(() => new Error('User not authenticated'));
    }

    const userId = user.user.id;

    // Call AuthAPI to get employee details, and EntryExitAPI to get guard assignments
    const employee$ = this.http.get<ApiResponse<any>>(`${environment.authApiUrl}/Users/${userId}/employee`);
    const assignments$ = this.http.get<ApiResponse<any[]>>(`${environment.apiUrl}/admin/guards/my-assignments`);

    return forkJoin({ employee: employee$, assignments: assignments$ }).pipe(
      map(({ employee, assignments }) => {
        if (!employee || !employee.success || !employee.data) {
          throw new Error('Failed to load employee details');
        }

        const emp = employee.data;
        const assigns = assignments && assignments.success ? assignments.data : [];
        const firstAssign = assigns && assigns.length ? assigns[0] : null;

        const profile: GuardProfile = {
          id: emp.id ?? 0,
          authUserId: emp.userId ?? userId,
          firstName: emp.firstName ?? emp.FirstName ?? '',
          lastName: emp.lastName ?? emp.LastName ?? '',
          guardId: emp.employeeId?.toString?.() ?? emp.EmployeeId?.toString?.() ?? '',
          phoneNumber: emp.phoneNumber ?? emp.PhoneNumber ?? '',
          projectId: firstAssign?.projectId ?? firstAssign?.ProjectId ?? 0,
          projectName: firstAssign?.projectName ?? firstAssign?.ProjectName ?? '',
          isActive: emp.isActive ?? emp.IsActive ?? true
        };

        // persist and update signal
        this.guardProfile.set(profile);
        localStorage.setItem('guard_profile', JSON.stringify(profile));

        return profile;
      }),
      tap(() => {
        // no-op; tap kept for symmetry
      })
    );
  }

  logout(): void {
    this.clearAuthState();
    this.currentUser.set(null);
    this.guardProfile.set(null);
    this.isAuthenticated.set(false);
    this.router.navigate(['/login']);
  }

  getToken(): string | null {
    return localStorage.getItem(this.TOKEN_KEY);
  }

  hasRole(role: string): boolean {
    const user = this.currentUser();
    return user?.user.tenants.some(t => t.roleName === role) ?? false;
  }

  private saveAuthState(response: LoginResponse): void {
    localStorage.setItem(this.TOKEN_KEY, response.accessToken);
    localStorage.setItem(this.USER_KEY, JSON.stringify(response));
  }

  private loadAuthState(): void {
    const token = localStorage.getItem(this.TOKEN_KEY);
    const userJson = localStorage.getItem(this.USER_KEY);
    const profileJson = localStorage.getItem('guard_profile');

    if (token && userJson) {
      try {
        const user = JSON.parse(userJson);
        this.currentUser.set(user);
        this.isAuthenticated.set(true);

        if (profileJson) {
          this.guardProfile.set(JSON.parse(profileJson));
        }
      } catch (e) {
        this.clearAuthState();
      }
    }
  }

  private clearAuthState(): void {
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.USER_KEY);
    localStorage.removeItem('guard_profile');
  }
}
