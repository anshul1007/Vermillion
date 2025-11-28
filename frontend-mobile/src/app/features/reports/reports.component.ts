import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ApiService } from '../../core/services/api.service';
import { RawEntryExitRecordDto } from '../../core/models/entry-exit.model';

interface EntryExitRecord {
  id: number;
  personType: 'Labour' | 'Visitor';
  personName?: string;
  action: 'Entry' | 'Exit';
  timestamp: string;
  gate?: string;
  guardName?: string;
  projectName?: string;
  contractorName?: string;
  labourId?: number | null;
  visitorId?: number | null;
}

interface SessionRow {
  id: string;
  personType: 'Labour' | 'Visitor';
  name: string;
  contractor?: string | null;
  entryTime: string;
  exitTime?: string | null;
  guardName?: string | null;
}

interface Statistics {
  totalEntries: number;
  totalExits: number;
  openSessions: number;
  totalLabour: number;
  totalVisitors: number;
}

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="reports-container">
      <div class="reports-header">
        <button class="back-btn" (click)="goBack()">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
        </button>
        <h1>Reports & Analytics</h1>
      </div>

      <div class="filters-card">
        <h3>Date Range</h3>
        <div class="date-filters">
          <div class="date-input-group">
            <label>From Date</label>
            <input type="date" [(ngModel)]="fromDate" (change)="loadRecords()" />
          </div>
          <div class="date-input-group">
            <label>To Date</label>
            <input type="date" [(ngModel)]="toDate" (change)="loadRecords()" />
          </div>
        </div>
        <div class="quick-filters">
          <button (click)="setDateRange('today')" [class.active]="selectedRange() === 'today'">Today</button>
          <button (click)="setDateRange('week')" [class.active]="selectedRange() === 'week'">This Week</button>
          <button (click)="setDateRange('month')" [class.active]="selectedRange() === 'month'">This Month</button>
        </div>
      </div>

      @if (loading()) {
        <div class="loading">
          <div class="spinner"></div>
          <p>Loading reports...</p>
        </div>
      }

      @if (!loading() && statistics()) {
        <div class="statistics-grid">
          <div class="stat-card entries">
            <div class="stat-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M13.8 12H3"/>
              </svg>
            </div>
            <div class="stat-info">
              <div class="stat-value">{{ statistics()!.totalEntries }}</div>
              <div class="stat-label">Total Entries</div>
            </div>
          </div>

          <div class="stat-card exits">
            <div class="stat-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l-5-5 5-5M21 12H9"/>
              </svg>
            </div>
            <div class="stat-info">
              <div class="stat-value">{{ statistics()!.totalExits }}</div>
              <div class="stat-label">Total Exits</div>
            </div>
          </div>

          <div class="stat-card open">
            <div class="stat-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <polyline points="12 6 12 12 16 14"/>
              </svg>
            </div>
            <div class="stat-info">
              <div class="stat-value">{{ statistics()!.openSessions }}</div>
              <div class="stat-label">Open Sessions</div>
            </div>
          </div>

          <div class="stat-card labour">
            <div class="stat-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
            </div>
            <div class="stat-info">
              <div class="stat-value">{{ statistics()!.totalLabour }}</div>
              <div class="stat-label">Labour Records</div>
            </div>
          </div>

          <div class="stat-card visitors">
            <div class="stat-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                <circle cx="12" cy="7" r="4"/>
              </svg>
            </div>
            <div class="stat-info">
              <div class="stat-value">{{ statistics()!.totalVisitors }}</div>
              <div class="stat-label">Visitor Records</div>
            </div>
          </div>
        </div>

        <div class="records-section">
            <div class="section-header">
            <h3>Recent Records</h3>
            <div class="record-count">{{ sessions().length }} records</div>
          </div>

          @if (records().length === 0) {
            <div class="no-records">
              <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
                <line x1="16" y1="13" x2="8" y2="13"/>
                <line x1="16" y1="17" x2="8" y2="17"/>
                <polyline points="10 9 9 9 8 9"/>
              </svg>
              <p>No records found for the selected date range</p>
            </div>
          } @else {
            <div class="sessions-table-wrapper">
              <table class="sessions-table">
                <thead>
                  <tr>
                    <th class="col-status">Type</th>
                    <th class="col-name">Name</th>
                    <th class="col-company">Company / Contractor</th>
                    <th class="col-entry">Entry Time</th>
                    <th class="col-exit">Exit Time</th>
                    <th class="col-guard">Guard</th>
                  </tr>
                </thead>
                <tbody>
                  @for (session of sessions(); track session.id) {
                    <tr>
                      <td class="col-status">
                        <span class="status-indicator" [class.active]="!session.exitTime">
                          @if (!session.exitTime || session.exitTime === '') {
                            <svg class="active-dot" width="16" height="16" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Active session">
                              <title>Active session</title>
                              <circle cx="8" cy="8" r="6" />
                            </svg>
                          } @else {
                            <span class="checked-out-dot" title="Checked out">
                              <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
                                <circle cx="12" cy="12" r="10" />
                                <path d="M9 12.5l1.8 1.8L15 11" stroke="#fff" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" />
                              </svg>
                            </span>
                          }
                          <span class="type-badge" [class.labour]="session.personType === 'Labour'" [class.visitor]="session.personType === 'Visitor'">
                            {{ session.personType }}
                          </span>
                        </span>
                      </td>
                      <td class="col-name">{{ session.name }}</td>
                      <td class="col-company">{{ session.contractor || '-' }}</td>
                      <td class="col-entry">{{ session.entryTime ? formatDateTime(session.entryTime) : '-' }}</td>
                      <td class="col-exit">{{ session.exitTime ? formatDateTime(session.exitTime) : '-' }}</td>
                      <td class="col-guard">{{ session.guardName || '-' }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }
        </div>
      }
    </div>
  `
})
export class ReportsComponent implements OnInit {
  private apiService = inject(ApiService);
  private router = inject(Router);

  fromDate = '';
  toDate = '';
  selectedRange = signal<'today' | 'week' | 'month' | 'custom'>('today');
  loading = signal(false);
  records = signal<EntryExitRecord[]>([]);
  sessions = signal<SessionRow[]>([]);
  statistics = signal<Statistics | null>(null);

  ngOnInit() {
    this.setDateRange('today');
  }

  setDateRange(range: 'today' | 'week' | 'month') {
    this.selectedRange.set(range);
    const today = new Date();
    const toDate = new Date(today);

    let fromDate = new Date(today);

    switch (range) {
      case 'today':
        break;
      case 'week':
        fromDate.setDate(today.getDate() - 7);
        break;
      case 'month':
        fromDate.setMonth(today.getMonth() - 1);
        break;
    }

    this.fromDate = fromDate.toISOString().split('T')[0];
    this.toDate = toDate.toISOString().split('T')[0];

    this.loadRecords();
  }

  loadRecords() {
    if (!this.fromDate || !this.toDate) return;

    this.loading.set(true);

    this.apiService.getRecords(this.fromDate, this.toDate).subscribe({
      next: (response) => {
        this.loading.set(false);

        if (response.success && response.data) {
          // Normalize records to handle different JSON shapes (enum as number/string, PascalCase properties)
          const normalized = (response.data as RawEntryExitRecordDto[]).map((r) => {
            const actionRaw = r.action ?? r.Action;
            const action: 'Entry' | 'Exit' = typeof actionRaw === 'number'
              ? (actionRaw === 1 ? 'Entry' : 'Exit')
              : ((String(actionRaw || '') === 'Exit') ? 'Exit' : 'Entry');

            const typeRaw = r.personType ?? r.PersonType;
            const personType: 'Labour' | 'Visitor' = typeof typeRaw === 'number'
              ? (typeRaw === 1 ? 'Labour' : 'Visitor')
              : ((String(typeRaw || '') === 'Visitor') ? 'Visitor' : 'Labour');

            const personName = r.personName ?? r.PersonName ?? r.name ?? '';
            const timestamp = r.timestamp ?? r.Timestamp ?? r.entryTime ?? '';
            const gate = r.gate ?? r.Gate ?? null;
            const guardName = r.guardName ?? r.GuardName ?? r.recordedBy ?? null;
            const projectName = r.projectName ?? r.ProjectName ?? null;
            const contractorName = r.contractorName ?? r.ContractorName ?? null;

            const labourId = r.labourId ?? r.LabourId ?? r.labourRegistrationId ?? null;
            const visitorId = r.visitorId ?? r.VisitorId ?? null;

            return {
              id: r.id,
              personType,
              personName,
              action,
              timestamp,
              gate,
              guardName,
              projectName,
              contractorName,
              labourId,
              visitorId,
            } as EntryExitRecord;
          });

          this.records.set(normalized);
          this.buildSessions(normalized);
          this.calculateStatistics(normalized);
        }
      },
      error: (error) => {
        this.loading.set(false);
        console.error('Error loading records:', error);
      }
    });
  }

  private buildSessions(records: EntryExitRecord[]) {
    const grouped = new Map<string, EntryExitRecord[]>();

    for (const record of records) {
      let keySuffix = 'unknown';
      if (record.labourId != null && record.labourId !== 0) {
        keySuffix = `labour:${record.labourId}`;
      } else if (record.visitorId != null && record.visitorId !== 0) {
        keySuffix = `visitor:${record.visitorId}`;
      } else if (record.personName) {
        keySuffix = record.personName;
      }

      const key = `${record.personType}-${keySuffix}`;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(record);
    }

    const sessions: SessionRow[] = [];

    for (const [key, entries] of grouped) {
      const sorted = entries
        .slice()
        .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

      const pending: EntryExitRecord[] = [];

      for (const record of sorted) {
        if (record.action === 'Entry') {
          pending.push(record);
          continue;
        }

        if (record.action === 'Exit' && pending.length > 0) {
          const entry = pending.shift()!;
          sessions.push({
            id: `${key}-${entry.timestamp}-${record.timestamp}`,
            personType: entry.personType,
            name: entry.personName || record.personName || 'Unknown',
            contractor: entry.contractorName ?? record.contractorName ?? null,
            entryTime: entry.timestamp,
            exitTime: record.timestamp,
            guardName: record.guardName ?? entry.guardName ?? null,
          });
          continue;
        }

        if (record.action === 'Exit') {
          sessions.push({
            id: `${key}-exit-${record.timestamp}`,
            personType: record.personType,
            name: record.personName || 'Unknown',
            contractor: record.contractorName ?? null,
            entryTime: '',
            exitTime: record.timestamp,
            guardName: record.guardName ?? null,
          });
        }
      }

      for (const entry of pending) {
        sessions.push({
          id: `${key}-open-${entry.timestamp}`,
          personType: entry.personType,
          name: entry.personName || 'Unknown',
          contractor: entry.contractorName ?? null,
          entryTime: entry.timestamp,
          exitTime: null,
          guardName: entry.guardName ?? null,
        });
      }
    }

    sessions.sort((a, b) => {
      const aTime = a.entryTime ? new Date(a.entryTime).getTime() : (a.exitTime ? new Date(a.exitTime).getTime() : 0);
      const bTime = b.entryTime ? new Date(b.entryTime).getTime() : (b.exitTime ? new Date(b.exitTime).getTime() : 0);
      return bTime - aTime;
    });

    this.sessions.set(sessions);
  }

  private calculateStatistics(records: EntryExitRecord[]) {
    // Compute session-based totals (Entry+Exit pair counts as one session)
    // Totals reflect raw action counts in the selected date range
    const totalEntriesCount = records.filter(r => r.action === 'Entry').length;
    const totalExitsCount = records.filter(r => r.action === 'Exit').length;

    const totalLabour = records.filter(r => r.personType === 'Labour' && r.action === 'Entry').length;
    const totalVisitors = records.filter(r => r.personType === 'Visitor' && r.action === 'Entry').length;

    // Group records by person (prefer labourId/visitorId when available, else fallback to name)
    const grouped = new Map<string, EntryExitRecord[]>();
    records.forEach(r => {
      let idPart = 'unknown';
      if (r.labourId != null && r.labourId !== 0) idPart = `labour:${r.labourId}`;
      else if (r.visitorId != null && r.visitorId !== 0) idPart = `visitor:${r.visitorId}`;
      else idPart = r.personName || 'unknown';

      const key = `${r.personType}-${idPart}`;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(r);
    });

    let paired = 0;
    let pending = 0;

    for (const [, recs] of grouped) {
      const sorted = recs.slice().sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      let p = 0;
      let pairs = 0;

      for (const r of sorted) {
        if (r.action === 'Entry') {
          p++;
        } else if (r.action === 'Exit') {
          if (p > 0) { p--; pairs++; }
        }
      }

      paired += pairs;
      pending += p;
    }

    const totalSessions = paired + pending;

    const initialStats: Statistics = {
      // show raw action totals for Entries/Exits and session-based openSessions
      totalEntries: totalEntriesCount,
      totalExits: totalExitsCount,
      openSessions: pending, // fallback: open within selected range
      totalLabour,
      totalVisitors
    };

    // Set initial stats, then fetch current open sessions (like dashboard) to show live active count
    this.statistics.set(initialStats);

    this.apiService.getOpenSessions().subscribe({
      next: (resp) => {
        if (resp.success && resp.data) {
          const open = (resp.data as RawEntryExitRecordDto[]).length;
          // update only openSessions to reflect current active sessions
          this.statistics.update(s => ({ ...s!, openSessions: open }));
        }
      },
      error: (err) => {
        // keep fallback pending value on error
        console.error('Error fetching open sessions:', err);
      }
    });
  }

  formatDateTime(timestamp: string): string {
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  goBack() {
    this.router.navigate(['/dashboard']);
  }
}
