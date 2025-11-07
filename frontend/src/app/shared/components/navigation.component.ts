import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { take } from 'rxjs/operators';

@Component({
  selector: 'app-navigation',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <nav class="navbar">
      <div class="nav-container">
        <div class="nav-brand">
          <div class="logo">
            <span class="logo-text">Vermillion</span>
            <span class="logo-subtext">PRECISION DEFINED • SOLUTIONS DELIVERED</span>
          </div>
        </div>

        <ng-container *ngIf="authService.currentUser$ | async as currentUser">
          <div class="nav-links">
            <ng-container *ngIf="hasRoleUser(currentUser, 'Employee') && hasTenantUser(currentUser, 'attendance')">
              <a
                routerLink="/employee"
                routerLinkActive="active"
                [routerLinkActiveOptions]="{ exact: true }"
                class="nav-link"
              >
                Dashboard
              </a>
            </ng-container>

            <ng-container *ngIf="hasRoleUser(currentUser, 'Manager') && hasTenantUser(currentUser, 'attendance')">
              <a
                routerLink="/manager"
                routerLinkActive="active"
                [routerLinkActiveOptions]="{ exact: true }"
                class="nav-link"
              >
                Team Management
              </a>
            </ng-container>

            <ng-container *ngIf="hasRoleUser(currentUser, 'Admin')">
              <ng-container *ngIf="hasTenantRoleUser(currentUser, 'attendance', 'Admin') || hasTenantRoleUser(currentUser, 'attendance', 'SystemAdmin')">
                <a
                  routerLink="/admin"
                  routerLinkActive="active"
                  [routerLinkActiveOptions]="{ exact: true }"
                  class="nav-link"
                >
                  Admin Panel
                </a>
              </ng-container>
              <ng-container *ngIf="hasTenantUser(currentUser, 'entryexit')">
                <a routerLink="/admin/entry-exit" routerLinkActive="active" class="nav-link">
                  Entry/Exit Management
                </a>
              </ng-container>
            </ng-container>

            <ng-container *ngIf="hasRoleUser(currentUser, 'SystemAdmin')">
              <a
                routerLink="/system-admin"
                routerLinkActive="active"
                class="nav-link system-admin-link"
              >
                🔧 System Admin
              </a>
            </ng-container>
          </div>

          <div class="nav-user">
            <div class="user-dropdown" [class.open]="userMenuOpen">
              <button class="user-main" (click)="logout()">Logout</button>
              <button class="user-toggle" (click)="toggleUserMenu($event)" aria-label="Toggle user menu">
                ▾
              </button>

              <div class="user-menu" *ngIf="userMenuOpen">
                <div class="user-info">
                  <div class="user-name">{{ currentUser.firstName }} {{ currentUser.lastName }}</div>
                  <div class="user-email">{{ currentUser.email }}</div>
                  <div class="user-role">Role: {{ currentUser.role }}</div>
                </div>
              </div>
            </div>
          </div>
        </ng-container>
      </div>
    </nav>
  `
})
export class NavigationComponent {
  authService = inject(AuthService);
  private router = inject(Router);
  userMenuOpen = false;

  

  toggleUserMenu(event?: Event) {
    if (event) {
      event.stopPropagation();
    }
    this.userMenuOpen = !this.userMenuOpen;
  }

  closeUserMenu() {
    this.userMenuOpen = false;
  }

  hasRole(role: string): boolean {
    const userRole = this.authService.currentUser?.role;
    if (role === 'Employee') {
      return (
        userRole === 'Employee' ||
        userRole === 'Manager' ||
        userRole === 'Admin' ||
        userRole === 'SystemAdmin'
      );
    }
    if (role === 'Manager') {
      return userRole === 'Manager' || userRole === 'Admin' || userRole === 'SystemAdmin';
    }
    if (role === 'Admin') {
      return userRole === 'Admin' || userRole === 'SystemAdmin';
    }
    if (role === 'SystemAdmin') {
      return userRole === 'SystemAdmin';
    }
    if (role === 'Guard') {
      return userRole === 'Guard';
    }
    return false;
  }

  // Typed helpers used when template binds to an async `currentUser` local
  hasRoleUser(user: any | null, role: string): boolean {
    const userRole = user?.role;
    if (role === 'Employee') {
      return (
        userRole === 'Employee' ||
        userRole === 'Manager' ||
        userRole === 'Admin' ||
        userRole === 'SystemAdmin'
      );
    }
    if (role === 'Manager') {
      return userRole === 'Manager' || userRole === 'Admin' || userRole === 'SystemAdmin';
    }
    if (role === 'Admin') {
      return userRole === 'Admin' || userRole === 'SystemAdmin';
    }
    if (role === 'SystemAdmin') {
      return userRole === 'SystemAdmin';
    }
    if (role === 'Guard') {
      return userRole === 'Guard';
    }
    return false;
  }

  hasTenantUser(user: any | null, domain: string): boolean {
    const tenants = user?.tenants ?? [];
    return tenants.some((t: any) => ((t.domain ?? t.tenantName ?? '') as string).toLowerCase() === domain.toLowerCase());
  }

  hasTenantRoleUser(user: any | null, domain: string, roleName: string): boolean {
    const tenants = user?.tenants ?? [];
    return tenants.some((t: any) => (((t.domain ?? t.tenantName) ?? '') as string).toLowerCase() === domain.toLowerCase() && (((t.roleName ?? '') as string).toLowerCase() === roleName.toLowerCase() || ((t.roleName ?? '') as string).toLowerCase() === 'systemadmin'));
  }

  // Checks if the current user has a tenant with the given domain
  hasTenant(domain: string): boolean {
    const tenants = this.authService.currentUser?.tenants ?? [];
    return tenants.some(t => (t.domain ?? t.tenantName ?? '').toLowerCase() === domain.toLowerCase());
  }

  // Checks if the current user has the specified role within a particular tenant domain
  hasTenantRole(domain: string, roleName: string): boolean {
    const tenants = this.authService.currentUser?.tenants ?? [];
    return tenants.some(t => ((t.domain ?? t.tenantName) ?? '').toLowerCase() === domain.toLowerCase() && ((t.roleName ?? '').toLowerCase() === roleName.toLowerCase() || (t.roleName ?? '').toLowerCase() === 'systemadmin'));
  }

  logout() {
    // one-off observable: complete after first emission to avoid keeping subscriptions open
    this.authService.logout().pipe(take(1)).subscribe({
      next: () => {
        this.router.navigate(['/login']);
      },
      error: (error) => {
        console.error('Logout error:', error);
        // Still navigate to login even if logout API call fails
        this.router.navigate(['/login']);
      },
    });
  }
}
