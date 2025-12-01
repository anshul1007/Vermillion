import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IconComponent } from '../../shared/icon/icon.component';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ApiService } from '../../core/services/api.service';
import { take } from 'rxjs/operators';
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
  imports: [CommonModule, FormsModule, IconComponent],
  template: `
    <div class="reports-page">
      <section class="reports-hero card">
        <div class="reports-hero__header">
          <button type="button" class="chip-button" (click)="goBack()">Back</button>
          <div class="reports-hero__title">
            <h1>Reports & Analytics</h1>
            <p class="reports-hero__subtitle">Monitor labour and visitor movement on site</p>
            @if (fromDate && toDate) {
              <p class="reports-hero__range">{{ fromDate }} - {{ toDate }}</p>
            }
          </div>
        </div>
        <div class="chip-actions reports-hero__quick">
          <button type="button" class="chip-button" (click)="setDateRange('today')" [class.is-active]="selectedRange() === 'today'">Today</button>
          <button type="button" class="chip-button" (click)="setDateRange('week')" [class.is-active]="selectedRange() === 'week'">This Week</button>
          <button type="button" class="chip-button" (click)="setDateRange('month')" [class.is-active]="selectedRange() === 'month'">This Month</button>
        </div>
        <div class="reports-hero__dates">
          <label class="form-field reports-date-field">
            <span>From Date</span>
            <input type="date" [(ngModel)]="fromDate" (change)="loadRecords()" />
          </label>
          <label class="form-field reports-date-field">
            <span>To Date</span>
            <input type="date" [(ngModel)]="toDate" (change)="loadRecords()" />
          </label>
        </div>
      </section>

      @if (loading()) {
        <section class="reports-loading card">
          <div class="reports-loading__spinner"></div>
          <p>Loading reports...</p>
        </section>
      }

      @if (!loading() && statistics()) {
        <section class="reports-stats card">
          <div class="reports-stats__grid">
            <div class="reports-stat">
              <div class="reports-stat__icon">
                <app-icon name="entry" size="28"></app-icon>
              </div>
              <div class="reports-stat__content">
                <span class="reports-stat__value">{{ statistics()!.totalEntries }}</span>
                <span class="reports-stat__label">Total Entries</span>
              </div>
            </div>
            <div class="reports-stat">
              <div class="reports-stat__icon">
                <app-icon name="exit" size="28"></app-icon>
              </div>
              <div class="reports-stat__content">
                <span class="reports-stat__value">{{ statistics()!.totalExits }}</span>
                <span class="reports-stat__label">Total Exits</span>
              </div>
            </div>
            <div class="reports-stat">
              <div class="reports-stat__icon">
                <app-icon name="clock" size="28"></app-icon>
              </div>
              <div class="reports-stat__content">
                <span class="reports-stat__value">{{ statistics()!.openSessions }}</span>
                <span class="reports-stat__label">Open Sessions</span>
              </div>
            </div>
            <div class="reports-stat">
              <div class="reports-stat__icon">
                <app-icon name="user-group" size="28"></app-icon>
              </div>
              <div class="reports-stat__content">
                <span class="reports-stat__value">{{ statistics()!.totalLabour }}</span>
                <span class="reports-stat__label">Labour Records</span>
              </div>
            </div>
            <div class="reports-stat">
              <div class="reports-stat__icon">
                <app-icon name="user" size="28"></app-icon>
              </div>
              <div class="reports-stat__content">
                <span class="reports-stat__value">{{ statistics()!.totalVisitors }}</span>
                <span class="reports-stat__label">Visitor Records</span>
              </div>
            </div>
          </div>
        </section>

        <section class="reports-records card">
          <div class="reports-records__header">
            <h3>Recent Records</h3>
            <span class="reports-records__count">{{ sessions().length }} records</span>
          </div>

          @if (records().length === 0) {
            <div class="reports-empty">
              <div class="reports-empty__icon">
                <app-icon name="logo" size="40"></app-icon>
              </div>
              <p>No records found for the selected range</p>
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
                            <app-icon name="dot" size="16" class="active-dot" aria-label="Active session"></app-icon>
                          } @else {
                            <span class="checked-out-dot" title="Checked out">
                              <app-icon name="dot-check" size="16"></app-icon>
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
        </section>
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

    this.apiService.getRecords(this.fromDate, this.toDate).pipe(take(1)).subscribe({
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

    this.apiService.getOpenSessions().pipe(take(1)).subscribe({
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
