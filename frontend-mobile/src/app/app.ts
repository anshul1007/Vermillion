import { Component, inject } from '@angular/core';
import { RouterOutlet, RouterLink } from '@angular/router';
import { NgIf } from '@angular/common';
import { IconComponent } from './shared/icon/icon.component';
import { OfflineBannerComponent } from './shared/offline-banner/offline-banner.component';
import { AuthService } from './core/auth/auth.service';
import { NotificationService } from './core/services/notification.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, NgIf, RouterLink, IconComponent, OfflineBannerComponent],
  templateUrl: './app.html',
  standalone: true,
})
export class App {
  private auth = inject(AuthService);
  notifier = inject(NotificationService);
  isGuard = () => this.auth.hasRole('Guard');
}
