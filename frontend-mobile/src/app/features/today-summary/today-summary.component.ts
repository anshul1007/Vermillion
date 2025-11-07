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
    <div class="summary-container">
      <div class="summary-header">
        <button class="back-button" (click)="goBack()">← Back</button>
        <h1>Today's Summary</h1>
      </div>

      @if (loading()) {
        <div class="loading">Loading records...</div>
      } @else {
        <div class="stats-grid">
          <div class="stat-box">
            <div class="stat-icon">👷</div>
            <div class="stat-value">{{ summary().totalLabour }}</div>
            <div class="stat-label">Labour Entries</div>
          </div>

          <div class="stat-box">
            <div class="stat-icon">👤</div>
            <div class="stat-value">{{ summary().totalVisitors }}</div>
            <div class="stat-label">Visitor Entries</div>
          </div>

          <div class="stat-box">
            <div class="stat-icon">✅</div>
            <div class="stat-value">{{ summary().activeNow }}</div>
            <div class="stat-label">Currently Active</div>
          </div>

          <div class="stat-box">
            <div class="stat-icon">🚪</div>
            <div class="stat-value">{{ summary().totalExits }}</div>
            <div class="stat-label">Total Exits</div>
          </div>
        </div>

        @if (records().length > 0) {
          <div class="records-section">
            <h2>Recent Activity</h2>
            <div class="records-list">
              @for (record of records(); track record.id) {
                <div class="record-item" [class.entry]="record.action === 'Entry'" [class.exit]="record.action === 'Exit'">
                  <div class="record-icon">
                    {{ record.action === 'Entry' ? '→' : '←' }}
                  </div>
                  <div class="record-details">
                    <div class="record-name">{{ record.name }}</div>
                    <div class="record-type">{{ record.personType }}</div>
                  </div>
                  <div class="record-time">
                    {{ formatTime(record.timestamp) }}
                  </div>
                </div>
              }
            </div>
          </div>
        } @else {
          <div class="no-records">
            <div class="empty-icon">📋</div>
            <p>No records for today</p>
          </div>
        }
      }
    </div>
  `
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
