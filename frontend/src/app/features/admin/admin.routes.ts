import { Routes } from '@angular/router';

export const ADMIN_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./dashboard/admin-dashboard.component').then(m => m.AdminDashboardComponent)
  },
  {
    path: 'team',
    loadComponent: () => import('../manager/dashboard/manager-dashboard.component').then(m => m.ManagerDashboardComponent)
  },
  {
    path: 'entry-exit',
    loadComponent: () => import('./entry-exit/entry-exit-dashboard.component').then(m => m.EntryExitDashboardComponent)
  }
];
