import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
  SimpleChanges,
  signal,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { IconComponent } from '../../../../shared/icon/icon.component';
import { ResolvePhotoDirective } from '../../../../core/directives/resolve-photo.directive';
import { LocalImageService } from '../../../../core/services/local-image.service';
import { PLACEHOLDER_DATA_URL } from '../../../../core/constants/image.constants';
import { PersonSearchResult } from '../../entry-exit.models';

@Component({
  selector: 'app-entry-exit-person-card',
  standalone: true,
  imports: [CommonModule, IconComponent, ResolvePhotoDirective],
  template: `
    <ng-container *ngIf="person">
      <ng-template #content>
        <div
          class="labour-card"
          [class.labour-card--selected]="isSelected"
          [class.labour-card--disabled]="disabled"
        >
          <div class="labour-card__photo-section">
            <ng-container *ngIf="effectiveImage(); else iconTpl">
              <div class="labour-card__avatar">
                <img [src]="effectiveImage()" [alt]="'Photo of ' + person.name" appResolvePhoto />
              </div>
            </ng-container>
            <ng-template #iconTpl>
              <div
                class="labour-card__status"
                [ngClass]="
                  person.hasOpenEntry
                    ? 'labour-card__status--active'
                    : 'labour-card__status--inactive'
                "
                aria-hidden="true"
              >
                <app-icon
                  [name]="person.personType === 'Labour' ? 'user-group' : 'user'"
                  size="20"
                ></app-icon>
              </div>
            </ng-template>

            <span
              class="type-badge"
              [class.labour]="person.personType === 'Labour'"
              [class.visitor]="person.personType === 'Visitor'"
            >
              {{ person.personType }}
            </span>
          </div>

          <div class="labour-card__details">
            <div class="labour-card__heading">
              <span class="labour-card__name">{{ person.name }}</span>
              <span
                class="labour-card__state"
                [class.labour-card__state--active]="person.hasOpenEntry"
              >
                <app-icon name="record-circle" size="18"></app-icon>
                <span>{{ person.hasOpenEntry ? 'Active' : 'Offline' }}</span>
              </span>
            </div>

            <div class="labour-card__meta">
              <span class="labour-card__meta-item">
                <app-icon name="phone" size="14"></app-icon>
                <span>{{ person.phoneNumber || 'No phone' }}</span>
              </span>
              <span class="labour-card__meta-item">
                <app-icon name="id-card" size="14"></app-icon>
                <span>{{ person.barcode || 'No ID' }}</span>
              </span>
              <span class="labour-card__meta-item" *ngIf="person.contractorName">
                <app-icon name="briefcase" size="14"></app-icon>
                <span>{{ person.contractorName }}</span>
              </span>
              <span class="labour-card__meta-item" *ngIf="person.companyName">
                <app-icon name="building" size="14"></app-icon>
                <span>{{ person.companyName }}</span>
              </span>
            </div>
          </div>

          <div class="labour-card__checkbox" aria-hidden="true" *ngIf="showCheckbox">
            <ng-container *ngIf="isSelected; else emptyBoxIcon">
              <app-icon name="check-square" size="18"></app-icon>
            </ng-container>
            <ng-template #emptyBoxIcon>
              <app-icon name="square" size="18"></app-icon>
            </ng-template>
          </div>
        </div>

        <div class="labour-card__actions" *ngIf="showActions">
          <ng-container *ngIf="person.hasOpenEntry; else entryBtn">
            <button
              class="btn btn-exit"
              type="button"
              (click)="logExit.emit()"
              [disabled]="submitting"
            >
              <span *ngIf="submitting; else exitText">Logging Exit...</span>
              <ng-template #exitText>Log Exit</ng-template>
            </button>
          </ng-container>
          <ng-template #entryBtn>
            <button class="btn" type="button" (click)="logEntry.emit()" [disabled]="submitting">
              <span *ngIf="submitting; else entryText">Logging Entry...</span>
              <ng-template #entryText>Log Entry</ng-template>
            </button>
          </ng-template>
          <button class="btn btn-outline" type="button" (click)="cancel.emit()">Cancel</button>
        </div>
      </ng-template>

      <ng-container *ngIf="noCard; else outerCard">
        <ng-container *ngTemplateOutlet="content"></ng-container>
      </ng-container>
      <ng-template #outerCard>
        <div class="card mb-2">
          <div class="card-body">
            <ng-container *ngTemplateOutlet="content"></ng-container>
          </div>
        </div>
      </ng-template>
    </ng-container>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EntryExitPersonCardComponent {
  @Input() person: PersonSearchResult | null = null;
  @Input() imageSrc: string | null = null;
  @Input() submitting = false;
  @Input() showCheckbox = false;
  @Input() isSelected = false;
  @Input() showActions = true;
  @Input() noCard = false;
  @Input() disabled = false;

  // internal resolved image src (may be placeholder until resolved)
  effectiveImage = signal<string | null>(null);
  private readonly localImage = inject(LocalImageService);
  private readonly placeholder = PLACEHOLDER_DATA_URL;

  @Output() logEntry = new EventEmitter<void>();
  @Output() logExit = new EventEmitter<void>();
  @Output() cancel = new EventEmitter<void>();

  ngOnChanges(changes: SimpleChanges) {
    if (changes['imageSrc'] || changes['person']) {
      this.resolveEffectiveImage();
    }
  }

  private async resolveEffectiveImage() {
    const src = (this.imageSrc || this.person?.photoUrl || '')?.trim();
    if (!src) {
      this.effectiveImage.set(null);
      return;
    }

    // If it's already a data URL or blob/object url or absolute external URL, use as-is
    if (/^data:/i.test(src) || src.startsWith('blob:') || /^https?:\/\//i.test(src)) {
      // But avoid binding full-app `/api/entryexit/photos/...` absolute URL directly — prefer resolver
      if (/\/api\/(?:entryexit\/)?photos\//i.test(src) && /^https?:\/\//i.test(src)) {
        try {
          const resolved = await this.localImage.resolveImage(src);
          this.effectiveImage.set(resolved || src);
          return;
        } catch {
          this.effectiveImage.set(src);
          return;
        }
      }

      this.effectiveImage.set(src);
      return;
    }

    // For relative or api paths, try to resolve via LocalImageService which will call ApiService.getPhotoBlob
    try {
      const resolved = await this.localImage.resolveImage(src);
      this.effectiveImage.set(resolved || this.placeholder);
    } catch (e) {
      this.effectiveImage.set(this.placeholder);
    }
  }
}
