import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { ApiService } from '../../core/services/api.service';
import { RawEntryExitRecordDto } from '../../core/models/entry-exit.model';

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
                {{ guardProfile()!.firstName }} {{ guardProfile()!.lastName }} ({{
                  guardProfile()!.guardId
                }})
              </h3>
              <div class="text-muted">Phone: {{ guardProfile()!.phoneNumber }}</div>
              <div class="text-muted">Project: {{ guardProfile()!.projectName }}</div>
            </div>
          </div>
          <ng-template #noProfile>
            <div class="card">
              <div class="card-body">
                <h3>No guard profile</h3>
                <p class="text-muted">
                  Guard profile is not loaded. Click below to fetch your profile.
                </p>
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
        <!-- <div class="col-6">
          <a class="card" routerLink="/search">
            <h2>Search</h2>
            <p class="text-muted">Find labour or visitor</p>
          </a>
        </div> -->
         <div class="col-6">
          <a class="card" routerLink="/reports">
            <h2>Reports</h2>
            <p class="text-muted">View analytics & reports</p>
          </a>
        </div>
      </div>

      <!-- <div class="row mb-2">
        <div class="col-6">
          <a class="card" routerLink="/today-summary">
            <h2>Today's Summary</h2>
            <p class="text-muted">View today's records</p>
          </a>
        </div>
        <div class="col-6">
          <a class="card" routerLink="/reports">
            <h2>Reports</h2>
            <p class="text-muted">View analytics & reports</p>
          </a>
        </div>
      </div> -->

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
    this.authService.loadGuardProfile().subscribe({
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
    this.apiService.getTodayRecords().subscribe({
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
    this.apiService.getOpenSessions().subscribe({
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
