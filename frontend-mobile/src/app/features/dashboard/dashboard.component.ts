import { Component, inject, signal, OnInit, ChangeDetectionStrategy, computed, effect } from '@angular/core';
import { take } from 'rxjs/operators';
import { CommonModule } from '@angular/common';
import { IconComponent } from '../../shared/icon/icon.component';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { projectStore } from '../../core/state/project.store';
import { ApiService } from '../../core/services/api.service';
import { RawEntryExitRecordDto } from '../../core/models/entry-exit.model';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule, IconComponent],
  template: `
    <div class="page">
      <ng-container *ngIf="hasProject(); else noProjectState">
        <section class="hero card">
          <div class="hero-top">
            <div class="d-flex items-center gap-2" *ngIf="guardProfile(); else noProfile">
              <div class="profile-avatar flex-shrink-0">
                <app-icon name="shield-check" size="40" class="profile-icon"></app-icon>
              </div>
              <div class="flex-1 min-w-0">
                <h2 class="item-title mb-1">
                  {{ guardProfile()!.firstName }} {{ guardProfile()!.lastName }}
                </h2>
                <p class="text-meta mb-0">Guard ID: {{ guardProfile()!.guardId }}</p>
                <p class="text-meta mb-0">Phone: {{ guardProfile()!.phoneNumber }}</p>
                <p class="text-meta mb-0">Project: {{ guardProfile()!.projectName }}</p>
              </div>
            </div>
            <ng-template #noProfile>
              <div class="flex-1">
                <h2 class="item-title mb-1">No guard profile</h2>
                <p class="text-meta mb-1">Guard profile is not loaded.</p>
                <p *ngIf="profileError()" class="text-danger text-body-sm mb-2">{{ profileError() }}</p>
                <button class="btn mt-2" (click)="loadGuardProfile()" [disabled]="loadingProfile()">
                  <span *ngIf="loadingProfile(); else loadLabel">Loading...</span>
                  <ng-template #loadLabel><span>Load Guard Profile</span></ng-template>
                </button>
              </div>
            </ng-template>
          </div>
          <div class="d-grid grid-cols-2 gap-2">
            <div class="stat">
              <div class="d-flex items-center gap-2 mb-1">
                <div class="stat-icon stat-icon--medium icon-box--success flex-shrink-0">
                  <app-icon name="user-group" size="28"></app-icon>
                </div>
                <p class="stat-value mb-0">{{ stats().activeWorkers }}</p>
              </div>
              <p class="stat-label mb-0">Active Workers</p>
            </div>
            <div class="stat">
              <div class="d-flex items-center gap-2 mb-1">
                <div class="stat-icon stat-icon--medium icon-box--info flex-shrink-0">
                  <app-icon name="user" size="28"></app-icon>
                </div>
                <p class="stat-value mb-0">{{ stats().activeVisitors }}</p>
              </div>
              <p class="stat-label mb-0">Active Visitors</p>
            </div>
            <div class="stat">
              <div class="d-flex items-center gap-2 mb-1">
                <div class="stat-icon stat-icon--medium icon-box--warning flex-shrink-0">
                  <app-icon name="trend-up" size="28"></app-icon>
                </div>
                <p class="stat-value mb-0">{{ stats().todayTotal }}</p>
              </div>
              <p class="stat-label mb-0">Today's Total</p>
            </div>
            <div class="stat">
              <div class="d-flex items-center gap-2 mb-1">
                <div class="stat-icon stat-icon--medium icon-box--neutral flex-shrink-0">
                  <app-icon name="clock" size="28"></app-icon>
                </div>
                <p class="stat-value mb-0">{{ stats().activeTotal }}</p>
              </div>
              <p class="stat-label mb-0">Currently Active</p>
            </div>
          </div>
        </section>

        <section class="d-grid grid-cols-2 gap-2">
          <a class="action" routerLink="/labour-registration">
            <div class="action-icon icon-box icon-box--success flex-shrink-0">
              <app-icon name="user-group" size="28"></app-icon>
            </div>
            <span class="text-label font-semibold">Register Labour</span>
          </a>
          <a class="action" routerLink="/visitor-registration">
            <div class="action-icon icon-box icon-box--info flex-shrink-0">
              <app-icon name="user" size="28"></app-icon>
            </div>
            <span class="text-label font-semibold">Register Visitor</span>
          </a>
          <a class="action" routerLink="/entry-exit">
            <div class="action-icon icon-box icon-box--neutral flex-shrink-0">
              <app-icon name="entry" size="28"></app-icon>
            </div>
            <span class="text-label font-semibold">Entry/Exit</span>
          </a>
          <a class="action" routerLink="/reports">
            <div class="action-icon icon-box icon-box--warning flex-shrink-0">
              <app-icon name="report-trend" size="28"></app-icon>
            </div>
            <span class="text-label font-semibold">Reports</span>
          </a>
        </section>
        <section class="d-flex justify-center mt-3">
          <button class="btn btn-danger w-full" type="button" (click)="logout()" style="max-width: 360px;">
            <app-icon name="logout" size="20"></app-icon>
            <span>Logout</span>
          </button>
        </section>
      </ng-container>
      <ng-template #noProjectState>
        <section class="hero card">
          <div class="d-flex flex-column gap-2">
            <div>
              <h2 class="page-title mb-1">Project not assigned</h2>
              <p class="page-subtitle mb-0">{{ noProjectMessage }}</p>
            </div>
          </div>
        </section>
        <section class="d-flex justify-center mt-3">
          <button class="btn btn-danger w-full" type="button" (click)="logout()" style="max-width: 360px;">
            <app-icon name="logout" size="20"></app-icon>
            <span>Logout</span>
          </button>
        </section>
      </ng-template>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardComponent implements OnInit {
  private authService = inject(AuthService);
  private apiService = inject(ApiService);

  logout(): void {
    // Delegate to AuthService logout — show confirmation
    if (confirm('Are you sure you want to logout?')) {
      this.authService.logout();
    }
  }

  guardProfile = this.authService.guardProfile;
  projectId = projectStore.projectId;
  hasProject = computed(() => {
    const pid = this.projectId();
    return !!(pid && pid > 0);
  });
  loadingProfile = signal(false);
  profileError = signal('');
  stats = signal({
    activeWorkers: 0,
    activeVisitors: 0,
    todayTotal: 0,
    activeTotal: 0,
  });
  readonly noProjectMessage = 'Project not assigned. Please contact your administrator.';
  private lastStatsProjectId: number | null = null;

  private readonly projectEffect = effect(
    () => {
      const pid = this.projectId();
      if (pid && pid > 0) {
        if (pid !== this.lastStatsProjectId) {
          this.lastStatsProjectId = pid;
          this.loadTodaysStats(pid);
        }
        return;
      }

      this.lastStatsProjectId = null;
      this.stats.set({
        activeWorkers: 0,
        activeVisitors: 0,
        todayTotal: 0,
        activeTotal: 0,
      });
    },
    { allowSignalWrites: true }
  );

  ngOnInit(): void {
    // Load guard profile if not already loaded
    if (!this.guardProfile()) {
      this.loadGuardProfile();
    }
  }

  loadGuardProfile(): void {
    this.loadingProfile.set(true);
    this.profileError.set('');
    this.authService
      .loadGuardProfile()
      .pipe(take(1))
      .subscribe({
        next: (profile) => {
          this.loadingProfile.set(false);
        },
        error: (err) => {
          this.loadingProfile.set(false);
          this.profileError.set(err?.message || 'Failed to load guard profile');
        },
      });
  }

  private loadTodaysStats(projectId: number): void {
    // Get today's records to calculate statistics
    this.apiService
      .getTodayRecords(projectId)
      .pipe(take(1))
      .subscribe({
        next: (response) => {
          if (response.success && response.data) {
            const records = response.data as RawEntryExitRecordDto[];

            // Compute session-based totals: pair Entry->Exit so a pair counts once
            const grouped = new Map<string, RawEntryExitRecordDto[]>();
            records.forEach((r) => {
              const idPart =
                r.labourId ?? r.LabourId
                  ? `labour:${r.labourId ?? r.LabourId}`
                  : r.visitorId ?? r.VisitorId
                  ? `visitor:${r.visitorId ?? r.VisitorId}`
                  : r.personName ?? r.PersonName ?? 'unknown';
              const key = `${r.personType ?? r.PersonType}-${idPart}`;
              if (!grouped.has(key)) grouped.set(key, []);
              grouped.get(key)!.push(r);
            });

            let paired = 0;
            let pending = 0;

            for (const [k, recs] of grouped) {
              const sorted = recs
                .slice()
                .sort(
                  (a, b) =>
                    new Date(a.timestamp ?? a.Timestamp ?? a.entryTime ?? '').getTime() -
                    new Date(b.timestamp ?? b.Timestamp ?? b.entryTime ?? '').getTime()
                );
              let p = 0;
              let pairs = 0;
              for (const r of sorted) {
                const action =
                  (r.action ?? r.Action) === 'Exit' || (r.action ?? r.Action) === 2
                    ? 'Exit'
                    : 'Entry';
                if (action === 'Entry') p++;
                else if (action === 'Exit') {
                  if (p > 0) {
                    p--;
                    pairs++;
                  }
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
    this.apiService
      .getOpenSessions(projectId)
      .pipe(take(1))
      .subscribe({
        next: (response) => {
          if (response.success && response.data) {
            const openSessions = response.data as RawEntryExitRecordDto[];
            const activeWorkers = openSessions.filter(
              (s) =>
                (s.personType ?? s.PersonType) === 'Labour' || (s.personType ?? s.PersonType) === 1
            ).length;
            const activeVisitors = openSessions.filter(
              (s) =>
                (s.personType ?? s.PersonType) === 'Visitor' || (s.personType ?? s.PersonType) === 2
            ).length;

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
