import { Component, inject, signal } from '@angular/core';
import { take } from 'rxjs/operators';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="container">
      <div class="row">
        <div class="col-12">
          <div class="card">
            <div class="card-body">
              <h1 class="mb-1">Security Guard</h1>
              <p class="text-muted mb-3">Entry/Exit Management System</p>

              <form (ngSubmit)="login()">
                <div class="mb-2">
                  <label for="email">Email</label>
                  <input
                    id="email"
                    type="email"
                    [(ngModel)]="email"
                    name="email"
                    placeholder="Enter your email"
                    required
                    autocomplete="email"
                  />
                </div>

                <div class="mb-2">
                  <label for="password">Password</label>
                  <input
                    id="password"
                    type="password"
                    [(ngModel)]="password"
                    name="password"
                    placeholder="Enter your password"
                    required
                    autocomplete="current-password"
                  />
                </div>

                <div *ngIf="errorMessage()" class="text-danger mb-2">
                  {{ errorMessage() }}
                </div>

                <button type="submit" class="btn mb-2" [disabled]="loading()">
                  <span *ngIf="loading(); else notLoading">Logging in...</span>
                  <ng-template #notLoading><span>Login</span></ng-template>
                </button>

                <div class="text-center">
                  <p class="text-muted mb-0">🔒 Secure authentication required</p>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  `
})
export class LoginComponent {
  private authService = inject(AuthService);
  private router = inject(Router);

  constructor() {
    // If user is already authenticated and has Guard role, redirect to dashboard
    const user = this.authService.currentUser();
    if (user && this.authService.hasRole('Guard')) {
      this.router.navigate(['/dashboard']);
    }
  }

  email = '';
  password = '';
  loading = signal(false);
  errorMessage = signal('');

  login(): void {
    if (!this.email || !this.password) {
      this.errorMessage.set('Please enter email and password');
      return;
    }

    this.loading.set(true);
    this.errorMessage.set('');

    this.authService.login({
      email: this.email,
      password: this.password
    }).pipe(take(1)).subscribe({
    
      next: (response) => {
        this.loading.set(false);

        // Check if user has Guard role in any tenant
        const hasGuardRole = response.user.tenants.some(t => t.roleName === 'Guard');

        if (hasGuardRole) {
          this.router.navigate(['/dashboard']);
        } else {
          this.errorMessage.set('Access denied. Guard role required.');
          this.authService.logout();
        }
      },
      error: (error) => {
        this.loading.set(false);
        this.errorMessage.set(error.error?.message || 'Invalid email or password');
        console.error('Login error:', error);
      }
    });
  }
}
