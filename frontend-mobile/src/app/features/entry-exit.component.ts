import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { BarcodeService } from '../core/services/barcode.service';
import { ApiService } from '../core/services/api.service';
import { AuthService } from '../core/auth/auth.service';

@Component({
  selector: 'app-entry-exit',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="container">
      <div class="row mb-2">
        <div class="col-12">
          <div class="row align-center">
            <h1 class="mb-0">Entry/Exit Recording</h1>
          </div>
        </div>
      </div>

      <div class="row">
        <div class="col-12">
          <div class="card mb-2">
            <div class="card-body">
              <!-- Shared Search Input with separate action buttons -->
              <div class="mb-2">
                <div class="search-row">
                  <input
                    [(ngModel)]="searchTerm"
                    placeholder="Search by name, phone or contractor"
                    (keyup.enter)="search()"
                    class="search-input"
                  />
                  <button class="btn" (click)="search()">🔍 Search Person</button>
                  <button class="btn btn-outline" (click)="contractorSearchTerm = searchTerm; searchContractor()">🏢 Search Contractor</button>
                </div>
                <div class="search-actions-row">
                  <button class="btn btn-outline mb-1 mx-1" (click)="scan()">📷 Scan Barcode</button>
                  <button class="btn btn-outline mb-1 mx-1" (click)="openLabourRegistration()">
                    👷 Register Labour
                  </button>
                  <button class="btn btn-outline mb-1 mx-1" (click)="openVisitorRegistration()">
                    🧾 Register Visitor
                  </button>
                </div>
              </div>

              <!-- Note: single shared search input above controls both person and contractor searches.
                   Results will populate the appropriate grid below (contractorResults OR results). -->
            </div>
          </div>
        </div>
      </div>

      <div class="row" *ngIf="errorMessage()">
        <div class="col-12">
          <div class="text-danger mb-2">{{ errorMessage() }}</div>
        </div>
      </div>

      <div class="row" *ngIf="successMessage()">
        <div class="col-12">
          <div class="text-success mb-2">{{ successMessage() }}</div>
        </div>
      </div>

      <ng-container *ngIf="result(); else noResult">
        <div class="row">
          <div class="col-12">
            <div class="card mb-2">
              <div class="card-body">
                <div class="person-card mb-2">
                  <div class="person-card-header">
                    <div class="person-avatar">
                      <img
                        *ngIf="result()!.photoUrl"
                        [src]="getPhotoDataUrl(result()!.photoUrl)"
                        [alt]="result()!.name"
                      />
                      <div *ngIf="!result()!.photoUrl" class="avatar-placeholder">
                        {{ result()!.personType === 'Labour' ? '👷' : '👤' }}
                      </div>
                    </div>
                    <div class="person-details">
                      <h3 class="person-name">{{ result()!.name }}</h3>
                      <div class="person-meta">
                        <span class="meta-badge" [class.badge-labour]="result()!.personType === 'Labour'" [class.badge-visitor]="result()!.personType === 'Visitor'">
                          {{ result()!.personType }}
                        </span>
                        <span class="meta-phone">{{ result()!.phoneNumber }}</span>
                      </div>
                    </div>
                    <div class="person-status" *ngIf="result()!.hasOpenEntry">
                      <span class="status-badge status-active">
                        <svg class="status-icon" width="12" height="12" viewBox="0 0 12 12">
                          <circle cx="6" cy="6" r="5"></circle>
                        </svg>
                        Active
                      </span>
                    </div>
                  </div>
                </div>

                <ng-container *ngIf="result()!.hasOpenEntry; else entryBtn">
                  <button class="btn btn-exit mb-1 mx-1" (click)="logExit()" [disabled]="submitting()">
                    <span *ngIf="submitting(); else exitText">Logging Exit...</span>
                    <ng-template #exitText>Log Exit</ng-template>
                  </button>
                </ng-container>
                <ng-template #entryBtn>
                  <button class="btn mb-1 mx-1" (click)="logEntry()" [disabled]="submitting()">
                    <span *ngIf="submitting(); else entryText">Logging Entry...</span>
                    <ng-template #entryText>Log Entry</ng-template>
                  </button>
                </ng-template>
                <button class="btn btn-outline" (click)="backToResults()">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      </ng-container>
      <!-- Contractor Results Grid (Multi-select) -->
      <div class="row" *ngIf="contractorMode() && contractorResults() && contractorResults()!.length">
        <div class="col-12">
          <div class="card mb-2">
            <div class="card-body">
              <div class="mb-2 space-between-row">
                <h4 class="mb-0">Found {{ contractorResults()!.length }} labour</h4>
                <div>
                  <button class="btn btn-sm btn-outline" (click)="selectAllLabour()">
                    {{ isAllSelected() ? '☑️' : '☐' }} Select All
                  </button>
                </div>
              </div>
              
              <div class="search-results-grid">
                <table class="results-table">
                  <thead>
                    <tr>
                      <th class="select-col">Select</th>
                      <th class="status-col">Status</th>
                      <th class="name-col">Name</th>
                      <th class="phone-col">Phone</th>
                      <th class="barcode-col">Barcode</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr *ngFor="let r of contractorResults()" class="result-row">
                      <td class="cell select-cell">
                        <input 
                          type="checkbox" 
                          [checked]="isLabourSelected(r.id)"
                          (change)="toggleLabourSelection(r.id)"
                          class="select-checkbox"
                        />
                      </td>
                      <td class="cell status-cell">
                        <svg *ngIf="r.hasOpenEntry" class="active-dot" width="16" height="16" viewBox="0 0 16 16" title="Active session">
                          <circle cx="8" cy="8" r="6"></circle>
                        </svg>
                        <span *ngIf="!r.hasOpenEntry" class="inactive-dot">○</span>
                      </td>
                      <td class="cell name">{{ r.name }}</td>
                      <td class="cell phone">{{ r.phoneNumber || '-' }}</td>
                      <td class="cell">{{ r.barcode || '-' }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div class="mt-2" *ngIf="selectedLabourIds().size > 0">
                <p class="mb-1"><strong>{{ selectedLabourIds().size }} labour selected</strong></p>
                <button class="btn mb-1 mx-1" (click)="showPhotoVerificationModal('entry')" [disabled]="submitting()">
                  ✅ Bulk Check-In
                </button>
                <button class="btn btn-exit mb-1 mx-1" (click)="showPhotoVerificationModal('exit')" [disabled]="submitting()">
                  ❌ Bulk Check-Out
                </button>
                <button class="btn btn-outline" (click)="clearSelection()">Clear Selection</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Person Results Grid (Single select) -->
      <div class="row" *ngIf="!contractorMode() && results() && results()!.length">
        <div class="col-12">
          <div class="card mb-2">
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
                    <tr *ngFor="let r of results()" class="result-row">
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
                      <td class="cell details">{{ subtitleFor(r) || '-' }}</td>
                      <td class="cell action">
                        <button class="btn-select" (click)="selectResult(r)">Select</button>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>      <ng-template #noResult>
        <div class="row" *ngIf="loading()">
          <div class="col-12">
            <div class="card">
              <div class="card-body">
                <p class="text-muted mb-0">Searching...</p>
              </div>
            </div>
          </div>
        </div>
      </ng-template>

      <!-- Photo Verification Modal -->
      <div class="photo-verification-modal" *ngIf="showPhotoVerification()">
        <div class="modal-overlay" (click)="closePhotoVerification()"></div>
        <div class="modal-content">
          <div class="modal-header">
            <h3>Verify Photos Before {{ pendingBulkAction === 'entry' ? 'Check-In' : 'Check-Out' }}</h3>
            <button class="btn-close" (click)="closePhotoVerification()">✕</button>
          </div>
          <div class="modal-body">
            <p class="mb-2"><strong>{{ selectedLabourIds().size }} labour selected - Please verify photos:</strong></p>
            <div class="photo-grid">
              <div *ngFor="let labour of getSelectedLabour()" class="photo-card">
                <div class="photo-frame">
                  <img 
                    *ngIf="labour.photoUrl" 
                    [src]="getPhotoDataUrl(labour.photoUrl)" 
                    [alt]="labour.name"
                  />
                  <div *ngIf="!labour.photoUrl" class="photo-placeholder-large">
                    👷
                  </div>
                </div>
                <div class="photo-info">
                  <p class="photo-name">{{ labour.name }}</p>
                  <p class="photo-details">{{ labour.phoneNumber }}</p>
                  <p class="photo-details" *ngIf="labour.barcode">{{ labour.barcode }}</p>
                  <span *ngIf="labour.hasOpenEntry" class="badge-active">● Active</span>
                  <span *ngIf="!labour.hasOpenEntry" class="badge-inactive">○ Inactive</span>
                </div>
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-outline" (click)="closePhotoVerification()">Cancel</button>
            <button 
              class="btn" 
              [class.btn-exit]="pendingBulkAction === 'exit'"
              (click)="confirmBulkAction()" 
              [disabled]="submitting()">
              <span *ngIf="submitting()">Processing...</span>
              <span *ngIf="!submitting()">
                {{ pendingBulkAction === 'entry' ? '✅ Confirm Check-In' : '❌ Confirm Check-Out' }}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  `
})
export class EntryExitComponent {
  private api = inject(ApiService);
  private barcodeSvc = inject(BarcodeService);
  private authService = inject(AuthService);
  private router = inject(Router);

  guardProfile = this.authService.guardProfile;
  searchTerm = '';
  result = signal<any>(null);
  results = signal<any[] | null>(null);
  previousResults = signal<any[] | null>(null);
  errorMessage = signal('');
  successMessage = signal('');
  loading = signal(false);
  submitting = signal(false);
  
  // Contractor mode
  contractorMode = signal(false);
  contractorSearchTerm = '';
  contractorResults = signal<any[] | null>(null);
  selectedLabourIds = signal<Set<number>>(new Set());
  showPhotoVerification = signal(false);
  pendingBulkAction: 'entry' | 'exit' | null = null;

  async scan(): Promise<void> {
    try {
      this.errorMessage.set('');
      const barcode = await this.barcodeSvc.scanBarcodeWithCamera();
      this.searchByBarcode(barcode);
    } catch (err) {
      this.errorMessage.set('Barcode scan failed or cancelled');
    }
  }

  search(): void {
    // Clear any focused result or cached previous results when starting a new search
    this.result.set(null);
    this.results.set(null);
    this.previousResults.set(null);
    this.errorMessage.set('');
    this.successMessage.set('');

    // Ensure we show person results (hide contractor grid)
    this.contractorMode.set(false);
    this.contractorResults.set(null);

    if (!this.searchTerm.trim()) {
      this.errorMessage.set('Please enter search term');
      return;
    }

    this.loading.set(true);
    this.errorMessage.set('');

    this.api.search(this.searchTerm).subscribe({
      next: (res: any) => {
        this.loading.set(false);
        const d = res?.data;
        if (!d) {
          this.errorMessage.set('No person found with that search term');
          return;
        }

        if (Array.isArray(d)) {
          if (d.length === 0) {
            this.errorMessage.set('No person found with that search term');
            return;
          }

          // If multiple matches, show a selectable list
          if (d.length > 1) {
            this.results.set(d);
            // Save current results so we can restore them when user hits Cancel
            this.previousResults.set(this.results());
            return;
          }

          this.result.set(d[0]);
          this.results.set(null);
        } else {
          this.result.set(d);
          this.results.set(null);
        }
      },
      error: () => {
        this.loading.set(false);
        this.errorMessage.set('Search failed. Person not found.');
      },
    });
  }

  searchByBarcode(barcode: string): void {
    // Clear any focused result or cached previous results when starting a new barcode search
    this.result.set(null);
    this.results.set(null);
    this.previousResults.set(null);
    this.errorMessage.set('');
    this.successMessage.set('');

    // Barcode search targets person search UI
    this.contractorMode.set(false);
    this.contractorResults.set(null);

    this.loading.set(true);

    this.api.search(barcode).subscribe({
      next: (res: any) => {
        this.loading.set(false);
        const d = res?.data;
        if (!d) {
          this.errorMessage.set('No person found with that barcode');
          return;
        }

        if (Array.isArray(d)) {
          if (d.length === 0) {
            this.errorMessage.set('No person found with that barcode');
            return;
          }

          if (d.length > 1) {
            this.results.set(d);
            this.result.set(null);
            return;
          }

          this.result.set(d[0]);
          this.results.set(null);
        } else {
          this.result.set(d);
          this.results.set(null);
        }
      },
      error: () => {
        this.loading.set(false);
        this.errorMessage.set('Search failed. Person not found.');
      },
    });
  }

  logEntry(): void {
    const r = this.result();
    const profile = this.guardProfile();

    if (!r || !profile) return;

    this.submitting.set(true);
    this.errorMessage.set('');
    this.successMessage.set('');

    const data: any = {
      personType: r?.personType === 'Visitor' ? 2 : 1,
      action: 1,
    };

    if (r?.personType === 'Labour' || !r?.personType) {
      data.labourId = r?.id;
    } else {
      data.visitorId = r?.id;
    }

    console.log('Creating entry record with data:', data);
    console.log('Result object:', r);

    this.api.createRecord(data).subscribe({
      next: (response) => {
        this.submitting.set(false);
        if (response.success) {
          this.successMessage.set('Entry logged successfully!');
          setTimeout(() => {
            this.clearResult();
            this.successMessage.set('');
          }, 2000);
        } else {
          this.errorMessage.set(response.message || 'Failed to log entry');
        }
      },
      error: (err) => {
        this.submitting.set(false);
        console.error('Entry log error:', err);
        console.error('Error response body:', err.error);
        this.errorMessage.set(err.error?.message || 'Failed to log entry. Please try again.');
      },
    });
  }

  logExit(): void {
    const r = this.result();
    const profile = this.guardProfile();

    if (!r || !profile) return;

    this.submitting.set(true);
    this.errorMessage.set('');
    this.successMessage.set('');

    const data: any = {
      personType: r?.personType === 'Visitor' ? 2 : 1,
      action: 2,
    };

    if (r?.personType === 'Labour' || !r?.personType) {
      data.labourId = r?.id;
    } else {
      data.visitorId = r?.id;
    }

    this.api.createRecord(data).subscribe({
      next: (response) => {
        this.submitting.set(false);
        if (response.success) {
          this.successMessage.set('Exit logged successfully!');
          setTimeout(() => {
            this.clearResult();
            this.successMessage.set('');
          }, 2000);
        } else {
          this.errorMessage.set(response.message || 'Failed to log exit');
        }
      },
      error: (err) => {
        this.submitting.set(false);
        this.errorMessage.set('Failed to log exit. Please try again.');
        console.error('Exit log error:', err);
      },
    });
  }

  clearResult(): void {
    this.result.set(null);
    this.searchTerm = '';
    this.errorMessage.set('');
    this.successMessage.set('');
  }

  backToResults(): void {
    // Keep the current searchTerm and results; just clear the focused result and messages
    // Restore the previously shown results (if any) and keep the selected result available.
    const prev = this.previousResults();
    if (prev && prev.length) {
      this.results.set(prev);
    }
    // clear stored previous results and messages but do not clear the selected result
    // Hide focused single result and show the list (do not clear previousResults so
    // user can select multiple items and cancel repeatedly)
    this.result.set(null);
    this.errorMessage.set('');
    this.successMessage.set('');
  }

  goBack(): void {
    this.router.navigate(['/dashboard']);
  }

  openLabourRegistration(): void {
    const prefill: any = {};
    if (this.searchTerm && this.searchTerm.trim()) {
      prefill.phoneNumber = this.searchTerm.trim();
    }

    try {
      this.router.navigate(['/labour-registration'], { state: { prefill } });
    } catch (err) {
      this.errorMessage.set('Unable to open labour registration');
    }
  }

  openVisitorRegistration(): void {
    const prefill: any = {};
    if (this.searchTerm && this.searchTerm.trim()) {
      prefill.phoneNumber = this.searchTerm.trim();
    }

    try {
      this.router.navigate(['/visitor-registration'], { state: { prefill } });
    } catch (err) {
      this.errorMessage.set('Unable to open visitor registration');
    }
  }

  selectResult(r: any): void {
    // Save current results (shallow copy) so they can be restored after cancel.
    const curr = this.results();
    if (curr && (!this.previousResults() || this.previousResults()!.length === 0)) {
      this.previousResults.set(curr.slice());
    }
    this.result.set(r);
    this.results.set(null);
    this.errorMessage.set('');
  }

  subtitleFor(r: any): string {
    if (!r) return '';
    if (r.personType === 'Labour') {
      const parts: string[] = [];
      if (r.projectName) parts.push(r.projectName);
      if (r.contractorName) parts.push(r.contractorName);
      if (r.barcode) parts.push(`Barcode: ${r.barcode}`);
      return parts.join(' • ');
    }

    if (r.personType === 'Visitor') {
      const parts: string[] = [];
      if (r.companyName) parts.push(r.companyName);
      if (r.purpose) parts.push(r.purpose);
      return parts.join(' • ');
    }

    return r.personType || '';
  }

  getPhotoDataUrl(photoUrl: string): string {
    if (!photoUrl) return '';
    // If already a data URL, return as-is
    if (photoUrl.startsWith('data:')) return photoUrl;
    // Otherwise, prepend the data URL prefix for base64 JPEG
    return `data:image/jpeg;base64,${photoUrl}`;
  }

  // Contractor mode methods
  switchToContractorMode(): void {
    this.contractorMode.set(true);
    this.clearResult();
    this.results.set(null);
    this.previousResults.set(null);
    this.contractorResults.set(null);
    this.selectedLabourIds.set(new Set());
  }

  switchToPersonMode(): void {
    this.contractorMode.set(false);
    this.contractorResults.set(null);
    this.selectedLabourIds.set(new Set());
    this.contractorSearchTerm = '';
  }

  searchContractor(): void {
    if (!this.contractorSearchTerm.trim()) {
      this.errorMessage.set('Please enter contractor name');
      return;
    }

    // Ensure contractor grid is shown and person results are cleared
    this.contractorMode.set(true);
    this.result.set(null);
    this.results.set(null);

    this.loading.set(true);
    this.errorMessage.set('');
    this.contractorResults.set(null);
    this.selectedLabourIds.set(new Set());

    this.api.searchByContractor(this.contractorSearchTerm).subscribe({
      next: (res: any) => {
        this.loading.set(false);
        const data = res?.data;
        
        if (!data || !Array.isArray(data) || data.length === 0) {
          this.errorMessage.set('No labour found for this contractor');
          return;
        }

        this.contractorResults.set(data);
      },
      error: () => {
        this.loading.set(false);
        this.errorMessage.set('Search failed. Please try again.');
      }
    });
  }

  toggleLabourSelection(labourId: number): void {
    const current = new Set(this.selectedLabourIds());
    if (current.has(labourId)) {
      current.delete(labourId);
    } else {
      current.add(labourId);
    }
    this.selectedLabourIds.set(current);
  }

  isLabourSelected(labourId: number): boolean {
    return this.selectedLabourIds().has(labourId);
  }

  selectAllLabour(): void {
    const results = this.contractorResults();
    if (!results || results.length === 0) return;

    if (this.isAllSelected()) {
      // Deselect all
      this.selectedLabourIds.set(new Set());
    } else {
      // Select all
      const allIds = new Set(results.map((r: any) => r.id));
      this.selectedLabourIds.set(allIds);
    }
  }

  isAllSelected(): boolean {
    const results = this.contractorResults();
    if (!results || results.length === 0) return false;
    return results.every((r: any) => this.selectedLabourIds().has(r.id));
  }

  clearSelection(): void {
    this.selectedLabourIds.set(new Set());
  }

  showPhotoVerificationModal(action: 'entry' | 'exit'): void {
    if (this.selectedLabourIds().size === 0) {
      this.errorMessage.set('No labour selected');
      return;
    }

    // Filter labour based on action and current status
    const results = this.contractorResults();
    if (!results) return;

    const selectedIds = this.selectedLabourIds();
    const selectedLabour = results.filter((r: any) => selectedIds.has(r.id));
    
    // For check-in: only allow labour who are NOT currently checked in (hasOpenEntry = false)
    // For check-out: only allow labour who ARE currently checked in (hasOpenEntry = true)
    const validLabour = selectedLabour.filter((r: any) => 
      action === 'entry' ? !r.hasOpenEntry : r.hasOpenEntry
    );

    if (validLabour.length === 0) {
      if (action === 'entry') {
        this.errorMessage.set('All selected labour are already checked in. Please select labour who are not currently active.');
      } else {
        this.errorMessage.set('All selected labour are already checked out. Please select labour who are currently active.');
      }
      return;
    }

    // Update selection to only include valid labour
    if (validLabour.length < selectedLabour.length) {
      const validIds = new Set(validLabour.map((r: any) => r.id));
      this.selectedLabourIds.set(validIds);
      
      const filteredCount = selectedLabour.length - validLabour.length;
      this.errorMessage.set(
        action === 'entry' 
          ? `${filteredCount} labour already checked in - removed from selection.`
          : `${filteredCount} labour already checked out - removed from selection.`
      );
      
      // Clear error after 3 seconds
      setTimeout(() => this.errorMessage.set(''), 3000);
    }

    this.pendingBulkAction = action;
    this.showPhotoVerification.set(true);
  }

  closePhotoVerification(): void {
    this.showPhotoVerification.set(false);
    this.pendingBulkAction = null;
  }

  getSelectedLabour(): any[] {
    const results = this.contractorResults();
    if (!results) return [];
    const selectedIds = this.selectedLabourIds();
    const selectedLabour = results.filter((r: any) => selectedIds.has(r.id));
    
    // Filter based on pending action to show only valid labour in verification modal
    if (this.pendingBulkAction) {
      return selectedLabour.filter((r: any) => 
        this.pendingBulkAction === 'entry' ? !r.hasOpenEntry : r.hasOpenEntry
      );
    }
    
    return selectedLabour;
  }

  confirmBulkAction(): void {
    if (!this.pendingBulkAction) return;

    const ids = Array.from(this.selectedLabourIds());
    if (ids.length === 0) {
      this.errorMessage.set('No labour selected');
      return;
    }

    this.submitting.set(true);
    this.errorMessage.set('');
    this.successMessage.set('');

    // Action: 1 = Entry, 2 = Exit
    const action = this.pendingBulkAction === 'entry' ? 1 : 2;
    const actionName = this.pendingBulkAction === 'entry' ? 'check-in' : 'check-out';

    this.api.bulkCheckIn(ids, action).subscribe({
      next: (res: any) => {
        this.submitting.set(false);
        if (res.success) {
          const data = res.data;
          this.successMessage.set(
            `Processed: ${data.successCount} successful, ${data.failureCount} failed`
          );
          
          // Close modal and refresh
          this.closePhotoVerification();
          setTimeout(() => {
            this.searchContractor();
            this.selectedLabourIds.set(new Set());
          }, 1500);
        } else {
          this.errorMessage.set(res.message || `Bulk ${actionName} failed`);
        }
      },
      error: (err) => {
        this.submitting.set(false);
        this.errorMessage.set(`Bulk ${actionName} failed. Please try again.`);
        console.error(`Bulk ${actionName} error:`, err);
      }
    });
  }
}

// Local type used by the entry/exit search UI
export interface PersonSearchResult {
  id: number;
  personType: 'Labour' | 'Visitor';
  name?: string;
  phoneNumber?: string;
  projectName?: string;
  contractorName?: string;
  barcode?: string;
  companyName?: string;
  purpose?: string;
  hasOpenEntry?: boolean;
}
