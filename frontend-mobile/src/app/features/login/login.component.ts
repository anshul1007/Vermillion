import { Component, inject, signal } from '@angular/core';
import { take } from 'rxjs/operators';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { LoggerService } from '../../core/services/logger.service';

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
                  <label for="phone">Phone</label>
                  <input
                    id="phone"
                    type="tel"
                    [(ngModel)]="phone"
                    name="phone"
                    placeholder="Enter your phone number"
                    required
                    autocomplete="tel"
                  />
                </div>

                <div class="mb-2">
                  <label for="pin">PIN</label>
                  <input
                    id="pin"
                    type="password"
                    [(ngModel)]="pin"
                    name="pin"
                    placeholder="Enter 4-digit PIN"
                    maxlength="6"
                    autocomplete="one-time-code"
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
  `,
})
export class LoginComponent {
  private authService = inject(AuthService);
  private router = inject(Router);
  private logger = inject(LoggerService);

  constructor() {
    // If user is already authenticated and has Guard role, redirect to dashboard
    const user = this.authService.currentUser();
    if (user && this.authService.hasRole('Guard')) {
      this.router.navigate(['/dashboard']);
    }
  }

  phone = '';
  pin = ''; // optional: defaults to last 4 digits of phone if left empty
  loading = signal(false);
  errorMessage = signal('');

  login(): void {
    if (!this.phone) {
      this.errorMessage.set('Please enter phone number');
      return;
    }

    // Default PIN to last 4 digits of phone if user left it blank
    const effectivePin =
      this.pin && this.pin.trim().length > 0
        ? this.pin.trim()
        : this.phone.replace(/\D/g, '').slice(-4);

    this.loading.set(true);
    this.errorMessage.set('');

    this.authService
      .login({
        phone: this.phone,
        pin: effectivePin,
      } as any)
      .pipe(take(1))
      .subscribe({
        next: (response) => {
          this.loading.set(false);

          // Check if user has Guard role in any tenant
          const hasGuardRole = response.user.tenants.some((t) => t.roleName === 'Guard');

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
          this.logger.error('Login error:', error);
        },
      });
  }
}
