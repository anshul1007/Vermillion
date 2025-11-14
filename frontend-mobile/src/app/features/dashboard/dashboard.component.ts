import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="container">
      <div class="row mb-2">
        <div class="col-12">
          <div *ngIf="guardProfile(); else noProfile" class="card card-accent">
            <div class="card-body">
              <h3 class="mb-1">
                {{ guardProfile()!.firstName }} {{ guardProfile()!.lastName }} ({{ guardProfile()!.guardId }})
              </h3>
              <div class="text-muted">Project: {{ guardProfile()!.projectName }}</div>
            </div>
          </div>
          <ng-template #noProfile>
            <div class="card">
              <div class="card-body">
                <h3>No guard profile</h3>
                <p class="text-muted">Guard profile is not loaded. Click below to fetch your profile.</p>
                <div *ngIf="profileError()" class="text-danger">{{ profileError() }}</div>
                <button class="btn" (click)="loadGuardProfile()" [disabled]="loadingProfile()">
                  <span *ngIf="loadingProfile(); else loadLabel">Loading...</span>
                  <ng-template #loadLabel><span>Load Guard Profile</span></ng-template>
                </button>
              </div>
            </div>
          </ng-template>
        </div>
      </div>

      <div class="row mb-2">
        <div class="col-6">
          <a class="card" routerLink="/labour-registration">
            <h2>Register Labour</h2>
            <p class="text-muted">Add new labour with barcode</p>
          </a>
        </div>
        <div class="col-6">
          <a class="card" routerLink="/visitor-registration">
            <h2>Register Visitor</h2>
            <p class="text-muted">Add new visitor</p>
          </a>
        </div>
      </div>

      <div class="row mb-2">
        <div class="col-6">
          <a class="card" routerLink="/entry-exit">
            <h2>Entry/Exit</h2>
            <p class="text-muted">Log entry or exit for labour/visitor</p>
          </a>
        </div>
        <div class="col-6">
          <a class="card" routerLink="/today-summary">
            <h2>Today's Summary</h2>
            <p class="text-muted">View today's records</p>
          </a>
        </div>
      </div>

      <div class="row mb-2">
        <div class="col-6">
          <div class="stat-card">
            <div class="stat-icon">👷</div>
            <div class="stat-value">{{ stats().activeWorkers }}</div>
            <div class="stat-label">Active Workers</div>
          </div>
        </div>

        <div class="col-6">
          <div class="stat-card">
            <div class="stat-icon">👤</div>
            <div class="stat-value">{{ stats().activeVisitors }}</div>
            <div class="stat-label">Active Visitors</div>
          </div>
        </div>
      </div>

      <div class="row">
        <div class="col-6">
          <div class="stat-card">
            <div class="stat-icon">📊</div>
            <div class="stat-value">{{ stats().todayTotal }}</div>
            <div class="stat-label">Today's Total</div>
          </div>
        </div>

        <div class="col-6">
          <div class="stat-card">
            <div class="stat-icon">✅</div>
            <div class="stat-value">{{ stats().activeTotal }}</div>
            <div class="stat-label">Currently Active</div>
          </div>
        </div>
      </div>
    </div>
  `,
})
export class DashboardComponent implements OnInit {
  private authService = inject(AuthService);

  guardProfile = this.authService.guardProfile;
  loadingProfile = signal(false);
  profileError = signal('');
  stats = signal({
    activeWorkers: 0,
    activeVisitors: 0,
    todayTotal: 0,
    activeTotal: 0,
  });

  ngOnInit(): void {
    // Load guard profile if not already loaded
    if (!this.guardProfile()) {
      this.loadGuardProfile();
    }
    this.loadTodaysStats();
  }

  loadGuardProfile(): void {
    this.loadingProfile.set(true);
    this.profileError.set('');
    this.authService.loadGuardProfile().subscribe({
      next: (profile) => {
        this.loadingProfile.set(false);
      },
      error: (err) => {
        this.loadingProfile.set(false);
        this.profileError.set(err?.message || 'Failed to load guard profile');
      }
    });
  }

  loadTodaysStats(): void {
    // In a real implementation, this would call the API
    // For now, using mock data that would come from the backend
    this.stats.set({
      activeWorkers: 0,
      activeVisitors: 0,
      todayTotal: 0,
      activeTotal: 0,
    });
  }
}
