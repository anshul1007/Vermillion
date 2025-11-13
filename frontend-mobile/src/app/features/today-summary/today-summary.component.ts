import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/auth/auth.service';

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
              <div class="stat-icon">👷</div>
              <div class="stat-value">{{ summary().totalLabour }}</div>
              <div class="stat-label">Labour Entries</div>
            </div>
          </div>

          <div class="col-6">
            <div class="stat-card">
              <div class="stat-icon">👤</div>
              <div class="stat-value">{{ summary().totalVisitors }}</div>
              <div class="stat-label">Visitor Entries</div>
            </div>
          </div>
        </div>

        <div class="row mb-2">
          <div class="col-6">
            <div class="stat-card">
              <div class="stat-icon">✅</div>
              <div class="stat-value">{{ summary().activeNow }}</div>
              <div class="stat-label">Currently Active</div>
            </div>
          </div>

          <div class="col-6">
            <div class="stat-card">
              <div class="stat-icon">🚪</div>
              <div class="stat-value">{{ summary().totalExits }}</div>
              <div class="stat-label">Total Exits</div>
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
                      <div class="avatar">
                        {{ record.action === 'Entry' ? '✅' : '🚪' }}
                      </div>
                      <div class="flex-1">
                        <h4 class="mb-0">{{ record.name }}</h4>
                        <p class="text-muted mb-0">{{ record.personType }}</p>
                      </div>
                      <div class="record-time">{{ record.time }}</div>
                    </div>
                  </div>
                </div>

                <div *ngIf="records().length === 0" class="text-center py-3">
                  <div class="stat-icon mb-1">📋</div>
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
  records = signal<any[]>([]);

  ngOnInit(): void {
    this.loadTodaySummary();
  }

  loadTodaySummary(): void {
    this.loading.set(true);

    this.apiService.getTodayRecords().subscribe({
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

  processRecords(data: any): void {
    const records = data.records || [];
    this.records.set(records);

    const labourEntries = records.filter((r: any) => r.personType === 'Labour' && r.action === 'Entry').length;
    const visitorEntries = records.filter((r: any) => r.personType === 'Visitor' && r.action === 'Entry').length;
    const exits = records.filter((r: any) => r.action === 'Exit').length;
    const entries = records.filter((r: any) => r.action === 'Entry').length;

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
