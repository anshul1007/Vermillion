import { Routes } from '@angular/router';
import { authGuard } from './core/auth/auth.guard';

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
  // {
  //   path: 'profile',
  //   canActivate: [authGuard],
  //   loadComponent: () => import('./features/guard-profile/guard-profile.component').then(m => m.GuardProfileComponent)
  // },
  {
    path: 'labour-registration',
    canActivate: [authGuard],
    loadComponent: () => import('./features/labour-registration.component').then(m => m.LabourRegistrationComponent)
  },
  {
    path: 'visitor-registration',
    canActivate: [authGuard],
    loadComponent: () => import('./features/visitor-registration.component').then(m => m.VisitorRegistrationComponent)
  },
  {
    path: 'entry-exit',
    canActivate: [authGuard],
    loadComponent: () => import('./features/entry-exit.component').then(m => m.EntryExitComponent)
  },
  {
    path: 'today-summary',
    canActivate: [authGuard],
    loadComponent: () => import('./features/today-summary/today-summary.component').then(m => m.TodaySummaryComponent)
  },
  {
    path: 'search',
    canActivate: [authGuard],
    loadComponent: () => import('./features/search/search.component').then(m => m.SearchComponent)
  },
  {
    path: 'reports',
    canActivate: [authGuard],
    loadComponent: () => import('./features/reports/reports.component').then(m => m.ReportsComponent)
  },
  {
    path: '**',
    redirectTo: 'login'
  }
];
