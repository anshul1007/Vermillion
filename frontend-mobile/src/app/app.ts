import { Component, inject } from '@angular/core';
import { RouterOutlet, RouterLink } from '@angular/router';
import { NgIf } from '@angular/common';
import { IconComponent } from './shared/icon/icon.component';
import { AuthService } from './core/auth/auth.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, NgIf, RouterLink, IconComponent],
  templateUrl: './app.html',
  standalone: true,
})
export class App {
  private auth = inject(AuthService);
  isGuard = () => this.auth.hasRole('Guard');

  logout(): void {
    if (confirm('Are you sure you want to logout?')) {
      this.auth.logout();
    }
  }
}
