import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IconComponent } from '../../../../shared/icon/icon.component';
import { ContractorLabourResult } from '../../entry-exit.models';

@Component({
  selector: 'app-entry-exit-contractor-results',
  standalone: true,
  imports: [CommonModule, IconComponent],
  template: `
    <div class="card mb-2" *ngIf="labour?.length">
      <div class="card-body">
        <div class="labour-results-header">
          <div class="labour-results-meta">
            <span class="labour-results-icon" aria-hidden="true">
              <app-icon name="user-group" size="28"></app-icon>
            </span>
            <div class="labour-results-copy">
              <h4 class="labour-results-title">Found {{ labour?.length || 0 }} labour</h4>
              <p class="labour-results-subtitle">Select workers to run bulk actions.</p>
            </div>
          </div>
          <button
            class="btn btn-outline labour-results-select-all"
            type="button"
            (click)="selectAll.emit()"
            [disabled]="disabled"
          >
            <ng-container *ngIf="allSelected; else selectIcon">
                <app-icon name="check-square" size="18"></app-icon>
            </ng-container>
            <ng-template #selectIcon>
              <app-icon name="square" size="18"></app-icon>
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
              <app-icon name="user-group" size="20"></app-icon>
            </div>

            <div class="labour-card__details">
              <div class="labour-card__heading">
                <span class="labour-card__name">{{ r.name }}</span>
                <span
                  class="labour-card__state"
                  [class.labour-card__state--active]="r.hasOpenEntry"
                >
                  <app-icon name="record-circle" size="18"></app-icon>
                  <span>{{ r.hasOpenEntry ? 'Active' : 'Offline' }}</span>
                </span>
              </div>
              <div class="labour-card__meta">
                <span class="labour-card__meta-item">
                  <app-icon name="phone" size="14"></app-icon>
                  <span>{{ r.phoneNumber || 'No phone' }}</span>
                </span>
                <span class="labour-card__meta-item">
                  <app-icon name="id-card" size="14"></app-icon>
                  <span>{{ r.barcode || 'No ID' }}</span>
                </span>
              </div>
            </div>

            <div class="labour-card__checkbox" aria-hidden="true">
              <ng-container *ngIf="selectedIds?.has(r.id); else emptyBoxIcon">
                <app-icon name="check-square" size="18"></app-icon>
              </ng-container>
              <ng-template #emptyBoxIcon>
                <app-icon name="square" size="18"></app-icon>
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
              class="btn"
              type="button"
              (click)="bulkAction.emit('entry')"
              [disabled]="disabled"
            >
              <app-icon name="check" size="16"></app-icon>
              <span>Bulk Check-In</span>
            </button>
            <button
              class="btn btn-exit"
              type="button"
              (click)="bulkAction.emit('exit')"
              [disabled]="disabled"
            >
              <app-icon name="close" size="16"></app-icon>
              <span>Bulk Check-Out</span>
            </button>
            <button
              class="btn btn-outline"
              type="button"
              (click)="clear.emit()"
              [disabled]="disabled"
            >
              <app-icon name="close" size="16"></app-icon>
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
