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
    <div class="entry-exit-results" *ngIf="results?.length">
      <div class="entry-exit-results__header">
        <div>
          <h4 class="entry-exit-results__title">Multiple matches found</h4>
          <p class="entry-exit-results__hint">Select the right person to continue.</p>
        </div>
        <span class="entry-exit-results__count">{{ results?.length }} total</span>
      </div>
      <div class="entry-exit-results__list" role="list">
        <app-entry-exit-person-card
          *ngFor="let r of results; trackBy: trackById"
          class="entry-exit-results__person"
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
        ></app-entry-exit-person-card>
      </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EntryExitPersonResultsComponent {
  @Input() results: PersonSearchResult[] | null = null;
  @Output() select = new EventEmitter<PersonSearchResult>();
  readonly store = inject(EntryExitSearchStore);

  onSelect(person: PersonSearchResult, event?: Event) {
    event?.preventDefault();
    this.select.emit(person);
  }

  trackById(_index: number, item: PersonSearchResult) {
    return item.id ?? item.name;
  }
}
