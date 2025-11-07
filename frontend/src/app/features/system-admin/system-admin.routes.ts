import { Routes } from '@angular/router';

export const SYSTEM_ADMIN_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./system-admin-dashboard.component').then(m => m.SystemAdminDashboardComponent)
  },
  {
    path: 'users',
    loadComponent: () => import('./users/users-management.component').then(m => m.UsersManagementComponent)
  },
  {
    path: 'roles',
    loadComponent: () => import('./roles/roles-management.component').then(m => m.RolesManagementComponent)
  },
  {
    path: 'permissions',
    loadComponent: () => import('./permissions/permissions-management.component').then(m => m.PermissionsManagementComponent)
  },
  {
    path: 'tenants',
    loadComponent: () => import('./tenants/tenants-management.component').then(m => m.TenantsManagementComponent)
  }
];
