import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="dashboard-container">
      <header class="dashboard-header">
        <div class="header-content">
          <div>
            <h1>Entry/Exit Management</h1>
            <p class="subtitle">Site Worker & Visitor Tracking</p>
          </div>
          <button class="profile-button" routerLink="/profile">
            <span>🛡️</span>
            <span class="profile-text">Profile</span>
          </button>
        </div>
        
        @if (guardProfile()) {
          <div class="guard-info">
            <div class="guard-name">{{ guardProfile()!.firstName }} {{ guardProfile()!.lastName }}</div>
            <div class="guard-site">📍 {{ guardProfile()!.projectName }}</div>
            <div class="guard-id">ID: {{ guardProfile()!.guardId }}</div>
          </div>
        }
      </header>

      <div class="menu-grid">
        <div class="menu-card" routerLink="/labour-registration">
          <div class="icon">👷</div>
          <h2>Register Labour</h2>
          <p>Add new labour with barcode</p>
        </div>

        <div class="menu-card" routerLink="/visitor-registration">
          <div class="icon">👤</div>
          <h2>Register Visitor</h2>
          <p>Add new visitor</p>
        </div>

        <div class="menu-card" routerLink="/entry-exit">
          <div class="icon">🚪</div>
          <h2>Entry/Exit</h2>
          <p>Log entry or exit for labour/visitor</p>
        </div>

        <div class="menu-card" routerLink="/today-summary">
          <div class="icon">📊</div>
          <h2>Today's Summary</h2>
          <p>View today's records</p>
        </div>
      </div>

      <div class="stats-section">
        <div class="stat-card">
          <h3>Active Workers</h3>
          <p class="stat-value">{{ stats().activeWorkers }}</p>
        </div>
        <div class="stat-card">
          <h3>Active Visitors</h3>
          <p class="stat-value">{{ stats().activeVisitors }}</p>
        </div>
        <div class="stat-card">
          <h3>Today's Total</h3>
          <p class="stat-value">{{ stats().todayTotal }}</p>
        </div>
      </div>
    </div>
  `
})
export class DashboardComponent implements OnInit {
  private authService = inject(AuthService);

  guardProfile = this.authService.guardProfile;
  stats = signal({
    activeWorkers: 0,
    activeVisitors: 0,
    todayTotal: 0
  });

  ngOnInit(): void {
    // Load guard profile if not already loaded
    if (!this.guardProfile()) {
      this.authService.loadGuardProfile().subscribe();
    }
    this.loadTodaysStats();
  }

  loadTodaysStats(): void {
    // In a real implementation, this would call the API
    // For now, using mock data that would come from the backend
    this.stats.set({
      activeWorkers: 0,
      activeVisitors: 0,
      todayTotal: 0
    });
  }
}
