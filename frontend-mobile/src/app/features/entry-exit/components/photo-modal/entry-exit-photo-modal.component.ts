import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, inject, ChangeDetectorRef, OnChanges, SimpleChanges, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IconComponent } from '../../../../shared/icon/icon.component';
import { ResolvePhotoDirective } from '../../../../core/directives/resolve-photo.directive';
import { ContractorLabourResult } from '../../entry-exit.models';
import { OfflineStorageService } from '../../../../core/services/offline-storage.service';
import { LocalImageService } from '../../../../core/services/local-image.service';

@Component({
  selector: 'app-entry-exit-photo-modal',
  standalone: true,
  imports: [CommonModule, IconComponent, ResolvePhotoDirective],
  host: {},
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
                  <img [src]="src" [alt]="item.name" appResolvePhoto />
                </ng-container>
                <ng-template #placeholder>
                  <div class="photo-placeholder-large" aria-hidden="true">
                    <app-icon name="user-group" size="48"></app-icon>
                  </div>
                </ng-template>
              </div>
              <div class="text-center">
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
            (click)="onConfirm()"
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
export class EntryExitPhotoModalComponent implements OnChanges, OnDestroy {
  @Input() visible = false;
  @Input() labour: ContractorLabourResult[] | null = null;
  @Input() action: 'entry' | 'exit' | null = null;
  @Input() submitting = false;
  @Input() imageResolver: (labour: ContractorLabourResult) => string | null = () => null;

  @Output() confirm = new EventEmitter<void>();
  @Output() cancel = new EventEmitter<void>();

  private offline = inject(OfflineStorageService);
  private localImage = inject(LocalImageService);
  private cdr = inject(ChangeDetectorRef);

  // cache of resolved image src per labour id/key
  resolvedImages: Record<string, string | null> = {};

  async onConfirm() {
    this.submitting = true;
    try {
      if (this.labour && this.labour.length) {
        for (const item of this.labour) {
          const key = item.id || item.barcode || `${Math.random()}`;
          const cached = this.resolvedImages[key];
          // If cached is a data URL or local path already, assume it is saved by LocalImageService
          if (!cached) {
            // fallback: try to resolve and save now
            const original = this.imageResolver ? this.imageResolver(item) : null;
            if (!original) continue;
            try {
              const saved = await this.localImage.resolveImage(original, `${item.id || item.barcode || 'photo'}.jpg`);
              // ensure we have the saved value in cache
              this.resolvedImages[key] = saved;
            } catch (e) {
              // ignore
            }
            continue;
          }

          if (typeof cached === 'string' && cached.startsWith('data:')) {
            const blob = await (await fetch(cached)).blob();
            await this.offline.savePhoto(blob, `${item.id || item.barcode || 'photo'}.jpg`, { labourId: item.id, action: this.action });
          } else if (typeof cached === 'string') {
            // For file paths or remote urls, attempt to fetch then store as blob
            try {
              const fetched = await fetch(cached);
              if (fetched.ok) {
                const blob = await fetched.blob();
                await this.offline.savePhoto(blob, `${item.id || item.barcode || 'photo'}.jpg`, { labourId: item.id, action: this.action });
              }
            } catch (e) {
              // ignore fetch failures for now
            }
          }
        }
      }

      // emit so parent can proceed with server call if desired
      this.confirm.emit();
    } finally {
      this.submitting = false;
    }
  }

  resolveImage(labour: ContractorLabourResult): string | null {
    const key = labour.id || labour.barcode || null;
    if (key && this.resolvedImages.hasOwnProperty(key)) {
      return this.resolvedImages[key] || null;
    }
    return this.imageResolver ? this.imageResolver(labour) : null;
  }

  trackById(_index: number, item: ContractorLabourResult) {
    return item.id;
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['labour']) {
      this.prepareImages();
    }
    if (changes['visible']) {
      const cur = !!changes['visible'].currentValue;
      try {
        if (cur) {
          document.body.classList.add('modal-open');
        } else {
          document.body.classList.remove('modal-open');
        }
      } catch (e) {
        // ignore (server-side rendering or restricted env)
      }
    }
  }

  ngOnDestroy(): void {
    try {
      document.body.classList.remove('modal-open');
    } catch (e) {
      // ignore
    }
  }

  private async prepareImages() {
    this.resolvedImages = {};
    if (!this.labour || !this.labour.length) return;
    for (let i = 0; i < this.labour.length; i++) {
      const item: ContractorLabourResult = this.labour[i];
      const key = item.id || item.barcode || `${i}`;
      try {
        const original = this.imageResolver ? this.imageResolver(item) : null;
        if (!original) {
          this.resolvedImages[key] = null;
          this.cdr.markForCheck();
          continue;
        }
        const resolved = await this.localImage.resolveImage(original, `${item.id || item.barcode || 'photo'}.jpg`);
        this.resolvedImages[key] = resolved;
        this.cdr.markForCheck();
      } catch (e) {
        this.resolvedImages[key] = null;
        this.cdr.markForCheck();
      }
    }
  }
}
