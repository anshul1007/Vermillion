import { Component, inject, signal, OnInit, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IconComponent } from '../../shared/icon/icon.component';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';
import { projectStore } from '../../core/state/project.store';
import { take } from 'rxjs/operators';
import { RawEntryExitRecordDto } from '../../core/models/entry-exit.model';
import { AuthService } from '../../core/auth/auth.service';

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
    <div class="page">
      <ng-container *ngIf="currentProjectId(); else noProjectState">
        <section class="hero card">
          <div class="d-flex flex-column gap-1 mb-2">
            <h1 class="page-title mb-0">Entry & Exit Reports</h1>
            <p class="page-subtitle mb-0" *ngIf="currentProjectName()">
              {{ currentProjectName() }}
            </p>
          </div>

          <div class="d-flex flex-wrap gap-2">
            <button
              type="button"
              class="chip-button"
              (click)="setDateRange('today')"
              [class.is-active]="selectedRange() === 'today'"
            >
              Today
            </button>
            <button
              type="button"
              class="chip-button"
              (click)="setDateRange('week')"
              [class.is-active]="selectedRange() === 'week'"
            >
              This Week
            </button>
            <button
              type="button"
              class="chip-button"
              (click)="setDateRange('month')"
              [class.is-active]="selectedRange() === 'month'"
            >
              This Month
            </button>
          </div>
        </section>

        @if (loading()) {
        <section class="loading card">
          <div class="loading__spinner"></div>
          <p>Loading reports...</p>
        </section>
        } @if (!loading() && statistics()) {
        <section class="hero card">
          <div class="d-grid grid-cols-2 gap-2">
            <div class="stat">
              <div class="d-flex items-center gap-2 mb-1">
                <div class="stat-icon stat-icon--medium icon-box--success flex-shrink-0">
                  <app-icon name="entry" size="28"></app-icon>
                </div>
                <p class="stat-value mb-0">{{ statistics()!.totalEntries }}</p>
              </div>
              <p class="stat-label mb-0">Total Entries</p>
            </div>
            <div class="stat">
              <div class="d-flex items-center gap-2 mb-1">
                <div class="stat-icon stat-icon--medium icon-box--danger flex-shrink-0">
                  <app-icon name="exit" size="28"></app-icon>
                </div>
                <p class="stat-value mb-0">{{ statistics()!.totalExits }}</p>
              </div>
              <p class="stat-label mb-0">Total Exits</p>
            </div>
            <div class="stat">
              <div class="d-flex items-center gap-2 mb-1">
                <div class="stat-icon stat-icon--medium icon-box--neutral flex-shrink-0">
                  <app-icon name="clock" size="28"></app-icon>
                </div>
                <p class="stat-value mb-0">{{ statistics()!.openSessions }}</p>
              </div>
              <p class="stat-label mb-0">Open Sessions</p>
            </div>
            <div class="stat">
              <div class="d-flex items-center gap-2 mb-1">
                <div class="stat-icon stat-icon--medium icon-box--warning flex-shrink-0">
                  <app-icon name="user-group" size="28"></app-icon>
                </div>
                <p class="stat-value mb-0">{{ statistics()!.totalLabour }}</p>
              </div>
              <p class="stat-label mb-0">Labour Records</p>
            </div>
            <div class="stat">
              <div class="d-flex items-center gap-2 mb-1">
                <div class="stat-icon stat-icon--medium icon-box--info flex-shrink-0">
                  <app-icon name="user" size="28"></app-icon>
                </div>
                <p class="stat-value mb-0">{{ statistics()!.totalVisitors }}</p>
              </div>
              <p class="stat-label mb-0">Visitor Records</p>
            </div>
          </div>
        </section>

        <section class="card records">
          <div class="records__header">
            <h3>Recent Records</h3>
            <span class="records__count">{{ sessions().length }} records</span>
          </div>

          @if (records().length === 0) {
          <div class="empty">
            <div class="empty__icon">
              <app-icon name="logo" size="40"></app-icon>
            </div>
            <p>No records found for the selected range</p>
          </div>
          } @else {
          <div class="sessions-list">
            @for (session of sessions(); track session.id) {
            <article class="session-card" [class.session-card--active]="!session.exitTime">
              <div class="session-card__header">
                <span class="status-indicator" [class.active]="!session.exitTime">
                  @if (!session.exitTime || session.exitTime === '') {
                  <app-icon
                    name="dot"
                    size="16"
                    class="active-dot"
                    aria-label="Active session"
                  ></app-icon>
                  } @else {
                  <span class="checked-out-dot" title="Checked out">
                    <app-icon name="dot-check" size="16"></app-icon>
                  </span>
                  }
                  <span
                    class="type-badge"
                    [class.labour]="session.personType === 'Labour'"
                    [class.visitor]="session.personType === 'Visitor'"
                  >
                    {{ session.personType }}
                  </span>
                </span>
                <div class="session-card__title">
                  <h4>{{ session.name }}</h4>
                  <span class="session-card__contractor">{{ session.contractor || '-' }}</span>
                </div>
              </div>
              <div class="session-card__body">
                <div class="session-card__item">
                  <span class="label">Entry Time</span>
                  <span class="value">{{
                    session.entryTime ? formatDateTime(session.entryTime) : '-'
                  }}</span>
                </div>
                <div class="session-card__item">
                  <span class="label">Exit Time</span>
                  <span class="value">{{
                    session.exitTime ? formatDateTime(session.exitTime) : '-'
                  }}</span>
                </div>
                <div class="session-card__item">
                  <span class="label">Guard</span>
                  <span class="value">{{ session.guardName || '-' }}</span>
                </div>
              </div>
            </article>
            }
          </div>
          }
        </section>
        }
      </ng-container>
      <ng-template #noProjectState>
        <section class="hero card">
          <div class="d-flex flex-column gap-1">
            <h1 class="page-title mb-0">Entry & Exit Reports</h1>
            <p class="page-subtitle mb-0">{{ noProjectMessage }}</p>
          </div>
        </section>
      </ng-template>
    </div>
  `,
})
export class ReportsComponent implements OnInit {
  private apiService = inject(ApiService);
  private authService = inject(AuthService);

  guardProfile = this.authService.guardProfile;

  fromDate = '';
  toDate = '';
  selectedRange = signal<'today' | 'week' | 'month' | 'custom'>('today');
  loading = signal(false);
  records = signal<EntryExitRecord[]>([]);
  sessions = signal<SessionRow[]>([]);
  statistics = signal<Statistics | null>(null);
  currentProjectId = signal<number | null>(
    projectStore.projectId() ?? this.guardProfile()?.projectId ?? null
  );
  currentProjectName = signal<string>(
    projectStore.projectName() ?? this.guardProfile()?.projectName ?? ''
  );
  readonly noProjectMessage = 'Project not assigned. Please contact your administrator.';

  private readonly projectEffect = effect(
    () => {
      const profile = this.guardProfile();
      const pid = projectStore.projectId() ?? profile?.projectId ?? null;
      const pname = projectStore.projectName() ?? profile?.projectName ?? '';

      if (pid !== this.currentProjectId()) {
        this.currentProjectId.set(pid);
      }

      if (pname !== this.currentProjectName()) {
        this.currentProjectName.set(pname || '');
      }

      if (!pid || pid <= 0) {
        this.loading.set(false);
        if (this.records().length > 0) {
          this.records.set([]);
        }
        if (this.sessions().length > 0) {
          this.sessions.set([]);
        }
        if (this.statistics()) {
          this.statistics.set(null);
        }
      }
    },
    { allowSignalWrites: true }
  );

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

    const pid = this.currentProjectId();
    if (!pid || pid <= 0) {
      this.loading.set(false);
      this.records.set([]);
      this.sessions.set([]);
      this.statistics.set(null);
      return;
    }

    this.loading.set(true);

    this.apiService
      .getRecords(this.fromDate, this.toDate, undefined, undefined, pid)
      .pipe(take(1))
      .subscribe({
        next: (response) => {
          this.loading.set(false);

          if (response.success && response.data) {
            // Normalize records to handle different JSON shapes (enum as number/string, PascalCase properties)
            const normalized = (response.data as RawEntryExitRecordDto[]).map((r) => {
              const actionRaw = r.action ?? r.Action;
              const action: 'Entry' | 'Exit' =
                typeof actionRaw === 'number'
                  ? actionRaw === 1
                    ? 'Entry'
                    : 'Exit'
                  : String(actionRaw || '') === 'Exit'
                  ? 'Exit'
                  : 'Entry';

              const typeRaw = r.personType ?? r.PersonType;
              const personType: 'Labour' | 'Visitor' =
                typeof typeRaw === 'number'
                  ? typeRaw === 1
                    ? 'Labour'
                    : 'Visitor'
                  : String(typeRaw || '') === 'Visitor'
                  ? 'Visitor'
                  : 'Labour';

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
        },
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
      const aTime = a.entryTime
        ? new Date(a.entryTime).getTime()
        : a.exitTime
        ? new Date(a.exitTime).getTime()
        : 0;
      const bTime = b.entryTime
        ? new Date(b.entryTime).getTime()
        : b.exitTime
        ? new Date(b.exitTime).getTime()
        : 0;
      return bTime - aTime;
    });

    this.sessions.set(sessions);
  }

  private calculateStatistics(records: EntryExitRecord[]) {
    // Compute session-based totals (Entry+Exit pair counts as one session)
    // Totals reflect raw action counts in the selected date range
    const totalEntriesCount = records.filter((r) => r.action === 'Entry').length;
    const totalExitsCount = records.filter((r) => r.action === 'Exit').length;

    const totalLabour = records.filter(
      (r) => r.personType === 'Labour' && r.action === 'Entry'
    ).length;
    const totalVisitors = records.filter(
      (r) => r.personType === 'Visitor' && r.action === 'Entry'
    ).length;

    // Group records by person (prefer labourId/visitorId when available, else fallback to name)
    const grouped = new Map<string, EntryExitRecord[]>();
    records.forEach((r) => {
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
      const sorted = recs
        .slice()
        .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      let p = 0;
      let pairs = 0;

      for (const r of sorted) {
        if (r.action === 'Entry') {
          p++;
        } else if (r.action === 'Exit') {
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

    const initialStats: Statistics = {
      // show raw action totals for Entries/Exits and session-based openSessions
      totalEntries: totalEntriesCount,
      totalExits: totalExitsCount,
      openSessions: pending, // fallback: open within selected range
      totalLabour,
      totalVisitors,
    };

    // Set initial stats, then fetch current open sessions (like dashboard) to show live active count
    this.statistics.set(initialStats);

    const pid = this.currentProjectId();
    if (!pid || pid <= 0) {
      return;
    }

    this.apiService
      .getOpenSessions(pid)
      .pipe(take(1))
      .subscribe({
        next: (resp) => {
          if (resp.success && resp.data) {
            const open = (resp.data as RawEntryExitRecordDto[]).length;
            // update only openSessions to reflect current active sessions
            this.statistics.update((s) => ({ ...s!, openSessions: open }));
          }
        },
        error: (err) => {
          // keep fallback pending value on error
          console.error('Error fetching open sessions:', err);
        },
      });
  }

  formatDateTime(timestamp: string): string {
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
}
