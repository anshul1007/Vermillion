import { Routes } from '@angular/router';
import { authGuard } from './core/auth/auth.guard';
import { roleGuard } from './core/auth/role.guard';

export const routes: Routes = [
  { 
    path: 'login', 
    loadComponent: () => import('./features/auth/login/login.component').then(m => m.LoginComponent)
  },
  {
    path: 'employee',
    canActivate: [authGuard, roleGuard],
    data: { roles: ['Employee', 'Manager', 'Administrator'] },
    loadComponent: () => import('./features/employee/dashboard/employee-dashboard.component').then(m => m.EmployeeDashboardComponent)
  },
  {
    path: 'manager',
    canActivate: [authGuard, roleGuard],
    data: { roles: ['Manager', 'Administrator'] },
    loadChildren: () => import('./features/manager/manager.routes').then(m => m.MANAGER_ROUTES)
  },
  {
    path: 'admin',
    canActivate: [authGuard, roleGuard],
    data: { roles: ['Administrator'] },
    loadChildren: () => import('./features/admin/admin.routes').then(m => m.ADMIN_ROUTES)
  },
  {
    path: 'system',
    canActivate: [authGuard, roleGuard],
    data: { roles: ['SystemUser'] },
    loadComponent: () => import('./features/system/feature-toggles/feature-toggles.component').then(m => m.FeatureTogglesComponent)
  },
  { 
    path: '', 
    redirectTo: '/login', 
    pathMatch: 'full' 
  },
  { 
    path: '**', 
    redirectTo: '/login' 
  }
];
