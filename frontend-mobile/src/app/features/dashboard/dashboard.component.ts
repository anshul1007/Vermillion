import { Component, inject, signal, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { take } from 'rxjs/operators';
import { CommonModule } from '@angular/common';
import { IconComponent } from '../../shared/icon/icon.component';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { ApiService } from '../../core/services/api.service';
import { RawEntryExitRecordDto } from '../../core/models/entry-exit.model';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule, IconComponent],
  template: `
    <div class="dashboard-page">
      <section class="dashboard-hero card">
        <div class="dashboard-hero__top">
          <div class="dashboard-hero__profile" *ngIf="guardProfile(); else noProfile">
            <div class="profile-avatar">
              <app-icon name="shield-check" size="40" class="profile-icon"></app-icon>
            </div>
            <div class="profile-details">
              <h2 class="profile-name">{{ guardProfile()!.firstName }} {{ guardProfile()!.lastName }}</h2>
              <div class="profile-meta">Guard ID: {{ guardProfile()!.guardId }}</div>
              <div class="profile-meta">Phone: {{ guardProfile()!.phoneNumber }}</div>
              <div class="profile-meta">Project: {{ guardProfile()!.projectName }}</div>
            </div>
          </div>
          <ng-template #noProfile>
            <div class="profile-details">
              <h2 class="profile-name">No guard profile</h2>
              <div class="profile-meta">Guard profile is not loaded.</div>
              <div *ngIf="profileError()" class="text-danger">{{ profileError() }}</div>
              <button class="btn" (click)="loadGuardProfile()" [disabled]="loadingProfile()">
                <span *ngIf="loadingProfile(); else loadLabel">Loading...</span>
                <ng-template #loadLabel><span>Load Guard Profile</span></ng-template>
              </button>
            </div>
          </ng-template>
        </div>
        <div class="dashboard-hero__stats">
          <div class="dashboard-stat">
            <div class="dashboard-stat__icon icon-box icon-box--success">
              <app-icon name="user-group" size="28"></app-icon>
            </div>
            <div class="dashboard-stat__content">
              <span class="stat-value">{{ stats().activeWorkers }}</span>
              <span class="stat-label">Active Workers</span>
            </div>
          </div>
          <div class="dashboard-stat">
            <div class="dashboard-stat__icon icon-box icon-box--info">
              <app-icon name="user" size="28"></app-icon>
            </div>
            <div class="dashboard-stat__content">
              <span class="stat-value">{{ stats().activeVisitors }}</span>
              <span class="stat-label">Active Visitors</span>
            </div>
          </div>
          <div class="dashboard-stat">
            <div class="dashboard-stat__icon icon-box icon-box--warning">
              <app-icon name="trend-up" size="28"></app-icon>
            </div>
            <div class="dashboard-stat__content">
              <span class="stat-value">{{ stats().todayTotal }}</span>
              <span class="stat-label">Today's Total</span>
            </div>
          </div>
          <div class="dashboard-stat">
            <div class="dashboard-stat__icon icon-box icon-box--neutral">
              <app-icon name="clock" size="28"></app-icon>
            </div>
            <div class="dashboard-stat__content">
              <span class="stat-value">{{ stats().activeTotal }}</span>
              <span class="stat-label">Currently Active</span>
            </div>
          </div>
        </div>
      </section>

      <section class="dashboard-actions">
        <a class="dashboard-action" routerLink="/labour-registration">
          <div class="action-icon icon-box icon-box--success">
            <app-icon name="user-group" size="28"></app-icon>
          </div>
          <span class="action-label">Register Labour</span>
        </a>
        <a class="dashboard-action" routerLink="/visitor-registration">
          <div class="action-icon icon-box icon-box--info">
            <app-icon name="user" size="28"></app-icon>
          </div>
          <span class="action-label">Register Visitor</span>
        </a>
        <a class="dashboard-action" routerLink="/entry-exit">
          <div class="action-icon icon-box icon-box--neutral">
            <app-icon name="entry" size="28"></app-icon>
          </div>
          <span class="action-label">Entry/Exit</span>
        </a>
        <a class="dashboard-action" routerLink="/reports">
          <div class="action-icon icon-box icon-box--warning">
            <app-icon name="report-trend" size="28"></app-icon>
          </div>
          <span class="action-label">Reports</span>
        </a>
      </section>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DashboardComponent implements OnInit {
  private authService = inject(AuthService);
  private apiService = inject(ApiService);

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
    this.authService.loadGuardProfile().pipe(take(1)).subscribe({
      next: (profile) => {
        this.loadingProfile.set(false);
      },
      error: (err) => {
        this.loadingProfile.set(false);
        this.profileError.set(err?.message || 'Failed to load guard profile');
      },
    });
  }

  loadTodaysStats(): void {
    // Get today's records to calculate statistics
    this.apiService.getTodayRecords().pipe(take(1)).subscribe({
      next: (response) => {
        if (response.success && response.data) {
          const records = response.data as RawEntryExitRecordDto[];

          // Compute session-based totals: pair Entry->Exit so a pair counts once
          const grouped = new Map<string, RawEntryExitRecordDto[]>();
          records.forEach((r) => {
            const idPart = (r.labourId ?? r.LabourId)
              ? `labour:${r.labourId ?? r.LabourId}`
              : (r.visitorId ?? r.VisitorId)
                ? `visitor:${r.visitorId ?? r.VisitorId}`
                : (r.personName ?? r.PersonName ?? 'unknown');
            const key = `${r.personType ?? r.PersonType}-${idPart}`;
            if (!grouped.has(key)) grouped.set(key, []);
            grouped.get(key)!.push(r);
          });

          let paired = 0;
          let pending = 0;

          for (const [k, recs] of grouped) {
            const sorted = recs.slice().sort((a, b) => new Date(a.timestamp ?? a.Timestamp ?? a.entryTime ?? '').getTime() - new Date(b.timestamp ?? b.Timestamp ?? b.entryTime ?? '').getTime());
            let p = 0;
            let pairs = 0;
            for (const r of sorted) {
              const action = (r.action ?? r.Action) === 'Exit' || (r.action ?? r.Action) === 2 ? 'Exit' : 'Entry';
              if (action === 'Entry') p++;
              else if (action === 'Exit') {
                if (p > 0) { p--; pairs++; }
              }
            }
            paired += pairs;
            pending += p;
          }

          const totalSessions = paired + pending;

          // Active counts derived from open sessions later (we still fetch openSessions)
          this.stats.set({
            activeWorkers: 0,
            activeVisitors: 0,
            todayTotal: totalSessions,
            activeTotal: 0,
          });
        }
      },
      error: (error) => {
        console.error("Error loading today's stats:", error);
        // Keep default values on error
      },
    });

    // Also load open sessions for more accurate active count
    this.apiService.getOpenSessions().pipe(take(1)).subscribe({
      next: (response) => {
        if (response.success && response.data) {
          const openSessions = response.data as RawEntryExitRecordDto[];
          const activeWorkers = openSessions.filter(s => (s.personType ?? s.PersonType) === 'Labour' || (s.personType ?? s.PersonType) === 1).length;
          const activeVisitors = openSessions.filter(s => (s.personType ?? s.PersonType) === 'Visitor' || (s.personType ?? s.PersonType) === 2).length;

          this.stats.update((current) => ({
            ...current,
            activeWorkers,
            activeVisitors,
            activeTotal: openSessions.length,
          }));
        }
      },
      error: (error) => {
        console.error('Error loading open sessions:', error);
      },
    });
  }
}
