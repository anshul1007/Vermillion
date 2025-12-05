import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { AuthService } from './auth.service';
import { NotificationService } from '../services/notification.service';
import { projectStore } from '../state/project.store';

export const authGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isAuthenticated()) {
    return true;
  }

  router.navigate(['/login']);
  return false;
};

export const guardRoleGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isAuthenticated() && authService.hasRole('Guard')) {
    return true;
  }

  router.navigate(['/login']);
  return false;
};

export const projectAssignedGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const notifier = inject(NotificationService);

  const storedProjectId = projectStore.projectId();
  const profile = authService.guardProfile();
  const pid = storedProjectId ?? profile?.projectId ?? 0;

  if (pid && pid > 0) {
    return true;
  }

  const message = 'Project not assigned. Please contact your administrator.';
  notifier.showError(message, 0);

  if (!router.url.startsWith('/dashboard')) {
    router.navigate(['/dashboard']);
  }
  return false;
};
