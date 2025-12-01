import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PersonSearchResult } from '../../entry-exit.models';

@Component({
  selector: 'app-entry-exit-person-results',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="card mb-2" *ngIf="results?.length">
      <div class="card-body">
        <h4 class="mb-2">Multiple matches found</h4>
        <div class="search-results-grid">
          <table class="results-table">
            <thead>
              <tr>
                <th class="type-col">Type</th>
                <th class="name-col">Name</th>
                <th class="phone-col">Phone</th>
                <th class="details-col">Details</th>
                <th class="action-col">Action</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let r of results; trackBy: trackById" class="result-row">
                <td class="cell type">
                  <div class="type-with-dot">
                    <svg *ngIf="r.hasOpenEntry" class="active-dot" width="16" height="16" viewBox="0 0 16 16" title="Active session">
                      <circle cx="8" cy="8" r="6"></circle>
                    </svg>
                    <div
                      class="type-badge"
                      [class.labour]="r.personType === 'Labour'"
                      [class.visitor]="r.personType === 'Visitor'"
                    >
                      {{ r.personType }}
                    </div>
                  </div>
                </td>
                <td class="cell name">{{ r.name }}</td>
                <td class="cell phone">{{ r.phoneNumber || '-' }}</td>
                <td class="cell details">{{ r.subtitle || '-' }}</td>
                <td class="cell action">
                  <button class="btn-select" (click)="select.emit(r)">Select</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EntryExitPersonResultsComponent {
  @Input() results: PersonSearchResult[] | null = null;
  @Output() select = new EventEmitter<PersonSearchResult>();
  trackById(_index: number, item: PersonSearchResult) {
    return item.id ?? item.name;
  }
}
