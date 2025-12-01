import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ContractorLabourResult } from '../../entry-exit.models';

@Component({
  selector: 'app-entry-exit-contractor-results',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="card mb-2" *ngIf="labour?.length">
      <div class="card-body">
        <div class="labour-results-header">
          <div class="labour-results-meta">
            <span class="labour-results-icon" aria-hidden="true">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </span>
            <div class="labour-results-copy">
              <h4 class="labour-results-title">Found {{ labour?.length || 0 }} labour</h4>
              <p class="labour-results-subtitle">Select workers to run bulk actions.</p>
            </div>
          </div>
          <button
            class="btn btn-outline btn-content labour-results-select-all"
            type="button"
            (click)="selectAll.emit()"
            [disabled]="disabled"
          >
            <ng-container *ngIf="allSelected; else selectIcon">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <polyline points="9 12 12 15 15 9" />
              </svg>
            </ng-container>
            <ng-template #selectIcon>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <rect x="3" y="3" width="18" height="18" rx="2" />
              </svg>
            </ng-template>
            <span>{{ allSelected ? 'Clear All' : 'Select All' }}</span>
          </button>
        </div>

        <div class="labour-list" role="list">
          <label
            class="labour-card"
            role="listitem"
            *ngFor="let r of labour; trackBy: trackById"
            [class.labour-card--selected]="selectedIds?.has(r.id)"
            [class.labour-card--disabled]="disabled"
          >
            <input
              class="sr-only"
              type="checkbox"
              [checked]="selectedIds?.has(r.id)"
              [disabled]="disabled"
              (change)="toggleLabour.emit(r.id)"
              [attr.aria-label]="'Toggle selection for ' + r.name"
            />
            <div
              class="labour-card__status"
              [ngClass]="r.hasOpenEntry ? 'labour-card__status--active' : 'labour-card__status--inactive'"
              aria-hidden="true"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </div>

            <div class="labour-card__details">
              <div class="labour-card__heading">
                <span class="labour-card__name">{{ r.name }}</span>
                <span
                  class="labour-card__state"
                  [class.labour-card__state--active]="r.hasOpenEntry"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <circle cx="12" cy="12" r="10" />
                    <circle cx="12" cy="12" r="5" />
                  </svg>
                  <span>{{ r.hasOpenEntry ? 'Active' : 'Offline' }}</span>
                </span>
              </div>
              <div class="labour-card__meta">
                <span class="labour-card__meta-item">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <path d="M22 16.92v2.09a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.1 2h2.09a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L7.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2z" />
                  </svg>
                  <span>{{ r.phoneNumber || 'No phone' }}</span>
                </span>
                <span class="labour-card__meta-item">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <rect x="3" y="4" width="18" height="16" rx="2" />
                    <line x1="7" y1="8" x2="7" y2="16" />
                    <line x1="12" y1="8" x2="12" y2="16" />
                    <line x1="17" y1="8" x2="17" y2="16" />
                  </svg>
                  <span>{{ r.barcode || 'No ID' }}</span>
                </span>
              </div>
            </div>

            <div class="labour-card__checkbox" aria-hidden="true">
              <svg *ngIf="selectedIds?.has(r.id); else emptyBoxIcon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <polyline points="9 12 12 15 15 9" />
              </svg>
              <ng-template #emptyBoxIcon>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                </svg>
              </ng-template>
            </div>
          </label>
        </div>

        <div class="labour-actions" *ngIf="selectedCount > 0">
          <p class="labour-actions__summary">
            <strong>{{ selectedCount }} labour selected</strong>
          </p>
          <div class="labour-actions__buttons">
            <button
              class="btn btn-content"
              type="button"
              (click)="bulkAction.emit('entry')"
              [disabled]="disabled"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <polyline points="5 12 9 16 19 6" />
              </svg>
              <span>Bulk Check-In</span>
            </button>
            <button
              class="btn btn-exit btn-content"
              type="button"
              (click)="bulkAction.emit('exit')"
              [disabled]="disabled"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M9 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              <span>Bulk Check-Out</span>
            </button>
            <button
              class="btn btn-outline btn-content"
              type="button"
              (click)="clear.emit()"
              [disabled]="disabled"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
              <span>Clear Selection</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EntryExitContractorResultsComponent {
  @Input() labour: ContractorLabourResult[] | null = null;
  @Input() selectedIds: Set<number> | null = new Set();
  @Input() selectedCount = 0;
  @Input() allSelected = false;
  @Input() disabled = false;

  @Output() toggleLabour = new EventEmitter<number>();
  @Output() selectAll = new EventEmitter<void>();
  @Output() clear = new EventEmitter<void>();
  @Output() bulkAction = new EventEmitter<'entry' | 'exit'>();

  trackById(_index: number, item: ContractorLabourResult) {
    return item.id;
  }
}
