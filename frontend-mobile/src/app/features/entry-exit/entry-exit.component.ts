import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { EntryExitSearchBarComponent } from './components/search-bar/entry-exit-search-bar.component';
import { EntryExitPersonCardComponent } from './components/person-card/entry-exit-person-card.component';
import { EntryExitPersonResultsComponent } from './components/person-results/entry-exit-person-results.component';
import { EntryExitContractorResultsComponent } from './components/contractor-results/entry-exit-contractor-results.component';
import { EntryExitPhotoModalComponent } from './components/photo-modal/entry-exit-photo-modal.component';
import { EntryExitSearchStore } from './state/entry-exit-search.store';
import { projectStore } from '../../core/state/project.store';
import { AuthService } from '../../core/auth/auth.service';

@Component({
  selector: 'app-entry-exit-component',
  standalone: true,
  imports: [
    CommonModule,
    EntryExitSearchBarComponent,
    EntryExitPersonCardComponent,
    EntryExitPersonResultsComponent,
    EntryExitContractorResultsComponent,
    EntryExitPhotoModalComponent,
  ],
  template: `
    <div class="page">
      <ng-container *ngIf="store.hasProject(); else noProjectState">
        <section class="hero card">
          <div class="d-flex items-start justify-between gap-2 flex-wrap">
            <div class="flex-1 min-w-0">
              <h1 class="page-title mb-0">Entry & Exit</h1>
            </div>
            <span class="hero-badge flex-shrink-0" *ngIf="store.contractorMode()"
              >Contractor Search</span
            >
          </div>
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
        </section>

        <section class="messages" *ngIf="store.errorMessage() || store.successMessage()">
          <div class="alert alert-error" *ngIf="store.errorMessage()">
            {{ store.errorMessage() }}
          </div>
          <div class="alert alert-success" *ngIf="store.successMessage()">
            {{ store.successMessage() }}
          </div>
        </section>

        <section class="content">
          <ng-container *ngIf="store.result(); else idleState">
            <div class="section">
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
            <div class="placeholder card" *ngIf="store.loading()">
              <span class="placeholder-dot" aria-hidden="true"></span>
              <span>Searching…</span>
            </div>
          </ng-template>

          <div *ngIf="store.contractorMode()">
            <div
              class="card"
              *ngIf="(store.contractorResults()?.length ?? 0) > 0 && !store.result()"
            >
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

            <div class="placeholder card" *ngIf="store.contractorMode() && store.loading()">
              <span class="placeholder-dot" aria-hidden="true"></span>
              <span>Loading contractor results…</span>
            </div>
          </div>

          <div
            class="card"
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
          <div class="placeholder card" *ngIf="store.contractorMode() && store.pendingBulkAction()">
            <span class="placeholder-dot" aria-hidden="true"></span>
            <span>Preparing verification modal…</span>
          </div>
          }
        </section>
      </ng-container>
      <ng-template #noProjectState>
        <section class="hero card">
          <div class="d-flex flex-column gap-1">
            <h1 class="page-title mb-0">Entry &amp; Exit</h1>
            <p class="page-subtitle mb-0">{{ store.noProjectMessage }}</p>
          </div>
        </section>
      </ng-template>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [EntryExitSearchStore],
})
export class EntryExitComponent {
  readonly store = inject(EntryExitSearchStore);
  private authService = inject(AuthService);

  guardProfile = this.authService.guardProfile;

  currentProjectName = signal<string>(
    projectStore.projectName() ?? this.guardProfile()?.projectName ?? ''
  );
}
