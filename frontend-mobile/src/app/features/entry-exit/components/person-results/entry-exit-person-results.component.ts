import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
// IconComponent removed; person-results now uses unified person card
import { EntryExitPersonCardComponent } from '../person-card/entry-exit-person-card.component';
import { PersonSearchResult } from '../../entry-exit.models';
import { EntryExitSearchStore } from '../../state/entry-exit-search.store';

@Component({
  selector: 'app-entry-exit-person-results',
  standalone: true,
  imports: [CommonModule, EntryExitPersonCardComponent],
  template: `
    <ng-container *ngIf="results?.length">
      <div class="records__header">
        <div>
          <h4 class="labour-results-title">Multiple matches found</h4>
          <p class="labour-results-subtitle">Select the right person to continue.</p>
        </div>
        <span class="records__count">{{ results?.length }} total</span>
      </div>
      <div class="labour-list" role="list">
        <app-entry-exit-person-card
          *ngFor="let r of results; trackBy: trackById"
          [person]="r"
          [imageSrc]="store.resolvePersonImage(r)"
          [showCheckbox]="false"
          [showActions]="false"
          [noCard]="true"
          [attr.role]="'listitem'"
          [attr.tabindex]="0"
          (click)="onSelect(r, $event)"
          (keydown.enter)="onSelect(r, $event)"
          (keydown.space)="onSelect(r, $event)"
          (viewPhoto)="onViewPhoto(r)"
        ></app-entry-exit-person-card>
      </div>
    </ng-container>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EntryExitPersonResultsComponent {
  @Input() results: PersonSearchResult[] | null = null;
  @Output() select = new EventEmitter<PersonSearchResult>();
  @Output() viewPhoto = new EventEmitter<PersonSearchResult>();
  readonly store = inject(EntryExitSearchStore);

  onSelect(person: PersonSearchResult, event?: Event) {
    event?.preventDefault();
    this.select.emit(person);
  }

  onViewPhoto(person: PersonSearchResult) {
    this.viewPhoto.emit(person);
  }

  trackById(_index: number, item: PersonSearchResult) {
    return item.id ?? item.name;
  }
}
