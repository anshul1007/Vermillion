import { Component, inject, signal, OnInit, effect } from '@angular/core';
import { take } from 'rxjs/operators';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { PhotoService } from '../core/services/photo.service';
import { LoggerService } from '../core/services/logger.service';
import { NotificationService } from '../core/services/notification.service';
import { ApiService } from '../core/services/api.service';
import { AuthService } from '../core/auth/auth.service';
import { projectStore } from '../core/state/project.store';
import { LocalImageService } from '../core/services/local-image.service';
import { OfflineStorageService } from '../core/services/offline-storage.service';
import { OcrService, AadharOcrResult } from '../core/services/ocr.service';
import { BarcodeButtonComponent } from '../shared/components/barcode-button.component';

@Component({
  selector: 'app-labour-registration',
  standalone: true,
  imports: [CommonModule, FormsModule, BarcodeButtonComponent],
  template: `
    <div class="page">
      <section class="hero card" *ngIf="!loading(); else loadingTpl">
        <div class="d-flex flex-column gap-1">
          <h1 class="page-title mb-0">Register Labour</h1>
        </div>

        <div class="form-message error" *ngIf="!currentProjectId()">
          Project not assigned. Please contact your administrator.
        </div>
        <form *ngIf="currentProjectId()" (ngSubmit)="submit()" class="form">
          <label class="form-field">
            <span class="text-label mb-1">Contractor *</span>
            <select
              [(ngModel)]="contractorId"
              name="contractor"
              required
              (ngModelChange)="validateContractor($event)"
            >
              <option [ngValue]="0">Select Contractor</option>
              <option *ngFor="let c of contractors()" [ngValue]="c.id">{{ c.name }}</option>
            </select>
            <div class="field-error" *ngIf="contractorError()">{{ contractorError() }}</div>
          </label>

          <label class="form-field">
            <span class="text-label mb-1">Labour Name *</span>
            <input
              [(ngModel)]="name"
              placeholder="Enter labour name"
              name="name"
              required
              (ngModelChange)="validateName($event)"
            />
            <div class="field-error" *ngIf="nameError()">{{ nameError() }}</div>
          </label>

          <div class="form-field ocr-actions">
            <button
              type="button"
              class="btn btn-outline btn-field-action"
              (click)="scanAadhar()"
              [disabled]="ocrInProgress() || submitting()"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <rect x="3" y="3" width="7" height="7"></rect>
                <rect x="14" y="3" width="7" height="7"></rect>
                <rect x="14" y="14" width="7" height="7"></rect>
                <rect x="3" y="14" width="7" height="7"></rect>
              </svg>
              <span *ngIf="!ocrInProgress(); else scanningTpl">Scan Aadhar</span>
            </button>
            <ng-template #scanningTpl>
              <span>Scanning... {{ ocrProgress() * 100 | number : '1.0-0' }}%</span>
            </ng-template>
            <div class="form-message info" *ngIf="ocrMessage()">{{ ocrMessage() }}</div>
          </div>

          <label class="form-field">
            <span class="text-label mb-1">Classification *</span>
            <select
              [(ngModel)]="classification"
              name="classification"
              required
              (ngModelChange)="validateClassification($event)"
            >
              <option value="">Select Classification</option>
              <option *ngFor="let c of classifications()" [value]="c.id">{{ c.name }}</option>
            </select>
            <div class="field-error" *ngIf="classificationError()">{{ classificationError() }}</div>
          </label>

          <label class="form-field">
            <span class="text-label mb-1">Phone Number *</span>
            <input
              [(ngModel)]="phone"
              placeholder="Enter phone number"
              type="tel"
              name="phone"
              required
              (ngModelChange)="validatePhone($event)"
            />
            <div class="field-error" *ngIf="phoneError()">{{ phoneError() }}</div>
          </label>

          <label class="form-field">
            <span class="text-label mb-1">Aadhar Number *</span>
            <input
              [(ngModel)]="aadharNumber"
              placeholder="Enter Aadhar number (12 digits)"
              maxlength="12"
              name="aadhar"
              required
              (ngModelChange)="validateAadhar($event)"
            />
            <div class="field-error" *ngIf="aadharError()">{{ aadharError() }}</div>
          </label>

          <label class="form-field">
            <span class="text-label mb-1">PAN Number</span>
            <input
              [(ngModel)]="panNumber"
              placeholder="Enter PAN (optional)"
              maxlength="10"
              name="pan"
              (ngModelChange)="validatePan($event)"
            />
            <div class="field-error" *ngIf="panError()">{{ panError() }}</div>
          </label>

          <label class="form-field">
            <span class="text-label mb-1">Address *</span>
            <input
              [(ngModel)]="address"
              placeholder="Enter address"
              name="address"
              required
              (ngModelChange)="validateAddress($event)"
            />
            <div class="field-error" *ngIf="addressError()">{{ addressError() }}</div>
          </label>

          <div class="form-field">
            <span class="text-label mb-1">Barcode ID *</span>
            <div class="form-inline">
              <input
                [(ngModel)]="barcode"
                placeholder="Scan or enter barcode"
                name="barcode"
                required
                (ngModelChange)="validateBarcode($event)"
              />
              <app-barcode-button
                (scanned)="onScanned($event)"
                (error)="onScanError($event)"
              ></app-barcode-button>
            </div>
            <div class="field-error" *ngIf="barcodeError()">{{ barcodeError() }}</div>
          </div>

          <div class="form-field">
            <span class="text-label mb-1">Photo *</span>
            <button type="button" class="btn btn-outline btn-field-action" (click)="takePhoto()">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path
                  d="M4 7h3l2-3h6l2 3h3a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2z"
                />
                <circle cx="12" cy="13" r="4" />
              </svg>
              <span *ngIf="photo(); else photoLabel">Retake Photo</span>
              <ng-template #photoLabel><span>Take Photo</span></ng-template>
            </button>
            <div *ngIf="photo()" class="photo-preview">
              <img [src]="photo()" alt="Labour photo" />
            </div>
          </div>

          <div class="form-message error" *ngIf="notifier.errorMessage()">
            {{ notifier.errorMessage() }}
          </div>
          <div class="form-message success" *ngIf="notifier.successMessage()">
            {{ notifier.successMessage() }}
          </div>

          <div class="form-actions">
            <button
              class="btn btn-primary primary-action"
              type="button"
              (click)="registerAndEntry()"
              [disabled]="!isValid() || submitting()"
            >
              Register & Log Entry
            </button>
            <button class="btn secondary-action" type="submit" [disabled]="!isValid() || submitting()">
              <span *ngIf="submitting(); else submitLabel">Registering...</span>
              <ng-template #submitLabel>Register Labour</ng-template>
            </button>
          </div>
        </form>
      </section>

      <ng-template #loadingTpl>
        <section class="card">
          <p class="loading">Loading contractors...</p>
        </section>
      </ng-template>
    </div>
  `,
})
export class LabourRegistrationComponent implements OnInit {
  private photoSvc = inject(PhotoService);
  private logger = inject(LoggerService);
  private api = inject(ApiService);
  private authService = inject(AuthService);
  private router = inject(Router);
  private localImage = inject(LocalImageService);
  private offline = inject(OfflineStorageService);
  private ocrService = inject(OcrService);
  notifier = inject(NotificationService);

  guardProfile = this.authService.guardProfile;
  barcode = '';
  barcodeError = signal('');
  name = '';
  phone = '';
  aadharNumber = '';
  panNumber = '';
  address = '';
  classification = '';
  contractorId = 0;
  classifications = signal<Array<{ id: number; name: string }>>([]);
  photo = signal('');
  panError = signal('');
  phoneError = signal('');
  nameError = signal('');
  contractorError = signal('');
  classificationError = signal('');
  aadharError = signal('');
  addressError = signal('');
  contractors = signal<any[]>([]);
  currentProjectId = signal<number | null>(projectStore.projectId() ?? null);
  currentProjectName = signal<string>(projectStore.projectName() ?? '');
  loading = signal(false);
  submitting = signal(false);
  ocrInProgress = signal(false);
  ocrProgress = signal(0);
  ocrMessage = signal('');
  private lastLoadedProjectId: number | null = null;

  private readonly projectEffect = effect(
    () => {
      const profile = this.guardProfile();
      const storeProjectId = projectStore.projectId();
      const storeProjectName = projectStore.projectName();
      const pid = storeProjectId ?? profile?.projectId ?? null;
      const pname = storeProjectName ?? profile?.projectName ?? '';

      if (pid !== this.currentProjectId()) {
        this.currentProjectId.set(pid);
      }
      if (pname !== this.currentProjectName()) {
        this.currentProjectName.set(pname || '');
      }

      if (pid && pid > 0) {
        if (pid !== this.lastLoadedProjectId) {
          this.lastLoadedProjectId = pid;
          this.contractorId = 0;
          this.loadContractors(pid);
        }
        return;
      }

      this.contractors.set([]);
      this.lastLoadedProjectId = null;
      this.loading.set(false);
    },
    { allowSignalWrites: true }
  );

  onScanned(code: string) {
    this.barcode = code;
    this.notifier.showSuccess('Barcode scanned', 1500);
    this.barcodeError.set('');
    setTimeout(() => this.notifier.clear(), 1500);
  }

  onScanError(err: any) {
    this.notifier.showError('Barcode scan failed. Try again.', 2000);
  }

  async scanAadhar(): Promise<void> {
    if (this.ocrInProgress()) {
      return;
    }

    this.notifier.clear();
    this.ocrMessage.set('');
    this.ocrProgress.set(0);

    let cardImage = '';
    try {
      cardImage = await this.photoSvc.takePhoto();
      if (!cardImage) {
        this.ocrMessage.set('Aadhar scan cancelled.');
        return;
      }
    } catch (err) {
      this.logger.error('Failed to capture Aadhar card image', err);
      this.notifier.showError('Could not capture the Aadhar card. Try again in better lighting.');
      return;
    }

    this.ocrInProgress.set(true);
    this.ocrProgress.set(0);

    try {
      const result = await this.ocrService.extractAadharFields(cardImage, (progress) => {
        this.ocrProgress.set(progress);
      });
      this.applyOcrResult(result);
    } catch (err) {
      this.notifier.showError('Unable to read the Aadhar card. Please retake the photo.');
      this.ocrMessage.set('Ensure the card is well lit and fills the frame.');
    } finally {
      this.ocrInProgress.set(false);
      setTimeout(() => this.ocrProgress.set(0), 1500);
    }
  }

  validateName(value: string) {
    if (!value || !value.trim() || value.trim().length < 2) {
      this.nameError.set('Name must be at least 2 characters');
      return false;
    }
    this.nameError.set('');
    return true;
  }

  validateContractor(value: number) {
    if (!value || value <= 0) {
      this.contractorError.set('Select a contractor');
      return false;
    }
    this.contractorError.set('');
    return true;
  }

  validateClassification(value: string) {
    if (!value || value === '') {
      this.classificationError.set('Select a classification');
      return false;
    }
    this.classificationError.set('');
    return true;
  }

  validateAadhar(value: string) {
    if (!value || value.length !== 12) {
      this.aadharError.set('Aadhar must be 12 digits');
      return false;
    }
    this.aadharError.set('');
    return true;
  }

  validateAddress(value: string) {
    if (!value || !value.trim() || value.trim().length < 5) {
      this.addressError.set('Address must be at least 5 characters');
      return false;
    }
    this.addressError.set('');
    return true;
  }

  validatePhone(value: string) {
    const phoneRe = /^\d{10}$/;
    if (!value) {
      this.phoneError.set('Phone number is required');
      return false;
    }
    if (!phoneRe.test(value)) {
      this.phoneError.set('Phone number must be 10 digits');
      return false;
    }
    this.phoneError.set('');
    return true;
  }

  validatePan(value: string) {
    if (!value) {
      this.panError.set('');
      return true;
    }
    const panRe = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
    if (!panRe.test(value)) {
      this.panError.set('Invalid PAN format (e.g. ABCDE1234F)');
      return false;
    }
    this.panError.set('');
    return true;
  }

  validateBarcode(value: string) {
    if (!value || !value.trim()) {
      this.barcodeError.set('Barcode is required');
      return false;
    }
    this.barcodeError.set('');
    return true;
  }

  ngOnInit(): void {
    // Load classifications once
    this.loadClassifications();

    if (!this.guardProfile() && !projectStore.projectId()) {
      this.notifier.showError('No project assigned. Please contact administrator.');
    }
  }

  loadContractors(projectId: number): void {
    this.loading.set(true);
    this.api
      .getContractorsByProject(projectId)
      .pipe(take(1))
      .subscribe({
        next: (response: any) => {
          this.contractors.set(response.data || []);
          this.loading.set(false);
        },
        error: (err) => {
          this.notifier.showError('Failed to load contractors');
          this.loading.set(false);
        },
      });
  }

  loadClassifications(): void {
    this.api
      .getLabourClassifications()
      .pipe(take(1))
      .subscribe({
        next: (resp: any) => {
          const list = resp.data || [];
          // API returns list of key/value pairs; map to {id,name}
          const mapped = list.map((kv: any) => ({ id: kv.key ?? kv[0], name: kv.value ?? kv[1] }));
          this.classifications.set(mapped);
          const first = mapped[0];
          if (first) this.classification = String(first.id);
        },
        error: (err: any) => {
          this.logger.warn('Failed to load classifications', err);
        },
      });
  }

  // scanBarcode() deprecated — use app-barcode-button component

  async takePhoto(): Promise<void> {
    try {
      this.notifier.clear();
      const photoData = await this.photoSvc.takePhoto();
      try {
        const resolved = await this.localImage.resolveImage(photoData, `labour_${Date.now()}.jpg`);
        this.photo.set(resolved || photoData);
      } catch (e) {
        this.photo.set(photoData);
      }
    } catch (err) {
      this.notifier.showError('Photo capture failed. Please try again.');
    }
  }


  private applyOcrResult(result: AadharOcrResult) {
    const updatedFields: string[] = [];

    if (result.aadharNumber) {
      if (this.aadharNumber !== result.aadharNumber) {
        updatedFields.push('Aadhar number');
      }
      this.aadharNumber = result.aadharNumber;
      this.validateAadhar(this.aadharNumber);
    }

    if (result.name) {
      const current = (this.name || '').trim().toLowerCase();
      const incoming = result.name.trim().toLowerCase();
      if (!current || current !== incoming) {
        this.name = result.name;
        updatedFields.push('name');
      }
      this.validateName(this.name);
    }

    if (result.address) {
      const currentAddress = (this.address || '').trim().toLowerCase();
      const incomingAddress = result.address.trim().toLowerCase();
      if (!currentAddress || currentAddress !== incomingAddress) {
        this.address = result.address;
        updatedFields.push('address');
      }
      this.validateAddress(this.address);
    }

    if (result.phoneNumber) {
      const currentPhone = (this.phone || '').trim();
      if (!currentPhone || currentPhone !== result.phoneNumber) {
        this.phone = result.phoneNumber;
        updatedFields.push('phone number');
      }
      this.validatePhone(this.phone);
    }

    if (updatedFields.length > 0) {
      const confidenceSuffix =
        typeof result.confidence === 'number'
          ? ` (confidence ${Math.round(result.confidence)}%)`
          : '';
      this.ocrMessage.set(
        `OCR captured ${updatedFields.join(', ')}${confidenceSuffix}. Review before submitting.`
      );
    } else {
      this.ocrMessage.set('Could not detect Aadhar details. Please retake the photo.');
    }
  }

  isValid(): boolean {
    // Pure read-only checks — do not call validators that write to signals here
    const nameOk = !!(this.name && this.name.trim().length >= 2);
    const phoneOk = /^\d{10}$/.test(this.phone || '') || false;
    const aadharOk = !!(this.aadharNumber && this.aadharNumber.length === 12);
    const contractorOk = !!(this.contractorId && this.contractorId > 0);
    const classOk = !!(this.classification && this.classification !== '');
    const addressOk = !!(this.address && this.address.trim().length >= 5);
    const barcodeOk = !!(this.barcode && this.barcode.trim().length > 0);

    return !!(
      nameOk &&
      phoneOk &&
      aadharOk &&
      this.photo() &&
      contractorOk &&
      classOk &&
      addressOk &&
      barcodeOk
    );
  }

  // ----- Helpers to reduce duplication -----
  private validateAll(): boolean {
    const nameOk = this.validateName(this.name);
    const phoneValid = this.validatePhone(this.phone);
    const aadharOk = this.validateAadhar(this.aadharNumber);
    const addressOk = this.validateAddress(this.address);
    const contractorOk = this.validateContractor(this.contractorId as any);
    const classOk = this.validateClassification(this.classification as any);
    const panOk = this.validatePan(this.panNumber);
    const barcodeOk = this.validateBarcode(this.barcode);

    return !!(
      nameOk &&
      phoneValid &&
      aadharOk &&
      addressOk &&
      barcodeOk &&
      contractorOk &&
      classOk &&
      panOk &&
      this.photo()
    );
  }

  private async normalizePhotoForUpload(): Promise<string | undefined> {
    if (!this.photo()) return undefined;
    const p = this.photo();
    try {
      const dataUrl = await this.localImage.getDataUrl(p);
      return dataUrl || undefined;
    } catch (e) {
      return undefined;
    }
  }

  private buildLabourPayload(photoForUpload: string | undefined, projectId: number) {
    return {
      name: this.name,
      phoneNumber: this.phone,
      aadharNumber: this.aadharNumber || undefined,
      panNumber: this.panNumber || undefined,
      address: this.address,
      photoBase64: photoForUpload || '',
      projectId,
      contractorId: this.contractorId,
      classificationId: this.classification ? Number(this.classification) : undefined,
      barcode: this.barcode || `LAB-${Date.now()}`,
    };
  }

  private async queueOfflineRegistration(
    projectId: number,
    photoForUpload?: string,
    includeEntry = false
  ) {
    const clientId = `c_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    let photoLocal: any = null;
    if (this.photo()) {
      try {
        let photoToSave = photoForUpload || this.photo();
        try {
          const dataUrl = await this.localImage.getDataUrl(photoToSave);
          if (dataUrl) photoToSave = dataUrl;
        } catch (e) {
          // ignore conversion error and continue with original
        }
        photoLocal = (await this.offline.savePhotoFromDataUrl(
          photoToSave as string,
          `labour_${Date.now()}.jpg`,
          { clientId }
        )) as { id: number; localRef: string };
      } catch (e) {
        this.logger.warn('Failed to save photo locally', e);
      }
    }

    await this.offline.saveLocalPerson({
      clientId,
      name: this.name,
      phoneNumber: this.phone,
      panNumber: this.panNumber || undefined,
      address: this.address || undefined,
      photoLocalRef: photoLocal?.localRef,
    });

    if (photoLocal && photoLocal.id) {
      await this.offline.enqueueAction('photoUpload', { photoLocalId: photoLocal.id, clientId });
    }

    const regPayload = {
      clientId,
      name: this.name,
      phoneNumber: this.phone,
      aadharNumber: this.aadharNumber || undefined,
      panNumber: this.panNumber || undefined,
      address: this.address || undefined,
      photoLocalId: photoLocal?.id || null,
      projectId,
      contractorId: this.contractorId,
      classificationId: this.classification ? Number(this.classification) : undefined,
      barcode: this.barcode || `LAB-${Date.now()}`,
    };

    await this.offline.enqueueAction('registerLabour', regPayload);

    if (includeEntry) {
      await this.offline.enqueueAction('createRecord', {
        clientId,
        personType: 'Labour',
        action: 'Entry',
      });
    }
  }

  // ----- End helpers -----

  async submit(): Promise<void> {
    const profile = this.guardProfile();
    const projectId = profile?.projectId ?? this.currentProjectId();
    if (!projectId || projectId <= 0) {
      this.notifier.showError('No project assigned. Please contact administrator.');
      return;
    }

    if (!this.validateAll()) {
      this.notifier.showError('Please fix validation errors before submitting');
      return;
    }

    this.notifier.clear();
    this.submitting.set(true);

    try {
      const photoForUpload = await this.normalizePhotoForUpload();
      if (!photoForUpload) {
        this.submitting.set(false);
        this.notifier.showError('Failed to process photo. Please retake the photo and try again.');
        return;
      }

      const payload = this.buildLabourPayload(photoForUpload, projectId);

      this.api
        .registerLabour(payload)
        .pipe(take(1))
        .subscribe({
          next: async (response: any) => {
            this.submitting.set(false);
            if (response.success) {
              this.notifier.showSuccess('Labour registered successfully!');
              setTimeout(() => this.router.navigate(['/entry-exit']), 2000);
            } else {
              this.notifier.showError(response.message || 'Failed to register labour');
            }
          },
          error: async (err) => {
            const status = err && typeof err.status === 'number' ? err.status : undefined;
            if (typeof status === 'number' && status >= 400 && status < 600) {
              const errorMsg =
                err?.error?.message || err?.message || `Registration failed (${status})`;
              this.submitting.set(false);
              this.notifier.showError(errorMsg);
              return;
            }

            try {
              await this.queueOfflineRegistration(projectId, undefined, false);
              this.submitting.set(false);
              this.notifier.showSuccess('Labour saved offline and queued for sync');
              setTimeout(() => this.router.navigate(['/entry-exit']), 800);
            } catch (queueErr) {
              this.submitting.set(false);
              this.notifier.showError('Failed to queue registration for offline sync');
              this.logger.error('Failed to enqueue offline registration', queueErr);
            }
          },
        });
    } catch (e) {
      this.submitting.set(false);
      this.notifier.showError('Failed to prepare photo for upload');
    }
  }

  async registerAndEntry(): Promise<void> {
    const profile = this.guardProfile();
    const projectId = profile?.projectId ?? this.currentProjectId();
    if (!projectId || projectId <= 0) {
      this.notifier.showError('No project assigned. Please contact administrator.');
      return;
    }

    if (!this.validateAll()) {
      this.notifier.showError('Please fix validation errors before submitting');
      return;
    }

    this.notifier.clear();
    this.submitting.set(true);

    try {
      const photoForUpload = await this.normalizePhotoForUpload();
      if (!photoForUpload) {
        this.submitting.set(false);
        this.notifier.showError('Failed to process photo. Please retake the photo and try again.');
        return;
      }

      const payload = this.buildLabourPayload(photoForUpload, projectId);

      this.api
        .registerLabour(payload)
        .pipe(take(1))
        .subscribe({
          next: async (response: any) => {
            this.submitting.set(false);
            if (response.success && response.data) {
              const data = response.data;
              const labourId = data.labourId ?? data.id;
              if (labourId) {
                try {
                  const rec = { personType: 'Labour' as const, labourId, action: 'Entry' as const };
                  const recRes = await this.api.createRecord(rec).pipe(take(1)).toPromise();
                  if (recRes && recRes.success) {
                    this.notifier.showSuccess('Registered and entry logged successfully');
                    return;
                  } else {
                    this.notifier.showError(
                      recRes?.message || 'Registered but failed to log entry'
                    );
                    return;
                  }
                } catch (err) {
                  this.logger.warn('Failed to log entry after registration', err);
                  this.notifier.showError('Registered but failed to log entry');
                  return;
                }
              }
              this.notifier.showSuccess('Labour registered successfully');
            } else {
              this.notifier.showError(response.message || 'Failed to register labour');
            }
          },
          error: async (err) => {
            const status = err && typeof err.status === 'number' ? err.status : undefined;
            if (typeof status === 'number' && status >= 400 && status < 600) {
              const errorMsg =
                err?.error?.message || err?.message || `Registration failed (${status})`;
              this.submitting.set(false);
              this.notifier.showError(errorMsg);
              return;
            }

            try {
              await this.queueOfflineRegistration(projectId, undefined, true);
              this.notifier.showSuccess(
                'Labour saved offline and queued for sync (entry will be logged)'
              );
              setTimeout(() => this.resetForm(), 800);
              } catch (queueErr) {
              this.notifier.showError('Failed to queue registration for offline sync');
              this.logger.error('Failed to enqueue offline registration', queueErr);
            } finally {
              this.submitting.set(false);
            }
          },
        });
    } catch (e) {
      this.submitting.set(false);
      this.notifier.showError('Failed to prepare photo for upload');
    }
  }

  resetForm(): void {
    this.barcode = '';
    this.name = '';
    this.phone = '';
    this.aadharNumber = '';
    this.panNumber = '';
    this.address = '';
    this.classification = '';
    this.contractorId = 0;
    this.photo.set('');
  }
}
