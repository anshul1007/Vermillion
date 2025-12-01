import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PersonSearchResult } from '../../entry-exit.models';

@Component({
  selector: 'app-entry-exit-person-card',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="card mb-2" *ngIf="person">
      <div class="card-body">
        <div class="person-card mb-2">
          <div class="person-card-header">
            <div class="person-avatar">
              <img *ngIf="imageSrc; else placeholder" [src]="imageSrc" [alt]="person.name" />
              <ng-template #placeholder>
                <div class="avatar-placeholder" [ngClass]="person.personType === 'Labour' ? 'icon-box--success' : 'icon-box--info'">
                  <svg *ngIf="person.personType === 'Labour'; else visitorIcon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                  <ng-template #visitorIcon>
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                      <circle cx="12" cy="7" r="4" />
                    </svg>
                  </ng-template>
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
                <svg class="status-icon" width="12" height="12" viewBox="0 0 12 12">
                  <circle cx="6" cy="6" r="5"></circle>
                </svg>
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
