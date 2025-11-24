import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';
import { AuthService } from '../../../core/auth/auth.service';
import { LoginRequest } from '../../../shared/models/user.model';
import { take } from 'rxjs/operators';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    MatIconModule
  ],
  template: `
    <div class="login-container">
      <mat-card class="login-card">
        <mat-card-header>
          <mat-card-title>VermillionIndia</mat-card-title>
          <mat-card-subtitle>Attendance Management System</mat-card-subtitle>
        </mat-card-header>
        
        <mat-card-content>
          <form #loginForm="ngForm" (ngSubmit)="onSubmit()">
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Email</mat-label>
              <input 
                matInput 
                type="email" 
                [(ngModel)]="credentials.email" 
                name="email" 
                required 
                email
                placeholder="your.email@company.com">
              <mat-icon matPrefix>email</mat-icon>
            </mat-form-field>

            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Password</mat-label>
              <input 
                matInput 
                [type]="hidePassword() ? 'password' : 'text'" 
                [(ngModel)]="credentials.password" 
                name="password" 
                required
                placeholder="Enter your password">
              <mat-icon matPrefix>lock</mat-icon>
              <button 
                mat-icon-button 
                matSuffix 
                type="button"
                (click)="hidePassword.set(!hidePassword())">
                <mat-icon>{{hidePassword() ? 'visibility_off' : 'visibility'}}</mat-icon>
              </button>
            </mat-form-field>

            @if (errorMessage()) {
              <div class="error-message">
                <mat-icon>error</mat-icon>
                {{ errorMessage() }}
              </div>
            }

            <button 
              mat-raised-button 
              color="primary" 
              type="submit" 
              class="full-width login-button"
              [disabled]="!loginForm.valid || loading()">
              @if (loading()) {
                <mat-spinner diameter="20"></mat-spinner>
              } @else {
                Login
              }
            </button>
          </form>
        </mat-card-content>
      </mat-card>
    </div>
  `
})
export class LoginComponent {
  private authService = inject(AuthService);
  private router = inject(Router);

  credentials: LoginRequest = {
    email: '',
    password: ''
  };

  loading = signal(false);
  errorMessage = signal('');
  hidePassword = signal(true);

  onSubmit(): void {
    this.loading.set(true);
    this.errorMessage.set('');

    // one-off login observable: use take(1) to auto-unsubscribe
    this.authService.login(this.credentials).pipe(take(1)).subscribe({
      next: (response) => {
        this.loading.set(false);
        console.debug('Login response:', response);

        // Primary role (mapped by AuthService)
        const mappedRole = response.user?.role;

        // Also check tenant role names in case mapping failed
        const tenantRoles: string[] = (response.user?.tenants ?? []).map((t: any) => t.roleName ?? t.RoleName ?? '').filter(Boolean);

        const isAdmin = mappedRole === 'Admin' || mappedRole === 'SystemAdmin' || tenantRoles.some(r => r === 'SystemAdmin' || r === 'Admin');
        const isManager = mappedRole === 'Manager' || tenantRoles.some(r => r === 'Manager');
        // Decide destination based on tenant domains when user is an Admin for specific modules
        const tenantDomains: string[] = (response.user?.tenants ?? []).map((t: any) => (t.domain ?? t.tenantName ?? '').toString().toLowerCase());
        const isEntryExitTenant = tenantDomains.some(d => d.includes('entry') || d.includes('entryexit') || d.includes('entry-exit'));
        const isAttendanceTenant = tenantDomains.some(d => d.includes('attendance'));

        if (isAdmin) {
          if (isEntryExitTenant) {
            // Entry/Exit tenant admins go straight to entry-exit management
            this.router.navigate(['/admin/entry-exit']);
          } else if (isAttendanceTenant) {
            // Attendance tenant admins go to the generic admin dashboard
            this.router.navigate(['/admin']);
          } else {
            // Default admin landing
            this.router.navigate(['/admin']);
          }
        } else if (isManager) {
          this.router.navigate(['/manager']);
        } else {
          this.router.navigate(['/employee']);
        }
      },
      error: (error) => {
        this.loading.set(false);
        this.errorMessage.set(error.message || 'Login failed. Please try again.');
      }
    });
  }
}
