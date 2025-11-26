import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { ApiResponse } from '../../shared/models/api-response.model';

export interface SystemUser {
  id: number;
  username: string;
  email: string;
  externalProvider?: string;
  createdAt: Date;
  tenants: Array<{
    tenantId: number;
    tenantName: string;
    tenantDomain: string;
    roleId: number;
    roleName: string;
    isActive: boolean;
  }>;
}

export interface Role {
  id: number;
  name: string;
  description?: string;
  isActive: boolean;
  createdAt: Date;
  permissionCount?: number;
  permissions?: Permission[];
}

export interface Permission {
  id: number;
  name: string;
  resource: string;
  action: string;
  description?: string;
  isActive?: boolean;
}

export interface Tenant {
  id: number;
  name: string;
  domain: string;
  // apiKey removed
  isActive: boolean;
  createdAt: Date;
  userCount?: number;
}

export interface CreateUserRequest {
  username: string;
  email: string;
  password: string;
  externalProvider?: string;
}

export interface UpdateUserRequest {
  username?: string;
  email?: string;
  password?: string;
}

export interface CreateRoleRequest {
  name: string;
  description?: string;
}

export interface UpdateRoleRequest {
  name?: string;
  description?: string;
}

export interface CreatePermissionRequest {
  name: string;
  resource: string;
  action: string;
  description?: string;
}

export interface UpdatePermissionRequest {
  name?: string;
  resource?: string;
  action?: string;
  description?: string;
}

export interface UpdateTenantRequest {
  name?: string;
  domain?: string;
}

@Injectable({
  providedIn: 'root'
})
export class SystemAdminService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/auth/admin`;
  private tenantApiUrl = `${environment.apiUrl}/auth/tenant`;

  // Users Management
  getAllUsers(tenantId?: number): Observable<SystemUser[]> {
    const params: Record<string, string> = tenantId ? { tenantId: tenantId.toString() } : {};
    const options = tenantId ? { params } : {};
    return this.http.get<ApiResponse<SystemUser[]>>(`${this.apiUrl}/users`, options)
      .pipe(map(response => response.data || []));
  }

  getUserById(id: number): Observable<SystemUser> {
    return this.http.get<ApiResponse<SystemUser>>(`${this.apiUrl}/users/${id}`)
      .pipe(map(response => response.data!));
  }

  createUser(request: CreateUserRequest): Observable<any> {
    return this.http.post<ApiResponse<any>>(`${this.apiUrl}/users`, request)
      .pipe(map(response => response.data));
  }

  updateUser(id: number, request: UpdateUserRequest): Observable<void> {
    return this.http.put<ApiResponse<void>>(`${this.apiUrl}/users/${id}`, request)
      .pipe(map(() => undefined));
  }

  deleteUser(id: number): Observable<void> {
    return this.http.delete<ApiResponse<void>>(`${this.apiUrl}/users/${id}`)
      .pipe(map(() => undefined));
  }

  // User-Role-Tenant Management
  assignUserToTenantRole(userId: number, tenantId: number, roleId: number): Observable<void> {
    return this.http.post<ApiResponse<void>>(`${this.apiUrl}/users/${userId}/tenants/${tenantId}/roles/${roleId}`, {})
      .pipe(map(() => undefined));
  }

  removeUserFromTenantRole(userId: number, tenantId: number, roleId: number): Observable<void> {
    return this.http.delete<ApiResponse<void>>(`${this.apiUrl}/users/${userId}/tenants/${tenantId}/roles/${roleId}`)
      .pipe(map(() => undefined));
  }

  activateUserRole(id: number): Observable<void> {
    return this.http.put<ApiResponse<void>>(`${this.apiUrl}/user-roles/${id}/activate`, {})
      .pipe(map(() => undefined));
  }

  deactivateUserRole(id: number): Observable<void> {
    return this.http.put<ApiResponse<void>>(`${this.apiUrl}/user-roles/${id}/deactivate`, {})
      .pipe(map(() => undefined));
  }

  // Roles Management
  getAllRoles(): Observable<Role[]> {
    return this.http.get<ApiResponse<Role[]>>(`${this.apiUrl}/role`)
      .pipe(map(response => response.data || []));
  }

  getRoleById(id: number): Observable<Role> {
    return this.http.get<ApiResponse<Role>>(`${this.apiUrl}/roles/${id}`)
      .pipe(map(response => response.data!));
  }

  createRole(request: CreateRoleRequest): Observable<any> {
    return this.http.post<ApiResponse<any>>(`${this.apiUrl}/roles`, request)
      .pipe(map(response => response.data));
  }

  updateRole(id: number, request: UpdateRoleRequest): Observable<void> {
    return this.http.put<ApiResponse<void>>(`${this.apiUrl}/roles/${id}`, request)
      .pipe(map(() => undefined));
  }

  deleteRole(id: number): Observable<void> {
    return this.http.delete<ApiResponse<void>>(`${this.apiUrl}/roles/${id}`)
      .pipe(map(() => undefined));
  }

  activateRole(id: number): Observable<void> {
    return this.http.put<ApiResponse<void>>(`${this.apiUrl}/roles/${id}/activate`, {})
      .pipe(map(() => undefined));
  }

  deactivateRole(id: number): Observable<void> {
    return this.http.put<ApiResponse<void>>(`${this.apiUrl}/roles/${id}/deactivate`, {})
      .pipe(map(() => undefined));
  }

  // Permissions Management
  getAllPermissions(): Observable<Permission[]> {
    return this.http.get<ApiResponse<Permission[]>>(`${this.apiUrl}/permissions`)
      .pipe(map(response => response.data || []));
  }

  createPermission(request: CreatePermissionRequest): Observable<any> {
    return this.http.post<ApiResponse<any>>(`${this.apiUrl}/permissions`, request)
      .pipe(map(response => response.data));
  }

  updatePermission(id: number, request: UpdatePermissionRequest): Observable<void> {
    return this.http.put<ApiResponse<void>>(`${this.apiUrl}/permissions/${id}`, request)
      .pipe(map(() => undefined));
  }

  deletePermission(id: number): Observable<void> {
    return this.http.delete<ApiResponse<void>>(`${this.apiUrl}/permissions/${id}`)
      .pipe(map(() => undefined));
  }

  // Role-Permission Management
  assignPermissionToRole(roleId: number, permissionId: number): Observable<void> {
    return this.http.post<ApiResponse<void>>(`${this.apiUrl}/roles/${roleId}/permissions/${permissionId}`, {})
      .pipe(map(() => undefined));
  }

  removePermissionFromRole(roleId: number, permissionId: number): Observable<void> {
    return this.http.delete<ApiResponse<void>>(`${this.apiUrl}/roles/${roleId}/permissions/${permissionId}`)
      .pipe(map(() => undefined));
  }

  // Tenants Management
  getAllTenants(): Observable<Tenant[]> {
    return this.http.get<ApiResponse<Tenant[]>>(`${this.tenantApiUrl}`)
      .pipe(map(response => response.data || []));
  }

  updateTenant(id: number, request: UpdateTenantRequest): Observable<void> {
    return this.http.put<ApiResponse<void>>(`${this.tenantApiUrl}/${id}`, request)
      .pipe(map(() => undefined));
  }
}
