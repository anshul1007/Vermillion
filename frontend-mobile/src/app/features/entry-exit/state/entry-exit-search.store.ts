import { Injectable, OnDestroy, computed, effect, inject, signal } from '@angular/core';
import { generateClientId } from '../../../core/utils/id.util';
import { lastValueFrom } from 'rxjs';
import { take } from 'rxjs/operators';
import { Network } from '@capacitor/network';
import { Router } from '@angular/router';
import { ApiResponse, ApiService } from '../../../core/services/api.service';
import { LocalImageService } from '../../../core/services/local-image.service';
import { LoggerService } from '../../../core/services/logger.service';
import { PLACEHOLDER_DATA_URL } from '../../../core/constants/image.constants';
import { BarcodeService } from '../../../core/services/barcode.service';
import { AuthService } from '../../../core/auth/auth.service';
import { projectStore } from '../../../core/state/project.store';
import { OfflineStorageService } from '../../../core/services/offline-storage.service';
import { OfflineDbService } from '../../../core/services/offline-db.service';
import { ContractorLabourResult, PersonSearchResult } from '../entry-exit.models';

type RecordPayload = {
  personType: 'Labour' | 'Visitor';
  action: 'Entry' | 'Exit';
  labourId?: number;
  visitorId?: number;
  clientId?: string;
};

@Injectable()
export class EntryExitSearchStore implements OnDestroy {
  private readonly api = inject(ApiService);
  private readonly logger = inject(LoggerService);
  private readonly barcodeSvc = inject(BarcodeService);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly offlineStorage = inject(OfflineStorageService);
  private readonly offlineDb = inject(OfflineDbService);

  private readonly photoFetchPromises = new Map<string, Promise<void>>();
  private readonly localImage = inject(LocalImageService);
  // map blobPath -> { original, url }
  private readonly photoCacheMap = new Map<string, { original: string; url: string }>();

  readonly guardProfile = this.authService.guardProfile;
  readonly placeholderUrl = PLACEHOLDER_DATA_URL;

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

  readonly currentProjectId = signal<number | null>(
    projectStore.projectId() ?? this.guardProfile()?.projectId ?? null
  );
  readonly currentProjectName = signal<string>(
    projectStore.projectName() ?? this.guardProfile()?.projectName ?? ''
  );
  readonly hasProject = computed(() => {
    const pid = this.currentProjectId();
    return !!(pid && pid > 0);
  });
  readonly noProjectMessage = 'Project not assigned. Please contact your administrator.';

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

  private readonly projectEffect = effect(
    () => {
      const profile = this.guardProfile();
      const pid = projectStore.projectId() ?? profile?.projectId ?? null;
      const pname = projectStore.projectName() ?? profile?.projectName ?? '';

      if (pid !== this.currentProjectId()) {
        this.currentProjectId.set(pid);
      }

      if (pname !== this.currentProjectName()) {
        this.currentProjectName.set(pname || '');
      }

      if (!pid || pid <= 0) {
        this.loading.set(false);
        this.submitting.set(false);
        if (this.errorMessage() !== this.noProjectMessage) {
          this.errorMessage.set(this.noProjectMessage);
        }
        return;
      }

      if (this.errorMessage() === this.noProjectMessage) {
        this.errorMessage.set('');
      }
    }
  );

  updateSearchTerm(value: string): void {
    this.searchTerm.set(value);
  }

  scanWithCamera(): Promise<void> {
    if (!this.ensureProjectAssigned()) {
      return Promise.resolve();
    }
    this.errorMessage.set('');
    return this.barcodeSvc
      .scanBarcodeWithCamera()
      .then((barcode: string | null | undefined) => {
        if (barcode) {
          this.searchByBarcode(barcode);
        }
      })
      .catch((err: unknown) => {
        this.logger.warn('Barcode scan failed or cancelled', err);
        this.errorMessage.set('Barcode scan failed or cancelled');
      });
  }

  search(): void {
    if (!this.ensureProjectAssigned()) {
      return;
    }
    // Clear any contractor-mode state immediately so UI doesn't show contractor results
    this.resetPersonSearchState();
    const term = this.searchTerm().trim();
    if (!term) {
      this.errorMessage.set('Please enter search term');
      return;
    }

    this.loading.set(true);
    // Try network search first, otherwise fallback to local DB
    this.api.search(term).pipe(take(1)).subscribe({
      next: (res: ApiResponse<any>) => {
        this.loading.set(false);
        this.contractorMode.set(false);
        this.contractorResults.set(null);
        const data = res?.data;
        if (data && (Array.isArray(data) ? data.length > 0 : true)) {
          if (Array.isArray(data)) {
            if (data.length > 1) {
              this.results.set(data);
              this.previousResults.set(data.slice());
              return;
            }
            this.selectResult(data[0]);
            return;
          }
          this.selectResult(data);
          return;
        }

        // fallback to offline search on no results
        this.performLocalPersonSearch(term).then((found) => {
          this.loading.set(false);
          if (!found) this.errorMessage.set('No person found with that search term');
        }).catch((e) => {
          this.loading.set(false);
          this.logger.warn('Local search failed', e);
          this.errorMessage.set('Search failed. Person not found.');
        });
      },
      error: () => {
        // network error -> try local search
        this.performLocalPersonSearch(term).then((found) => {
          this.loading.set(false);
          if (!found) this.errorMessage.set('No person found with that search term');
        }).catch((e) => {
          this.loading.set(false);
          this.logger.warn('Local search failed', e);
          this.errorMessage.set('Search failed. Person not found.');
        });
      }
    });
  }

  searchByBarcode(barcode: string): void {
    if (!this.ensureProjectAssigned()) {
      return;
    }
    this.resetPersonSearchState();
    if (!barcode) return;

    this.loading.set(true);
    this.api.search(barcode).pipe(take(1)).subscribe({
      next: (res: ApiResponse<any>) => {
        this.loading.set(false);
        this.contractorMode.set(false);
        this.contractorResults.set(null);
        const data = res?.data;
        if (data && (Array.isArray(data) ? data.length > 0 : true)) {
          if (Array.isArray(data)) {
            if (data.length > 1) {
              this.results.set(data);
              return;
            }
            this.selectResult(data[0]);
            return;
          }
          this.selectResult(data);
          return;
        }

        // fallback to barcode local search
        this.performLocalBarcodeSearch(barcode).then((found) => {
          this.loading.set(false);
          if (!found) this.errorMessage.set('No person found with that barcode');
        }).catch((e) => {
          this.loading.set(false);
          this.logger.warn('Local barcode search failed', e);
          this.errorMessage.set('Search failed. Person not found.');
        });
      },
      error: () => {
        this.performLocalBarcodeSearch(barcode).then((found) => {
          this.loading.set(false);
          if (!found) this.errorMessage.set('No person found with that barcode');
        }).catch((e) => {
          this.loading.set(false);
          this.logger.warn('Local barcode search failed', e);
          this.errorMessage.set('Search failed. Person not found.');
        });
      }
    });
  }

  private async performLocalPersonSearch(term: string): Promise<boolean> {
    // search `people` table in offline DB (from OfflineStorageService or OfflineDbService)
    try {
      const people = await this.offlineStorage.getAllLocalPeople().catch(() => []);
      const matches = (people || []).filter((p: any) => {
        const name = (p.name || '').toLowerCase();
        return name.includes(term.toLowerCase()) || (p.phoneNumber || '').includes(term);
      });
      if (matches.length === 0) return false;
      if (matches.length === 1) {
        this.selectResult(matches[0]);
        return true;
      }
      this.results.set(matches.map((m: any) => ({ id: m.serverId || m.clientId || m.id, name: m.name, phoneNumber: m.phoneNumber } as any)));
      this.previousResults.set(matches.slice());
      return true;
    } catch (e) {
      throw e;
    }
  }

  private async performLocalBarcodeSearch(barcode: string): Promise<boolean> {
    try {
      const people = await this.offlineStorage.getAllLocalPeople().catch(() => []);
      const match = (people || []).find((p: any) => (p.barcode || '') === barcode || (p.barcode && String(p.barcode) === barcode));
      if (!match) return false;
      this.selectResult(match);
      return true;
    } catch (e) {
      throw e;
    }
  }

  async logEntry(): Promise<void> {
    const current = this.result();
    if (!current || !this.ensureProjectAssigned()) {
      return;
    }

    this.submitting.set(true);
    this.errorMessage.set('');
    this.successMessage.set('');

    const payload = this.buildRecordPayload(current, 'Entry');

    try {
      const status = await this.getNetworkStatus();
      const offlineOnly = !this.hasServerId(current) || !status.connected;

      if (offlineOnly) {
        await this.queueRecordAction(payload, current, 'Entry');
        this.result.set({ ...current, hasOpenEntry: true });
        this.successMessage.set('Entry saved offline and queued for sync');
        return;
      }

      const response = await lastValueFrom(this.api.createRecord(payload));
      if (response?.success) {
        this.result.set({ ...current, hasOpenEntry: true });
        this.successMessage.set('Entry logged successfully!');
      } else {
        const message = response?.message || 'Failed to log entry';
        this.errorMessage.set(message);
      }
    } catch (err) {
      const status = this.extractStatus(err);
      if (status && status >= 400 && status < 500) {
        const message = this.resolveErrorMessage(err) || 'Failed to log entry';
        this.errorMessage.set(message);
      } else {
        try {
          await this.queueRecordAction(payload, current, 'Entry');
          this.result.set({ ...current, hasOpenEntry: true });
          this.successMessage.set('Entry saved offline and queued for sync');
        } catch (queueErr) {
          this.logger.error('Entry offline queue failed', queueErr);
          this.errorMessage.set('Failed to log entry. Please try again.');
        }
      }
    } finally {
      this.submitting.set(false);
    }
  }

  async logExit(): Promise<void> {
    const current = this.result();
    if (!current || !this.ensureProjectAssigned()) {
      return;
    }

    this.submitting.set(true);
    this.errorMessage.set('');
    this.successMessage.set('');

    const payload = this.buildRecordPayload(current, 'Exit');

    try {
      const status = await this.getNetworkStatus();
      const offlineOnly = !this.hasServerId(current) || !status.connected;

      if (offlineOnly) {
        await this.queueRecordAction(payload, current, 'Exit');
        this.result.set({ ...current, hasOpenEntry: false });
        this.successMessage.set('Exit saved offline and queued for sync');
        return;
      }

      const response = await lastValueFrom(this.api.createRecord(payload));
      if (response?.success) {
        this.result.set({ ...current, hasOpenEntry: false });
        this.successMessage.set('Exit logged successfully!');
      } else {
        const message = response?.message || 'Failed to log exit';
        this.errorMessage.set(message);
      }
    } catch (err) {
      const status = this.extractStatus(err);
      if (status && status >= 400 && status < 500) {
        const message = this.resolveErrorMessage(err) || 'Failed to log exit';
        this.errorMessage.set(message);
      } else {
        try {
          await this.queueRecordAction(payload, current, 'Exit');
          this.result.set({ ...current, hasOpenEntry: false });
          this.successMessage.set('Exit saved offline and queued for sync');
        } catch (queueErr) {
          this.logger.error('Exit offline queue failed', queueErr);
          this.errorMessage.set('Failed to log exit. Please try again.');
        }
      }
    } finally {
      this.submitting.set(false);
    }
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
    if (!this.ensureProjectAssigned()) {
      return;
    }
    this.contractorSearchTerm.set(this.searchTerm().trim());
    this.searchContractor();
  }

  searchContractor(): void {
    if (!this.ensureProjectAssigned()) {
      return;
    }
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
        // Prefetch contractor photos so the UI doesn't momentarily bind raw API paths.
        try {
          for (const item of data) {
            const src = (item.photoUrl || '').trim();
            if (!src) continue;
            // If absolute same-origin API photos path, normalize via resolvePhoto
            if (/^https?:\/\//i.test(src)) {
              if (/\/api\/(?:entryexit\/)?photos\//i.test(src)) {
                this.resolvePhoto(src);
                continue;
              }
              // external absolute URL - nothing to prefetch
              continue;
            }

            // relative or server path -> start resolve
            this.resolvePhoto(src);
          }
        } catch (e) {
          // ignore prefetch failures
        }
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
    if (!this.ensureProjectAssigned()) {
      return;
    }
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

    if (!this.ensureProjectAssigned()) {
      return;
    }

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
        this.logger.error(`Bulk ${actionName} error:`, err);
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
    const src = labour.photoUrl.trim();
    if (!src) return null;
    if (/^data:/i.test(src)) {
      return src;
    }
    if (/^https?:\/\//i.test(src)) {
      if (/\/api\/(?:entryexit\/)?photos\//i.test(src)) {
        return this.resolvePhoto(src);
      }
      return src;
    }
    return this.resolvePhoto(src);
  }

  clearPhotoCache(): void {
    for (const entry of this.photoCacheMap.values()) {
      try {
        if (entry && entry.url && typeof entry.url === 'string' && entry.url.startsWith('blob:')) {
          try { URL.revokeObjectURL(entry.url); } catch {}
        }
      } catch {}
    }
    this.photoCacheMap.clear();
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

  private parseNumericId(value: unknown): number | undefined {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === 'string' && /^\d+$/.test(value)) {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : undefined;
    }
    return undefined;
  }

  private hasServerId(person: PersonSearchResult): boolean {
    return this.parseNumericId(person.id) !== undefined;
  }

  private async getNetworkStatus(): Promise<{ connected: boolean }> {
    try {
      return await Network.getStatus();
    } catch {
      return { connected: true };
    }
  }

  private resolveErrorMessage(err: unknown): string | undefined {
    if (!err || typeof err !== 'object') {
      return undefined;
    }
    const httpErr = err as any;
    if (typeof httpErr.message === 'string') {
      return httpErr.message;
    }
    const nested = httpErr.error;
    if (nested) {
      if (typeof nested.message === 'string') {
        return nested.message;
      }
      if (Array.isArray(nested.errors) && nested.errors.length > 0) {
        return nested.errors[0];
      }
      if (Array.isArray(nested.Errors) && nested.Errors.length > 0) {
        return nested.Errors[0];
      }
    }
    return undefined;
  }

  private extractStatus(err: unknown): number | undefined {
    if (!err || typeof err !== 'object') {
      return undefined;
    }
    const httpErr = err as any;
    if (typeof httpErr.status === 'number') {
      return httpErr.status;
    }
    if (typeof httpErr.statusCode === 'number') {
      return httpErr.statusCode;
    }
    if (httpErr.error && typeof httpErr.error.status === 'number') {
      return httpErr.error.status;
    }
    return undefined;
  }

  private isGuid(value: string): boolean {
    return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(value);
  }

  // Use shared `generateClientId` util
  private generateClientId(): string {
    return generateClientId();
  }

  private ensureClientId(existing?: string): string {
    if (existing && this.isGuid(existing)) {
      return existing;
    }
    return this.generateClientId();
  }

  private buildRecordPayload(person: PersonSearchResult, action: 'Entry' | 'Exit'): RecordPayload {
    const payload: RecordPayload = {
      personType: (person.personType || 'Labour') as 'Labour' | 'Visitor',
      action,
      clientId: this.generateClientId(),
    };

    const numericId = this.parseNumericId(person.id);
    if (numericId !== undefined) {
      if (payload.personType === 'Visitor') {
        payload.visitorId = numericId;
      } else {
        payload.labourId = numericId;
      }
    } else if (typeof person.id === 'string' && person.id) {
      payload.clientId = this.ensureClientId(person.id);
    }

    return payload;
  }

  private async queueRecordAction(payload: RecordPayload, person: PersonSearchResult, action: 'Entry' | 'Exit'): Promise<void> {
    const queuePayload: RecordPayload = { ...payload };
    if (!queuePayload.clientId) {
      queuePayload.clientId = this.generateClientId();
    }

    // Prefer centralized enqueue via ApiService so that enqueue rules, clientId handling
    // and any photo-localization happen in one place. If ApiService fails, fall back
    // to direct enqueue to avoid data loss.
    try {
      const resp = await lastValueFrom(this.api.createRecord(queuePayload).pipe(take(1)));
      // If ApiService enqueued due to offline/slow network, still persist local record
      if (resp && resp.success && resp.message === 'enqueued-offline') {
        await this.persistOfflineRecord(queuePayload, person, action);
        return;
      }
      // If API returned success (online case), no offline persistence necessary
      if (resp && resp.success) return;
      // Otherwise, fall through to direct enqueue
    } catch (e) {
      // fall through to direct enqueue below
    }

    try {
      await this.offlineStorage.enqueueAction('createRecord', queuePayload);
      await this.persistOfflineRecord(queuePayload, person, action);
    } catch (err) {
      this.logger.error('Failed to enqueue record action', err);
      throw err;
    }
  }

  private async persistOfflineRecord(payload: RecordPayload, person: PersonSearchResult, action: 'Entry' | 'Exit'): Promise<void> {
    if (!payload.clientId) {
      return;
    }

    const timestamp = new Date().toISOString();

    try {
      const guard = this.guardProfile();
      const guardName = guard ? `${guard.firstName ?? ''} ${guard.lastName ?? ''}`.trim() : null;
      const projectId = this.currentProjectId();
      const projectName = this.currentProjectName();

      const record = {
        id: payload.clientId,
        recordId: payload.clientId,
        personType: payload.personType,
        PersonType: payload.personType,
        labourId: payload.labourId ?? null,
        LabourId: payload.labourId ?? null,
        visitorId: payload.visitorId ?? null,
        VisitorId: payload.visitorId ?? null,
        action,
        Action: action,
        timestamp,
        Timestamp: timestamp,
        personName: person.name,
        PersonName: person.name,
        contractorName: person.contractorName ?? null,
        ContractorName: person.contractorName ?? null,
        guardName: guardName && guardName.length > 0 ? guardName : null,
        GuardName: guardName && guardName.length > 0 ? guardName : null,
        projectId: projectId ?? null,
        ProjectId: projectId ?? null,
        projectName: projectName ?? null,
        ProjectName: projectName ?? null,
      };

      await this.offlineDb.upsertRecord(payload.clientId, record, timestamp);
    } catch (err) {
      this.logger.warn('Failed to persist offline record', err);
    }
  }

  ngOnDestroy(): void {
    this.clearPhotoCache();
    try {
      this.projectEffect.destroy();
    } catch (e) {}
  }

  private resetPersonSearchState(): void {
    this.result.set(null);
    this.results.set(null);
    this.previousResults.set(null);
    if (this.errorMessage() !== this.noProjectMessage) {
      this.errorMessage.set('');
    }
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
    // selecting a person always exits contractor mode
    this.contractorMode.set(false);
    this.contractorResults.set(null);
    this.selectedLabourIds.set(new Set());
    this.result.set(enriched);
    this.results.set(null);
    this.errorMessage.set('');

    if (enriched.photoUrl) {
      this.resolvePersonImage(enriched);
    }
  }

  private resolvePhoto(photoUrl: string): string | null {
    if (!photoUrl) {
      return null;
    }

    const trimmed = photoUrl.trim();
    if (!trimmed) {
      return null;
    }

    if (/^data:/i.test(trimmed)) {
      return trimmed;
    }

    let pathForBlob = trimmed;

    let fetchSrc = trimmed;
    if (/^https?:\/\//i.test(trimmed)) {
      let parsed: URL | null = null;
      try {
        parsed = new URL(trimmed);
      } catch {
        parsed = null;
      }

      const pathCandidate = parsed ? (parsed.pathname + (parsed.search || '')) : trimmed.replace(/^https?:\/\/[^/]+/i, '');

      // If the absolute URL points to our photos endpoint, treat it as a backend photo
      // and use the relative path so LocalImageService will call ApiService (adds headers).
      if (/\/api\/(?:entryexit\/)??photos\//i.test(pathCandidate || '')) {
        pathForBlob = pathCandidate;
        // use relative path when resolving so ApiService is used instead of a cross-origin fetch
        fetchSrc = pathForBlob;
      } else {
        // For other absolute URLs, only allow embedding when same-origin
        const currentOrigin = typeof location !== 'undefined' ? location.origin : null;
        if (parsed && currentOrigin && parsed.origin !== currentOrigin) {
          return trimmed;
        }

        if (parsed) {
          pathForBlob = parsed.pathname + (parsed.search || '');
        } else {
          pathForBlob = pathCandidate;
        }
      }
    }

    const cleanPath = pathForBlob.split('?')[0].split('#')[0];

    const blobPath = cleanPath
      .replace(/^https?:\/\/[^/]+/i, '')
      .replace(/^\/?(api\/entryexit\/photos|api\/photos)\//, '')
      .replace(/^\//, '');

    if (!blobPath) {
      return trimmed;
    }

    const cachedEntry = this.photoCacheMap.get(blobPath);
    if (cachedEntry) return cachedEntry.url;

    if (this.photoFetchPromises.has(blobPath)) {
      return this.placeholderUrl;
    }

    const promise = (async () => {
      try {
        // Try to resolve via LocalImageService which will download/save when appropriate
        const resolved = await this.localImage.resolveImage(fetchSrc, blobPath);
        if (resolved) {
          this.photoCacheMap.set(blobPath, { original: photoUrl, url: resolved });
          this.photoCacheVersion.update(v => v + 1);
          return;
        }

        // As a next fallback, attempt to obtain a data URL (no object URLs)
        try {
          const dataUrl = await this.localImage.getDataUrl(photoUrl);
          if (dataUrl) {
            this.photoCacheMap.set(blobPath, { original: photoUrl, url: dataUrl });
            this.photoCacheVersion.update(v => v + 1);
            return;
          }
        } catch (err) {
          this.logger.error('Failed to obtain data URL fallback for photo', err);
        }

        // If all else fails after LocalImageService, attempt to return a data URL
        this.logger.warn('Falling back to data URL attempt for photo', photoUrl);
      } catch (err) {
        this.logger.error('Failed to resolve photo', err);
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

    // Normalize possible API shapes: ContractorName, contractor, Contractor, etc.
    const raw: any = result as any;
    const contractorName = result.contractorName ?? raw.ContractorName ?? raw.contractorName ?? raw.contractor?.name ?? raw.contractor?.ContractorName ?? null;
    const companyName = result.companyName ?? raw.CompanyName ?? raw.companyName ?? raw.company?.name ?? null;
    const purpose = result.purpose ?? raw.Purpose ?? raw.purpose ?? null;
    const projectName = result.projectName ?? raw.ProjectName ?? raw.projectName ?? null;
    const barcode = result.barcode ?? raw.Barcode ?? raw.barcode ?? null;

    const normalized: PersonSearchResult = {
      ...result,
      contractorName: contractorName ?? result.contractorName,
      companyName: companyName ?? result.companyName,
      purpose: purpose ?? result.purpose,
      projectName: projectName ?? result.projectName,
      barcode: barcode ?? result.barcode
    };

    const subtitle = this.subtitleFor(normalized);
    return { ...normalized, subtitle };
  }

  private ensureProjectAssigned(): boolean {
    if (this.hasProject()) {
      return true;
    }
    this.loading.set(false);
    this.submitting.set(false);
    if (this.errorMessage() !== this.noProjectMessage) {
      this.errorMessage.set(this.noProjectMessage);
    }
    return false;
  }
}
