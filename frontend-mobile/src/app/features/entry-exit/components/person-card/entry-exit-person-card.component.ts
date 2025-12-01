import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IconComponent } from '../../../../shared/icon/icon.component';
import { PersonSearchResult } from '../../entry-exit.models';

@Component({
  selector: 'app-entry-exit-person-card',
  standalone: true,
  imports: [CommonModule, IconComponent],
  template: `
    <div class="card mb-2" *ngIf="person">
      <div class="card-body">
        <div class="person-card mb-2">
          <div class="person-card-header">
            <div class="person-avatar">
              <img *ngIf="imageSrc; else placeholder" [src]="imageSrc" [alt]="person.name" />
              <ng-template #placeholder>
                <div class="avatar-placeholder" [ngClass]="person.personType === 'Labour' ? 'icon-box--success' : 'icon-box--info'">
                  <app-icon [name]="person.personType === 'Labour' ? 'user-group' : 'user'" size="28"></app-icon>
                </div>
              </ng-template>
            </div>
            <div class="person-details">
              <h3 class="person-name">{{ person.name }}</h3>
              <div class="person-meta">
                <span
                  class="meta-badge"
                  [class.badge-labour]="person.personType === 'Labour'"
                  [class.badge-visitor]="person.personType === 'Visitor'"
                >
                  {{ person.personType }}
                </span>
                <span class="meta-phone">{{ person.phoneNumber }}</span>
              </div>
            </div>
            <div class="person-status" *ngIf="person.hasOpenEntry">
              <span class="status-badge status-active">
                <app-icon name="dot" size="16" class="status-icon"></app-icon>
                Active
              </span>
            </div>
          </div>
        </div>

        <ng-container *ngIf="person.hasOpenEntry; else entryBtn">
          <button class="btn btn-exit mb-1 mx-1" (click)="logExit.emit()" [disabled]="submitting">
            <span *ngIf="submitting; else exitText">Logging Exit...</span>
            <ng-template #exitText>Log Exit</ng-template>
          </button>
        </ng-container>
        <ng-template #entryBtn>
          <button class="btn mb-1 mx-1" (click)="logEntry.emit()" [disabled]="submitting">
            <span *ngIf="submitting; else entryText">Logging Entry...</span>
            <ng-template #entryText>Log Entry</ng-template>
          </button>
        </ng-template>
        <button class="btn btn-outline" (click)="cancel.emit()">Cancel</button>
      </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EntryExitPersonCardComponent {
  @Input() person: PersonSearchResult | null = null;
  @Input() imageSrc: string | null = null;
  @Input() submitting = false;

  @Output() logEntry = new EventEmitter<void>();
  @Output() logExit = new EventEmitter<void>();
  @Output() cancel = new EventEmitter<void>();
}
