import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IconComponent } from '../../../../shared/icon/icon.component';
import { ContractorLabourResult } from '../../entry-exit.models';

@Component({
  selector: 'app-entry-exit-photo-modal',
  standalone: true,
  imports: [CommonModule, IconComponent],
  template: `
    <div class="photo-verification-modal" *ngIf="visible">
      <div class="modal-overlay" (click)="cancel.emit()"></div>
      <div class="modal-content">
        <div class="modal-header">
          <h3>Verify Photos Before {{ action === 'entry' ? 'Check-In' : 'Check-Out' }}</h3>
          <button
            class="btn-close"
            type="button"
            (click)="cancel.emit()"
            aria-label="Close photo verification dialog"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <div class="modal-body">
          <p class="mb-2"><strong>{{ labour?.length || 0 }} labour selected - Please verify photos:</strong></p>
          <div class="photo-grid">
            <div *ngFor="let item of labour; trackBy: trackById" class="photo-card">
              <div class="photo-frame">
                <ng-container *ngIf="resolveImage(item) as src; else placeholder">
                  <img [src]="src" [alt]="item.name" />
                </ng-container>
                <ng-template #placeholder>
                  <div class="photo-placeholder-large" aria-hidden="true">
                    <app-icon name="user-group" size="48"></app-icon>
                  </div>
                </ng-template>
              </div>
              <div class="photo-info">
                <p class="photo-name">{{ item.name }}</p>
                <p class="photo-details">{{ item.phoneNumber || '-' }}</p>
                <p class="photo-details" *ngIf="item.barcode">{{ item.barcode }}</p>
                <span *ngIf="item.hasOpenEntry" class="badge-active">● Active</span>
                <span *ngIf="!item.hasOpenEntry" class="badge-inactive">○ Inactive</span>
              </div>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-outline" (click)="cancel.emit()">Cancel</button>
          <button
            class="btn"
            [class.btn-exit]="action === 'exit'"
            type="button"
            (click)="confirm.emit()"
            [disabled]="submitting"
          >
            <span *ngIf="submitting">Processing...</span>
            <ng-container *ngIf="!submitting">
              <ng-container *ngIf="action !== 'exit'; else exitIcon">
                <app-icon name="check" size="18"></app-icon>
              </ng-container>
              <ng-template #exitIcon>
                <app-icon name="close" size="18"></app-icon>
              </ng-template>
              <span>{{ action === 'exit' ? 'Confirm Check-Out' : 'Confirm Check-In' }}</span>
            </ng-container>
          </button>
        </div>
      </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EntryExitPhotoModalComponent {
  @Input() visible = false;
  @Input() labour: ContractorLabourResult[] | null = null;
  @Input() action: 'entry' | 'exit' | null = null;
  @Input() submitting = false;
  @Input() imageResolver: (labour: ContractorLabourResult) => string | null = () => null;

  @Output() confirm = new EventEmitter<void>();
  @Output() cancel = new EventEmitter<void>();

  resolveImage(labour: ContractorLabourResult): string | null {
    return this.imageResolver ? this.imageResolver(labour) : null;
  }

  trackById(_index: number, item: ContractorLabourResult) {
    return item.id;
  }
}
