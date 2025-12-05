import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ApiService } from '../../core/services/api.service';
import { projectStore } from '../../core/state/project.store';
import { RawEntryExitRecordDto } from '../../core/models/entry-exit.model';
import { AuthService } from '../../core/auth/auth.service';
import { take } from 'rxjs/operators';

@Component({
  selector: 'app-today-summary',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="container">
      <div class="row mb-2">
        <div class="col-12">
          <div class="row align-center">
            <h1 class="mb-0">Today's Summary</h1>
          </div>
        </div>
      </div>

      <ng-container *ngIf="loading(); else loaded">
        <div class="row">
          <div class="col-12">
            <div class="card">
              <div class="card-body">
                <p class="text-muted mb-0">Loading records...</p>
              </div>
            </div>
          </div>
        </div>
      </ng-container>

      <ng-template #loaded>
        <div class="row mb-2">
          <div class="col-6">
            <div class="stat-card">
              <div class="stat-card__icon icon-box icon-box--success">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
              </div>
              <div class="stat-card__content">
                <div class="stat-value">{{ summary().totalLabour }}</div>
                <div class="stat-label">Labour Entries</div>
              </div>
            </div>
          </div>

          <div class="col-6">
            <div class="stat-card">
              <div class="stat-card__icon icon-box icon-box--info">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              </div>
              <div class="stat-card__content">
                <div class="stat-value">{{ summary().totalVisitors }}</div>
                <div class="stat-label">Visitor Entries</div>
              </div>
            </div>
          </div>
        </div>

        <div class="row mb-2">
          <div class="col-6">
            <div class="stat-card">
              <div class="stat-card__icon icon-box icon-box--neutral">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
              </div>
              <div class="stat-card__content">
                <div class="stat-value">{{ summary().activeNow }}</div>
                <div class="stat-label">Currently Active</div>
              </div>
            </div>
          </div>

          <div class="col-6">
            <div class="stat-card">
              <div class="stat-card__icon icon-box icon-box--danger">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <path d="M16 17l-5-5 5-5" />
                  <path d="M21 12H9" />
                </svg>
              </div>
              <div class="stat-card__content">
                <div class="stat-value">{{ summary().totalExits }}</div>
                <div class="stat-label">Total Exits</div>
              </div>
            </div>
          </div>
        </div>

        <div class="row">
          <div class="col-12">
            <div class="card mb-2">
              <div class="card-body">
                <h2 class="mb-2">Recent Activity</h2>

                <div *ngIf="records().length > 0">
                  <div
                    *ngFor="let record of records()"
                    [attr.data-id]="record.id"
                    class="record-item mb-2"
                    [class.entry]="record.action === 'Entry'"
                    [class.exit]="record.action === 'Exit'"
                  >
                    <div class="row align-center">
                      <div class="icon-box" [ngClass]="record.action === 'Entry' ? 'icon-box--success' : 'icon-box--danger'">
                        <svg *ngIf="record.action === 'Entry'; else exitIcon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                          <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                          <path d="M10 17l5-5-5-5" />
                          <path d="M13.8 12H3" />
                        </svg>
                        <ng-template #exitIcon>
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                            <path d="M16 17l-5-5 5-5" />
                            <path d="M21 12H9" />
                          </svg>
                        </ng-template>
                      </div>
                      <div class="flex-1">
                        <h4 class="mb-0">{{ record.name }}</h4>
                        <p class="text-muted mb-0">{{ record.personType }}</p>
                      </div>
                      <div class="record-time">{{ formatTime(record.timestamp ?? record.Timestamp ?? record.entryTime ?? '') }}</div>
                    </div>
                  </div>
                </div>

                <div *ngIf="records().length === 0" class="text-center py-3">
                  <div class="icon-box icon-box--neutral mb-1">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                      <line x1="16" y1="13" x2="8" y2="13" />
                      <line x1="16" y1="17" x2="8" y2="17" />
                    </svg>
                  </div>
                  <p class="text-muted mb-0">No records for today</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </ng-template>
    </div>
  `,
})
export class TodaySummaryComponent implements OnInit {
  private apiService = inject(ApiService);
  private authService = inject(AuthService);
  private router = inject(Router);

  loading = signal(false);
  summary = signal({
    totalLabour: 0,
    totalVisitors: 0,
    activeNow: 0,
    totalExits: 0
  });
  records = signal<RawEntryExitRecordDto[]>([]);
  projectId = projectStore.projectId;

  ngOnInit(): void {
    this.loadTodaySummary();
  }

  loadTodaySummary(): void {
    this.loading.set(true);

    const pid = this.projectId();
    this.apiService.getTodayRecords(pid ?? undefined).pipe(take(1)).subscribe({
      next: (response) => {
        this.loading.set(false);
        if (response.data) {
          this.processRecords(response.data);
        }
      },
      error: (err) => {
        this.loading.set(false);
        console.error('Failed to load summary:', err);
      }
    });
  }

  processRecords(data: { records?: RawEntryExitRecordDto[] } | RawEntryExitRecordDto[]): void {
    const recordsArray: RawEntryExitRecordDto[] = Array.isArray(data) ? data : (data.records ?? []);
    this.records.set(recordsArray);

    const labourEntries = recordsArray.filter((r) => (r.personType ?? r.PersonType) === 'Labour' || (r.personType ?? r.PersonType) === 1 && (r.action ?? r.Action) === 'Entry').length;
    const visitorEntries = recordsArray.filter((r) => (r.personType ?? r.PersonType) === 'Visitor' || (r.personType ?? r.PersonType) === 2 && (r.action ?? r.Action) === 'Entry').length;
    const exits = recordsArray.filter((r) => (r.action ?? r.Action) === 'Exit' || (r.action ?? r.Action) === 2).length;
    const entries = recordsArray.filter((r) => (r.action ?? r.Action) === 'Entry' || (r.action ?? r.Action) === 1).length;

    this.summary.set({
      totalLabour: labourEntries,
      totalVisitors: visitorEntries,
      activeNow: entries - exits,
      totalExits: exits
    });
  }

  formatTime(timestamp: string): string {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  }

  goBack(): void {
    this.router.navigate(['/dashboard']);
  }
}
