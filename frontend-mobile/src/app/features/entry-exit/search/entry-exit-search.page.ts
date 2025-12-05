import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { EntryExitSearchBarComponent } from '../components/search-bar/entry-exit-search-bar.component';
import { EntryExitPersonCardComponent } from '../components/person-card/entry-exit-person-card.component';
import { EntryExitPersonResultsComponent } from '../components/person-results/entry-exit-person-results.component';
import { EntryExitContractorResultsComponent } from '../components/contractor-results/entry-exit-contractor-results.component';
import { EntryExitPhotoModalComponent } from '../components/photo-modal/entry-exit-photo-modal.component';
import { EntryExitSearchStore } from '../state/entry-exit-search.store';

@Component({
  selector: 'app-entry-exit-search-page',
  standalone: true,
  imports: [
    CommonModule,
    EntryExitSearchBarComponent,
    EntryExitPersonCardComponent,
    EntryExitPersonResultsComponent,
    EntryExitContractorResultsComponent,
    EntryExitPhotoModalComponent
  ],
  template: `
    <div class="entry-exit-page">
      <ng-container *ngIf="store.hasProject(); else noProjectState">
        <section class="entry-exit-hero card">
          <div class="hero-top">
            <div class="hero-headline">
              <div class="hero-copy">
                <h1 class="hero-title">Entry &amp; Exit</h1>
                <!-- <p class="hero-subtitle">Fast logging built for field guards on weak networks.</p> -->
              </div>
            </div>
            <span class="hero-badge" *ngIf="store.contractorMode()">Contractor batch mode</span>
          </div>

          <div class="hero-stats" *ngIf="store.loading() || store.result() || store.selectedLabourCount()">
            <div class="hero-stat" *ngIf="store.loading()">
              <span class="label">Status</span>
              <span class="value subtle">Searching…</span>
            </div>
            <div class="hero-stat" *ngIf="store.result()">
              <span class="label">Current person</span>
              <span class="value">{{ store.result()?.name }}</span>
            </div>
            <div class="hero-stat" *ngIf="store.selectedLabourCount() > 0">
              <span class="label">Selected labour</span>
              <span class="value">{{ store.selectedLabourCount() }}</span>
            </div>
          </div>

          <div class="hero-search">
            <app-entry-exit-search-bar
              [searchTerm]="store.searchTerm()"
              (searchTermChange)="store.updateSearchTerm($event)"
              (searchPerson)="store.search()"
              (searchContractor)="store.handleContractorSearch()"
              (scan)="store.scanWithCamera()"
              (registerLabour)="store.navigateToLabourRegistration()"
              (registerVisitor)="store.navigateToVisitorRegistration()"
              [disabled]="store.loading() || store.submitting()"
            />
          </div>
        </section>

        <section class="entry-exit-messages" *ngIf="store.errorMessage() || store.successMessage()">
          <div class="alert alert-error" *ngIf="store.errorMessage()">{{ store.errorMessage() }}</div>
          <div class="alert alert-success" *ngIf="store.successMessage()">{{ store.successMessage() }}</div>
        </section>

        <section class="entry-exit-content">
          <ng-container *ngIf="store.result(); else idleState">
            <div class="entry-exit-section">
              <app-entry-exit-person-card
                [person]="store.result()"
                [imageSrc]="store.resolvePersonImage(store.result())"
                [submitting]="store.submitting()"
                [showCheckbox]="false"
                [noCard]="true"
                (logEntry)="store.logEntry()"
                (logExit)="store.logExit()"
                (cancel)="store.backToResults()"
              />
            </div>
          </ng-container>

          <ng-template #idleState>
            <div class="entry-exit-placeholder card" *ngIf="store.loading()">
              <span class="placeholder-dot" aria-hidden="true"></span>
              <span>Searching…</span>
            </div>
          </ng-template>

          <div *ngIf="store.contractorMode()">
            <div class="entry-exit-section" *ngIf="(store.contractorResults()?.length ?? 0) > 0 && !store.result()">
              <div class="section-heading">
                <h2>Contractor labour</h2>
              </div>
              <app-entry-exit-contractor-results
                [labour]="store.contractorResults()"
                [selectedIds]="store.selectedLabourIds()"
                [selectedCount]="store.selectedLabourCount()"
                [allSelected]="store.allLabourSelected()"
                [disabled]="store.submitting()"
                [imageResolver]="store.labourImageResolver"
                (toggleLabour)="store.toggleLabourSelection($event)"
                (selectAll)="store.selectAllLabour()"
                (clear)="store.clearSelection()"
                (bulkAction)="store.showPhotoVerificationModal($event)"
              ></app-entry-exit-contractor-results>
            </div>

            <div class="entry-exit-placeholder card" *ngIf="store.contractorMode() && store.loading()">
              <span class="placeholder-dot" aria-hidden="true"></span>
              <span>Loading contractor results…</span>
            </div>
          </div>

          <div
            class="entry-exit-section"
            *ngIf="!store.contractorMode() && (store.decoratedResults()?.length ?? 0) > 0"
          >
            <app-entry-exit-person-results
              [results]="store.decoratedResults()"
              (select)="store.selectResult($event)"
            ></app-entry-exit-person-results>
          </div>

          @defer (when store.showPhotoVerification()) {
            <app-entry-exit-photo-modal
              [visible]="store.showPhotoVerification()"
              [labour]="store.getSelectedLabour()"
              [action]="store.pendingBulkAction()"
              [submitting]="store.submitting()"
              [imageResolver]="store.labourImageResolver"
              (cancel)="store.closePhotoVerification()"
              (confirm)="store.confirmBulkAction()"
            ></app-entry-exit-photo-modal>
          } @placeholder {
            <div class="entry-exit-placeholder card" *ngIf="store.contractorMode() && store.pendingBulkAction()">
              <span class="placeholder-dot" aria-hidden="true"></span>
              <span>Preparing verification modal…</span>
            </div>
          }
        </section>
      </ng-container>
      <ng-template #noProjectState>
        <section class="entry-exit-hero card">
          <div class="hero-top">
            <div class="hero-headline">
              <div class="hero-copy">
                <h1 class="hero-title">Entry &amp; Exit</h1>
                <p class="hero-subtitle">{{ store.noProjectMessage }}</p>
              </div>
            </div>
          </div>
        </section>
      </ng-template>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [EntryExitSearchStore]
})
export class EntryExitSearchPage {
  readonly store = inject(EntryExitSearchStore);
}
