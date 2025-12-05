import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IconComponent } from '../../../../shared/icon/icon.component';
import { EntryExitPersonCardComponent } from '../person-card/entry-exit-person-card.component';
import { ContractorLabourResult, PersonSearchResult, PersonType } from '../../entry-exit.models';

@Component({
  selector: 'app-entry-exit-contractor-results',
  standalone: true,
  imports: [CommonModule, IconComponent, EntryExitPersonCardComponent],
  template: `
    <ng-container *ngIf="labour?.length">
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
            role="listitem"
            *ngFor="let r of labour; trackBy: trackById"
          >
            <input
              class="sr-only"
              type="checkbox"
              [checked]="selectedIds?.has(r.id)"
              [disabled]="disabled"
              (change)="toggleLabour.emit(r.id)"
              [attr.aria-label]="'Toggle selection for ' + r.name"
            />

            <app-entry-exit-person-card
              [person]="createPersonFromLabour(r)"
              [imageSrc]="(imageResolver ? imageResolver(r) : labourImageResolver(r))"
              [showCheckbox]="true"
              [isSelected]="(selectedIds?.has(r.id)) ?? false"
              [showActions]="false"
              [noCard]="true"
              [disabled]="disabled"
            ></app-entry-exit-person-card>
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
    </ng-container>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EntryExitContractorResultsComponent {
  @Input() labour: ContractorLabourResult[] | null = null;
  @Input() selectedIds: Set<number> | null = new Set();
  @Input() selectedCount = 0;
  @Input() allSelected = false;
  @Input() disabled = false;
  @Input() imageResolver: ((labour: ContractorLabourResult) => string | null) | null = null;

  @Output() toggleLabour = new EventEmitter<number>();
  @Output() selectAll = new EventEmitter<void>();
  @Output() clear = new EventEmitter<void>();
  @Output() bulkAction = new EventEmitter<'entry' | 'exit'>();

  trackById(_index: number, item: ContractorLabourResult) {
    return item.id;
  }

  labourImageResolver(labour: ContractorLabourResult): string | null {
    return labour?.photoUrl ?? null;
  }

  createPersonFromLabour(labour: ContractorLabourResult): PersonSearchResult {
    return {
      id: labour.id,
      personType: 'Labour' as PersonType,
      name: labour.name,
      phoneNumber: labour.phoneNumber ?? undefined,
      subtitle: undefined,
      contractorName: labour.contractorName ?? undefined,
      projectName: undefined,
      companyName: labour.companyName ?? undefined,
      purpose: undefined,
      hasOpenEntry: labour.hasOpenEntry,
      photoUrl: labour.photoUrl ?? undefined,
      barcode: labour.barcode ?? undefined
    } as PersonSearchResult;
  }
}

