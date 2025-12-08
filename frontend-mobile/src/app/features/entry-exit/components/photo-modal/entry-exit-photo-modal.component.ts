import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, inject, ChangeDetectorRef, OnChanges, SimpleChanges, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IconComponent } from '../../../../shared/icon/icon.component';
import { ResolvePhotoDirective } from '../../../../core/directives/resolve-photo.directive';
import { ContractorLabourResult } from '../../entry-exit.models';
import { OfflineStorageService } from '../../../../core/services/offline-storage.service';
import { LocalImageService } from '../../../../core/services/local-image.service';
import { ImageCacheService } from '../../../../core/services/image-cache.service';
import { PLACEHOLDER_DATA_URL } from '../../../../core/constants/image.constants';

type CachedImage = { kind: 'data' | 'local' | 'blob' | 'remote' | 'placeholder'; url: string | null };

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

  // cache of resolved image info per labour id/key
  // value describes the kind of image and a stable url for binding
  resolvedImages: Record<string, CachedImage | null> = {};

  private imageCache = inject(ImageCacheService);
  // owner id for this modal instance to manage cache ownership
  private ownerId = `modal:${Math.random().toString(36).slice(2)}`;

  async onConfirm() {
    this.submitting = true;
    try {
      if (this.labour && this.labour.length) {
        for (const item of this.labour) {
          const key = item.id || item.barcode || `${Math.random()}`;
          const cached = this.resolvedImages[key];
          if (!cached || !cached.url) {
            // attempt to ensure cached and saved
            const original = this.imageResolver ? this.imageResolver(item) : null;
            if (!original) continue;
            try {
              const stable = await this.imageCache.ensureCached(original);
              if (stable) {
                this.resolvedImages[key] = { kind: original.startsWith('data:') ? 'data' : original.startsWith('blob:') ? 'blob' : original.startsWith('dexie:') || original.startsWith('file:') || original.startsWith('/') ? 'local' : 'remote', url: stable };
              }
            } catch (e) {
              // ignore
            }
            continue;
          }

          if (cached.kind === 'data' && cached.url) {
            const blob = await (await fetch(cached.url)).blob();
            await this.offline.savePhoto(blob, `${item.id || item.barcode || 'photo'}.jpg`, { labourId: item.id, action: this.action });
          } else if (cached.url) {
            try {
              const fetched = await fetch(cached.url);
              if (fetched.ok) {
                const blob = await fetched.blob();
                await this.offline.savePhoto(blob, `${item.id || item.barcode || 'photo'}.jpg`, { labourId: item.id, action: this.action });
              }
            } catch (e) {
              // ignore
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
      const v = this.resolvedImages[key];
      return v?.url || null;
    }
    const orig = this.imageResolver ? this.imageResolver(labour) : null;
    // attempt to return a cached synchronous value if possible
    const cached = this.imageCache.getCached(orig || null);
    return cached;
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
    // remove ownership for all resolved images
    for (const k of Object.keys(this.resolvedImages || {})) {
      const v = this.resolvedImages[k];
      if (v && v.url) {
        try { this.imageCache.removeOwnerForOriginal(v.url, this.ownerId); } catch {};
      }
    }
  }

  private async prepareImages() {
    // Remove ownership from previous entries
    try {
      for (const k of Object.keys(this.resolvedImages || {})) {
        const v = this.resolvedImages[k];
        if (v && v.url) {
          try { this.imageCache.removeOwnerForOriginal(v.url, this.ownerId); } catch {};
        }
      }
    } catch {}
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
        if (original === PLACEHOLDER_DATA_URL) {
          this.resolvedImages[key] = { kind: 'placeholder', url: null };
          this.cdr.markForCheck();
          continue;
        }

        // synchronous quick check — return data/blob/local paths immediately
        const quick = this.imageCache.getCached(original);
        if (quick) {
          const kind = original.startsWith('data:') ? 'data' : original.startsWith('blob:') ? 'blob' : original.startsWith('dexie:') || original.startsWith('file:') || original.startsWith('/') ? 'local' : 'remote';
          this.resolvedImages[key] = { kind, url: quick };
          try { this.imageCache.addOwnerForOriginal(quick, this.ownerId); } catch {}
          this.cdr.markForCheck();
          // still attempt to ensure cache for remote resources
          if (kind === 'remote') {
            this.imageCache.ensureCached(original).then((stable) => {
              if (stable) {
                this.resolvedImages[key] = { kind: 'remote', url: stable };
                this.cdr.markForCheck();
              }
            }).catch(()=>{});
          }
          continue;
        }

        // Not cached — ensure cached which will fetch and create an object URL if needed
        const stable = await this.imageCache.ensureCached(original);
        if (stable) {
          const kind = original.startsWith('data:') ? 'data' : original.startsWith('blob:') ? 'blob' : original.startsWith('dexie:') || original.startsWith('file:') || original.startsWith('/') ? 'local' : 'remote';
          this.resolvedImages[key] = { kind, url: stable };
          try { this.imageCache.addOwnerForOriginal(stable, this.ownerId); } catch {}
          this.cdr.markForCheck();
        } else {
          this.resolvedImages[key] = null;
          this.cdr.markForCheck();
        }
      } catch (e) {
        this.resolvedImages[key] = null;
        this.cdr.markForCheck();
      }
    }
  }
}
