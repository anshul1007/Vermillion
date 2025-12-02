import { Injectable, OnDestroy, computed, inject, signal } from '@angular/core';
import { take } from 'rxjs/operators';
import { Router } from '@angular/router';
import { ApiResponse, ApiService } from '../../../core/services/api.service';
import { LocalImageService } from '../../../core/services/local-image.service';
import { BarcodeService } from '../../../core/services/barcode.service';
import { AuthService } from '../../../core/auth/auth.service';
import { ContractorLabourResult, PersonSearchResult } from '../entry-exit.models';

@Injectable()
export class EntryExitSearchStore implements OnDestroy {
  private readonly api = inject(ApiService);
  private readonly barcodeSvc = inject(BarcodeService);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  private readonly photoObjectUrlMap = new Map<string, string>();
  private readonly photoFetchPromises = new Map<string, Promise<void>>();
  private readonly localImage = inject(LocalImageService);

  readonly guardProfile = this.authService.guardProfile;
  readonly placeholderUrl = 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=';

  readonly searchTerm = signal('');
  readonly result = signal<PersonSearchResult | null>(null);
  readonly results = signal<PersonSearchResult[] | null>(null);
  readonly previousResults = signal<PersonSearchResult[] | null>(null);
  readonly errorMessage = signal('');
  readonly successMessage = signal('');
  readonly loading = signal(false);
  readonly submitting = signal(false);
  readonly photoCacheVersion = signal(0);

  readonly contractorMode = signal(false);
  readonly contractorSearchTerm = signal('');
  readonly contractorResults = signal<ContractorLabourResult[] | null>(null);
  readonly selectedLabourIds = signal(new Set<number>());
  readonly showPhotoVerification = signal(false);
  readonly pendingBulkAction = signal<'entry' | 'exit' | null>(null);

  readonly decoratedResults = computed(() => {
    const list = this.results();
    if (!list) return null;
    return list.map(item => this.decoratePerson(item));
  });

  readonly selectedLabourCount = computed(() => this.selectedLabourIds().size);

  readonly allLabourSelected = computed(() => {
    const results = this.contractorResults();
    if (!results || results.length === 0) return false;
    const selected = this.selectedLabourIds();
    return results.every(r => selected.has(r.id));
  });

  readonly labourImageResolver = (labour: ContractorLabourResult) => this.resolveLabourImage(labour);

  updateSearchTerm(value: string): void {
    this.searchTerm.set(value);
  }

  scanWithCamera(): Promise<void> {
    this.errorMessage.set('');
    return this.barcodeSvc
      .scanBarcodeWithCamera()
      .then((barcode: string | null | undefined) => {
        if (barcode) {
          this.searchByBarcode(barcode);
        }
      })
      .catch((err: unknown) => {
        console.error('Barcode scan failed or cancelled', err);
        this.errorMessage.set('Barcode scan failed or cancelled');
      });
  }

  search(): void {
    this.resetPersonSearchState();
    const term = this.searchTerm().trim();
    if (!term) {
      this.errorMessage.set('Please enter search term');
      return;
    }

    this.loading.set(true);
    this.api.search(term).pipe(take(1)).subscribe({
      next: (res: ApiResponse<any>) => {
        this.loading.set(false);
        const data = res?.data;
        if (!data) {
          this.errorMessage.set('No person found with that search term');
          return;
        }

        if (Array.isArray(data)) {
          if (data.length === 0) {
            this.errorMessage.set('No person found with that search term');
            return;
          }

          if (data.length > 1) {
            this.results.set(data);
            this.previousResults.set(data.slice());
            return;
          }

          this.selectResult(data[0]);
          return;
        }

        this.selectResult(data);
      },
      error: () => {
        this.loading.set(false);
        this.errorMessage.set('Search failed. Person not found.');
      }
    });
  }

  searchByBarcode(barcode: string): void {
    this.resetPersonSearchState();
    if (!barcode) return;

    this.loading.set(true);
    this.api.search(barcode).pipe(take(1)).subscribe({
      next: (res: ApiResponse<any>) => {
        this.loading.set(false);
        const data = res?.data;
        if (!data) {
          this.errorMessage.set('No person found with that barcode');
          return;
        }

        if (Array.isArray(data)) {
          if (data.length === 0) {
            this.errorMessage.set('No person found with that barcode');
            return;
          }

          if (data.length > 1) {
            this.results.set(data);
            return;
          }

          this.selectResult(data[0]);
          return;
        }

        this.selectResult(data);
      },
      error: () => {
        this.loading.set(false);
        this.errorMessage.set('Search failed. Person not found.');
      }
    });
  }

  logEntry(): void {
    const current = this.result();
    const profile = this.guardProfile();
    if (!current || !profile) return;

    this.submitting.set(true);
    this.errorMessage.set('');
    this.successMessage.set('');

    const payload: any = {
      personType: current.personType === 'Visitor' ? 2 : 1,
      action: 1
    };

    if (current.personType === 'Labour' || !current.personType) {
      payload.labourId = current.id;
    } else {
      payload.visitorId = current.id;
    }

    this.api.createRecord(payload).pipe(take(1)).subscribe({
      next: (response: ApiResponse<any>) => {
        this.submitting.set(false);
        if (response.success) {
          this.result.set({ ...current, hasOpenEntry: true });
          this.successMessage.set('Entry logged successfully!');
        } else {
          this.errorMessage.set(response.message || 'Failed to log entry');
        }
      },
      error: (err: unknown) => {
        this.submitting.set(false);
        console.error('Entry log error:', err);
        const message = typeof err === 'object' && err !== null && 'error' in (err as Record<string, unknown>)
          ? ((err as Record<string, unknown>)['error'] as { message?: string } | undefined)?.message
          : undefined;
        this.errorMessage.set(message || 'Failed to log entry. Please try again.');
      }
    });
  }

  logExit(): void {
    const current = this.result();
    const profile = this.guardProfile();
    if (!current || !profile) return;

    this.submitting.set(true);
    this.errorMessage.set('');
    this.successMessage.set('');

    const payload: any = {
      personType: current.personType === 'Visitor' ? 2 : 1,
      action: 2
    };

    if (current.personType === 'Labour' || !current.personType) {
      payload.labourId = current.id;
    } else {
      payload.visitorId = current.id;
    }

    this.api.createRecord(payload).pipe(take(1)).subscribe({
      next: (response: ApiResponse<any>) => {
        this.submitting.set(false);
        if (response.success) {
          this.result.set({ ...current, hasOpenEntry: false });
          this.successMessage.set('Exit logged successfully!');
        } else {
          this.errorMessage.set(response.message || 'Failed to log exit');
        }
      },
      error: (err: unknown) => {
        this.submitting.set(false);
        console.error('Exit log error:', err);
        this.errorMessage.set('Failed to log exit. Please try again.');
      }
    });
  }

  backToResults(): void {
    const prev = this.previousResults();
    if (prev && prev.length) {
      this.results.set(prev);
    }
    this.result.set(null);
    this.errorMessage.set('');
    this.successMessage.set('');
  }

  handleContractorSearch(): void {
    this.contractorSearchTerm.set(this.searchTerm().trim());
    this.searchContractor();
  }

  searchContractor(): void {
    const contractorTerm = this.contractorSearchTerm().trim();
    if (!contractorTerm) {
      this.errorMessage.set('Please enter contractor name');
      return;
    }

    this.contractorMode.set(true);
    this.result.set(null);
    this.results.set(null);

    this.loading.set(true);
    this.errorMessage.set('');
    this.contractorResults.set(null);
    this.selectedLabourIds.set(new Set());

    this.api.searchByContractor(contractorTerm).pipe(take(1)).subscribe({
      next: (res: ApiResponse<any>) => {
        this.loading.set(false);
        const data = res?.data;
        if (!Array.isArray(data) || data.length === 0) {
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
    const next = new Set(this.selectedLabourIds());
    if (next.has(labourId)) {
      next.delete(labourId);
    } else {
      next.add(labourId);
    }
    this.selectedLabourIds.set(next);
  }

  selectAllLabour(): void {
    const results = this.contractorResults();
    if (!results || results.length === 0) return;

    if (this.allLabourSelected()) {
      this.selectedLabourIds.set(new Set());
    } else {
      this.selectedLabourIds.set(new Set(results.map(r => r.id)));
    }
  }

  clearSelection(): void {
    this.selectedLabourIds.set(new Set());
  }

  showPhotoVerificationModal(action: 'entry' | 'exit'): void {
    if (this.selectedLabourIds().size === 0) {
      this.errorMessage.set('No labour selected');
      return;
    }

    const results = this.contractorResults();
    if (!results) return;

    const selectedIds = this.selectedLabourIds();
    const selectedLabour = results.filter(r => selectedIds.has(r.id));
    const validLabour = selectedLabour.filter(l => (action === 'entry' ? !l.hasOpenEntry : l.hasOpenEntry));

    if (validLabour.length === 0) {
      this.errorMessage.set(
        action === 'entry'
          ? 'All selected labour are already checked in. Please select labour who are not currently active.'
          : 'All selected labour are already checked out. Please select labour who are currently active.'
      );
      return;
    }

    if (validLabour.length < selectedLabour.length) {
      const validIds = new Set(validLabour.map(r => r.id));
      this.selectedLabourIds.set(validIds);
      const filteredCount = selectedLabour.length - validLabour.length;
      this.errorMessage.set(
        action === 'entry'
          ? `${filteredCount} labour already checked in - removed from selection.`
          : `${filteredCount} labour already checked out - removed from selection.`
      );
      setTimeout(() => this.errorMessage.set(''), 3000);
    }

    this.pendingBulkAction.set(action);
    this.showPhotoVerification.set(true);
  }

  closePhotoVerification(): void {
    this.showPhotoVerification.set(false);
    this.pendingBulkAction.set(null);
  }

  getSelectedLabour(): ContractorLabourResult[] {
    const results = this.contractorResults();
    if (!results) return [];
    const selectedIds = this.selectedLabourIds();
    const selected = results.filter(r => selectedIds.has(r.id));
    const action = this.pendingBulkAction();
    if (!action) return selected;
    return selected.filter(r => (action === 'entry' ? !r.hasOpenEntry : r.hasOpenEntry));
  }

  confirmBulkAction(): void {
    const action = this.pendingBulkAction();
    if (!action) return;

    const ids = Array.from(this.selectedLabourIds());
    if (ids.length === 0) {
      this.errorMessage.set('No labour selected');
      return;
    }

    this.submitting.set(true);
    this.errorMessage.set('');
    this.successMessage.set('');

    const actionCode = action === 'entry' ? 1 : 2;
    const actionName = action === 'entry' ? 'check-in' : 'check-out';

    this.api.bulkCheckIn(ids, actionCode).pipe(take(1)).subscribe({
      next: (res: ApiResponse<any>) => {
        this.submitting.set(false);
        if (res.success) {
          const data = res.data;
          this.successMessage.set(`Processed: ${data.successCount} successful, ${data.failureCount} failed`);
          this.closePhotoVerification();
          setTimeout(() => {
            this.searchContractor();
            this.selectedLabourIds.set(new Set());
          }, 1500);
        } else {
          this.errorMessage.set(res.message || `Bulk ${actionName} failed`);
        }
      },
      error: (err: unknown) => {
        this.submitting.set(false);
        console.error(`Bulk ${actionName} error:`, err);
        this.errorMessage.set(`Bulk ${actionName} failed. Please try again.`);
      }
    });
  }

  resolvePersonImage(person: PersonSearchResult | null): string | null {
    this.photoCacheVersion();
    if (!person || !person.photoUrl) return null;
    return this.resolvePhoto(person.photoUrl);
  }

  resolveLabourImage(labour: ContractorLabourResult): string | null {
    this.photoCacheVersion();
    if (!labour || !labour.photoUrl) return null;
    return this.resolvePhoto(labour.photoUrl);
  }

  clearPhotoCache(): void {
    for (const url of this.photoObjectUrlMap.values()) {
      try {
        URL.revokeObjectURL(url);
      } catch {}
    }
    this.photoObjectUrlMap.clear();
    this.photoFetchPromises.clear();
  }

  navigateToLabourRegistration(): void {
    const prefill: Record<string, unknown> = {};
    const term = this.searchTerm().trim();
    if (term) {
      prefill['phoneNumber'] = term;
    }

    this.router.navigate(['/labour-registration'], { state: { prefill } }).catch(() => {
      this.errorMessage.set('Unable to open labour registration');
    });
  }

  navigateToVisitorRegistration(): void {
    const prefill: Record<string, unknown> = {};
    const term = this.searchTerm().trim();
    if (term) {
      prefill['phoneNumber'] = term;
    }

    this.router.navigate(['/visitor-registration'], { state: { prefill } }).catch(() => {
      this.errorMessage.set('Unable to open visitor registration');
    });
  }

  ngOnDestroy(): void {
    this.clearPhotoCache();
  }

  private resetPersonSearchState(): void {
    this.result.set(null);
    this.results.set(null);
    this.previousResults.set(null);
    this.errorMessage.set('');
    this.successMessage.set('');
    this.contractorMode.set(false);
    this.contractorResults.set(null);
    this.selectedLabourIds.set(new Set());
  }

  selectResult(result: PersonSearchResult): void {
    if (!result) return;

    const curr = this.results();
    if (curr && curr.length && (!this.previousResults() || this.previousResults()!.length === 0)) {
      this.previousResults.set(curr.slice());
    }

    const enriched = this.decoratePerson(result);
    this.result.set(enriched);
    this.results.set(null);
    this.errorMessage.set('');

    if (enriched.photoUrl) {
      this.resolvePersonImage(enriched);
    }
  }

  private resolvePhoto(photoUrl: string): string | null {
    const blobPath = photoUrl.replace(/^\/?api\/photos\//, '').replace(/^\//, '');
    const cached = this.photoObjectUrlMap.get(blobPath);
    if (cached) return cached;

    if (this.photoFetchPromises.has(blobPath)) {
      return this.placeholderUrl;
    }

    const promise = (async () => {
      try {
        // Try to resolve via local cache / storage first (this will download+save if not present)
        const resolved = await this.localImage.resolveImage(photoUrl, blobPath);
        if (resolved) {
          this.photoObjectUrlMap.set(blobPath, resolved);
          this.photoCacheVersion.update(v => v + 1);
          return;
        }

        // Fallback: fetch blob from API and create object URL
        try {
          const blob = await this.api.getPhotoBlob(blobPath).toPromise();
          if (!blob) return;
          const url = URL.createObjectURL(blob);
          this.photoObjectUrlMap.set(blobPath, url);
          this.photoCacheVersion.update(v => v + 1);
        } catch (err) {
          console.error('Failed to fetch photo blob', err);
        }
      } catch (err) {
        console.error('Failed to resolve photo', err);
      } finally {
        this.photoFetchPromises.delete(blobPath);
      }
    })();

    this.photoFetchPromises.set(blobPath, promise as Promise<void>);
    return this.placeholderUrl;
  }

  private subtitleFor(result: PersonSearchResult): string {
    if (!result) return '';
    if (result.personType === 'Labour') {
      const parts: string[] = [];
      if (result.projectName) parts.push(result.projectName);
      if (result.contractorName) parts.push(result.contractorName);
      if (result.barcode) parts.push(`Barcode: ${result.barcode}`);
      return parts.join(' • ');
    }

    if (result.personType === 'Visitor') {
      const parts: string[] = [];
      if (result.contractorName) parts.push(result.contractorName);
      if (result.companyName) parts.push(result.companyName);
      if (result.purpose) parts.push(result.purpose);
      return parts.join(' • ');
    }

    return result.personType || '';
  }

  private decoratePerson(result: PersonSearchResult): PersonSearchResult {
    if (!result) return result;
    const subtitle = this.subtitleFor(result);
    return { ...result, subtitle };
  }
}
