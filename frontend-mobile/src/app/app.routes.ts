import { Routes } from '@angular/router';
import { authGuard, projectAssignedGuard } from './core/auth/auth.guard';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'login',
    pathMatch: 'full'
  },
  {
    path: 'login',
    loadComponent: () => import('./features/login/login.component').then(m => m.LoginComponent)
  },
  {
    path: 'dashboard',
    canActivate: [authGuard],
    loadComponent: () => import('./features/dashboard/dashboard.component').then(m => m.DashboardComponent)
  },
  {
    path: 'labour-registration',
    canActivate: [authGuard, projectAssignedGuard],
    loadComponent: () => import('./features/labour-registration.component').then(m => m.LabourRegistrationComponent)
  },
  {
    path: 'visitor-registration',
    canActivate: [authGuard, projectAssignedGuard],
    loadComponent: () => import('./features/visitor-registration.component').then(m => m.VisitorRegistrationComponent)
  },
  {
    path: 'entry-exit',
    canActivate: [authGuard, projectAssignedGuard],
    loadComponent: () => import('./features/entry-exit/entry-exit.component').then(m => m.EntryExitComponent)
  },
  {
    path: 'reports',
    canActivate: [authGuard, projectAssignedGuard],
    loadComponent: () => import('./features/reports/reports.component').then(m => m.ReportsComponent)
  },
  {
    path: '**',
    redirectTo: 'login'
  }
];
