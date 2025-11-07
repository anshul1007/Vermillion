import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { ApiService } from '../../core/services/api.service';

@Component({
  selector: 'app-guard-profile',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="profile-container">
      <div class="profile-header">
        <button class="back-button" (click)="goBack()">← Back</button>
        <h1>My Profile</h1>
      </div>

      @if (loading()) {
        <div class="loading">Loading profile...</div>
      } @else if (profile()) {
        <div class="profile-card">
          <div class="profile-avatar">
            <div class="avatar-icon">🛡️</div>
          </div>

          <div class="profile-info">
            <div class="info-row">
              <span class="label">Guard ID</span>
              <span class="value">{{ profile()!.guardId }}</span>
            </div>

            <div class="info-row">
              <span class="label">Name</span>
              <span class="value">{{ profile()!.firstName }} {{ profile()!.lastName }}</span>
            </div>

            <div class="info-row">
              <span class="label">Phone</span>
              <span class="value">{{ profile()!.phoneNumber }}</span>
            </div>

            <div class="info-row">
              <span class="label">Status</span>
              <span class="value status-active">
                @if (profile()!.isActive) {
                  <span class="status-badge active">● Active</span>
                } @else {
                  <span class="status-badge inactive">● Inactive</span>
                }
              </span>
            </div>
          </div>
        </div>

        <div class="assignment-card">
          <h2>Assigned Project</h2>
          <div class="project-info">
            <div class="project-icon">🏗️</div>
            <div class="project-details">
              <h3>{{ profile()!.projectName }}</h3>
              <p class="project-id">Project ID: {{ profile()!.projectId }}</p>
            </div>
          </div>
        </div>

        @if (contractors().length > 0) {
          <div class="contractors-card">
            <h2>Site Contractors</h2>
            <div class="contractor-list">
              @for (contractor of contractors(); track contractor.id) {
                <div class="contractor-item">
                  <div class="contractor-icon">👷</div>
                  <div class="contractor-details">
                    <h4>{{ contractor.name }}</h4>
                    <p>Contact: {{ contractor.contactPerson }}</p>
                    <p class="phone">📞 {{ contractor.phoneNumber }}</p>
                  </div>
                </div>
              }
            </div>
          </div>
        }

        <div class="actions">
          <button class="action-button" (click)="logout()">
            <span>🚪</span>
            Logout
          </button>
        </div>
      } @else {
        <div class="error">Failed to load profile</div>
      }
    </div>
  `
})
export class GuardProfileComponent implements OnInit {
  private authService = inject(AuthService);
  private apiService = inject(ApiService);
  private router = inject(Router);

  profile = this.authService.guardProfile;
  contractors = signal<any[]>([]);
  loading = signal(false);

  ngOnInit(): void {
    this.loadProfile();
  }

  loadProfile(): void {
    this.loading.set(true);

    this.authService.loadGuardProfile().subscribe({
      next: (profile) => {
        this.loading.set(false);
        this.loadContractors(profile.projectId);
      },
      error: (err) => {
        this.loading.set(false);
        console.error('Failed to load profile:', err);
      }
    });
  }

  loadContractors(projectId: number): void {
    this.apiService.getContractorsByProject(projectId).subscribe({
      next: (contractors) => {
        this.contractors.set(contractors);
      },
      error: (err) => {
        console.error('Failed to load contractors:', err);
      }
    });
  }

  goBack(): void {
    this.router.navigate(['/dashboard']);
  }

  logout(): void {
    if (confirm('Are you sure you want to logout?')) {
      this.authService.logout();
    }
  }
}
