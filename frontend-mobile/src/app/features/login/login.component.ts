import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="login-container">
      <div class="login-card">
        <div class="login-header">
          <div class="logo">🛡️</div>
          <h1>Security Guard</h1>
          <p class="subtitle">Entry/Exit Management System</p>
        </div>

        <form (ngSubmit)="login()" class="login-form">
          <div class="form-group">
            <label for="email">Email</label>
            <input
              id="email"
              type="email"
              [(ngModel)]="email"
              name="email"
              placeholder="Enter your email"
              required
              autocomplete="email"
            >
          </div>

          <div class="form-group">
            <label for="password">Password</label>
            <input
              id="password"
              type="password"
              [(ngModel)]="password"
              name="password"
              placeholder="Enter your password"
              required
              autocomplete="current-password"
            >
          </div>

          @if (errorMessage()) {
            <div class="error-message">
              {{ errorMessage() }}
            </div>
          }

          <button 
            type="submit" 
            class="login-button"
            [disabled]="loading()"
          >
            @if (loading()) {
              <span>Logging in...</span>
            } @else {
              <span>Login</span>
            }
          </button>
        </form>

        <div class="login-footer">
          <p class="info-text">🔒 Secure authentication required</p>
        </div>
      </div>
    </div>
  `
})
export class LoginComponent {
  private authService = inject(AuthService);
  private router = inject(Router);

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
    }).subscribe({
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
