import { Routes } from '@angular/router';

export const ENTRY_EXIT_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./entry-exit-shell.component').then(m => m.EntryExitShellComponent),
    children: [
      {
        path: '',
        pathMatch: 'full',
        redirectTo: 'search'
      },
      {
        path: 'search',
        loadComponent: () => import('./search/entry-exit-search.page').then(m => m.EntryExitSearchPage)
      }
    ]
  }
];
