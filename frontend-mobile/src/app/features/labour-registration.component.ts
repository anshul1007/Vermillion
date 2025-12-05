import { Component, inject, signal, OnInit } from '@angular/core';
import { take } from 'rxjs/operators';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { PhotoService } from '../core/services/photo.service';
import { NotificationService } from '../core/services/notification.service';
import { BarcodeService } from '../core/services/barcode.service';
import { ApiService } from '../core/services/api.service';
import { AuthService } from '../core/auth/auth.service';
import { LocalImageService } from '../core/services/local-image.service';
import { OfflineStorageService } from '../core/services/offline-storage.service';
import { OcrService, AadharOcrResult } from '../core/services/ocr.service';
import { BarcodeButtonComponent } from '../shared/components/barcode-button.component';

@Component({
  selector: 'app-labour-registration',
  standalone: true,
  imports: [CommonModule, FormsModule, BarcodeButtonComponent],
  template: `
    <div class="labour-registration-page">
      <div class="scan-toast" *ngIf="notifier.successMessage() || notifier.errorMessage()">
        <div class="toast success" *ngIf="notifier.successMessage()">{{ notifier.successMessage() }}</div>
        <div class="toast error" *ngIf="notifier.errorMessage()">{{ notifier.errorMessage() }}</div>
      </div>
      <section class="registration-hero card">
        <div class="registration-hero__heading">
          <h1>Register Labour</h1>
          <p class="registration-hero__sub" *ngIf="guardProfile()">
            {{ guardProfile()!.projectName }}
          </p>
          <p class="registration-hero__sub text-muted" *ngIf="!guardProfile()">
            No project assigned
          </p>
        </div>
      </section>

      <section class="registration-card card" *ngIf="!loading(); else loadingTpl">
        <form (ngSubmit)="submit()" class="registration-form">
          <label class="form-field">
            <span>Contractor *</span>
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
            <span>Labour Name *</span>
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
              class="btn btn-outline"
              (click)="scanAadhar()"
              [disabled]="ocrInProgress() || submitting()"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
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
            <span>Classification *</span>
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
            <span>Phone Number *</span>
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
            <span>Aadhar Number *</span>
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
            <span>PAN Number</span>
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
            <span>Address *</span>
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
            <span>Barcode ID *</span>
            <div class="form-inline">
              <input [(ngModel)]="barcode" placeholder="Scan or enter barcode" name="barcode" required (ngModelChange)="validateBarcode($event)" />
              <app-barcode-button
                (scanned)="onScanned($event)"
                (error)="onScanError($event)"
              ></app-barcode-button>
            </div>
            <div class="field-error" *ngIf="barcodeError()">{{ barcodeError() }}</div>
          </div>

          <div class="form-field">
            <span>Photo *</span>
            <button type="button" class="btn btn-outline" (click)="takePhoto()">
              <svg
                xmlns="http://www.w3.org/2000/svg"
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

          <div class="form-message error" *ngIf="notifier.errorMessage()">{{ notifier.errorMessage() }}</div>
          <div class="form-message success" *ngIf="notifier.successMessage()">{{ notifier.successMessage() }}</div>

          <div class="form-actions">
            <button
              class="btn btn-primary primary-action"
              type="button"
              (click)="registerAndEntry()"
              [disabled]="!isValid() || submitting()"
            >
              Register & Log Entry
            </button>
            <button class="btn" type="submit" [disabled]="!isValid() || submitting()">
              <span *ngIf="submitting(); else submitLabel">Registering...</span>
              <ng-template #submitLabel>Register Labour</ng-template>
            </button>
          </div>
        </form>
      </section>

      <ng-template #loadingTpl>
        <section class="registration-card card">
          <p class="registration-loading">Loading contractors...</p>
        </section>
      </ng-template>
    </div>
  `,
})
export class LabourRegistrationComponent implements OnInit {
  private photoSvc = inject(PhotoService);
  private barcodeSvc = inject(BarcodeService);
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
  loading = signal(false);
  submitting = signal(false);
  ocrInProgress = signal(false);
  ocrProgress = signal(0);
  ocrMessage = signal('');

  onScanned(code: string) {
    this.barcode = code;
    this.notifier.showSuccess('Barcode scanned', 1500);
    this.barcodeError.set('');
    setTimeout(() => this.notifier.clear(), 1500);
  }

  onScanError(err: any) {
    console.error('Scan error', err);
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
      console.error('Failed to capture Aadhar card image', err);
      this.notifier.showError('Could not capture the Aadhar card. Try again in better lighting.');
      return;
    }

    this.ocrInProgress.set(true);
    this.ocrProgress.set(0);

    try {
      const result = await this.ocrService.extractAadharFields(cardImage, (progress) => {
        console.log('OCR Progress:', progress);
        this.ocrProgress.set(progress);
      });
      this.applyOcrResult(result);
    } catch (err) {
      console.error('OCR failed', err);
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
    const profile = this.guardProfile();
    if (profile && profile.projectId) {
      this.loadContractors(profile.projectId);
      this.loadClassifications();
    } else {
      this.notifier.showError('No project assigned. Please contact admin.');
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
          console.warn('Failed to load classifications', err);
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

  private async blobUrlToDataUrl(blobUrl: string): Promise<string> {
    try {
      const resp = await fetch(blobUrl);
      const blob = await resp.blob();
      return await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error('Failed to read blob'));
        reader.onload = () => resolve(String(reader.result));
        reader.readAsDataURL(blob);
      });
    } catch (e) {
      return blobUrl; // fallback to original
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

  async submit(): Promise<void> {
    const profile = this.guardProfile();
    if (!profile) {
      this.notifier.showError('Guard profile not loaded');
      return;
    }

    // Run validators to set error signals before proceeding
    const nameOk = this.validateName(this.name);
    const phoneValid = this.validatePhone(this.phone);
    const aadharOk = this.validateAadhar(this.aadharNumber);
    const addressOk = this.validateAddress(this.address);
    const contractorOk = this.validateContractor(this.contractorId as any);
    const classOk = this.validateClassification(this.classification as any);
    const panOk = this.validatePan(this.panNumber);
    const barcodeOk = this.validateBarcode(this.barcode);

    if (
      !(
        nameOk &&
        phoneValid &&
        aadharOk &&
        addressOk &&
        barcodeOk &&
        contractorOk &&
        classOk &&
        panOk &&
        this.photo()
      )
    ) {
      this.notifier.showError('Please fix validation errors before submitting');
      return;
    }

    this.notifier.clear();
    this.submitting.set(true);

    // Ensure photo is a data URL before sending (handle blob: URLs produced by browser capture)
    let photoForUpload: string | undefined = undefined;
    if (this.photo()) {
      const p = this.photo();
      if (p.startsWith('blob:')) {
        photoForUpload = await this.blobUrlToDataUrl(p);
      } else {
        photoForUpload = p;
      }
    }

    const labourData = {
      name: this.name,
      phoneNumber: this.phone,
      aadharNumber: this.aadharNumber || undefined,
      panNumber: this.panNumber || undefined,
      address: this.address,
      photoBase64: photoForUpload || '',
      projectId: profile.projectId,
      contractorId: this.contractorId,
      classificationId: this.classification ? Number(this.classification) : undefined,
      barcode: this.barcode || `LAB-${Date.now()}`,
    };

    this.api
      .registerLabour(labourData)
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
          console.warn('Register labour API error:', err);
          const status = err && typeof err.status === 'number' ? err.status : undefined;

          // Treat HTTP 4xx/5xx as errors: show message and do not enqueue.
          if (typeof status === 'number' && status >= 400 && status < 600) {
            const errorMsg = err?.error?.message || err?.message || `Registration failed (${status})`;
            this.submitting.set(false);
            this.notifier.showError(errorMsg);
            return;
          }

          // Network or unknown failure — fall back to offline queue
          console.warn('Network registration failed, queuing for offline sync', err);
          try {
            // create a clientId and persist local person and photo
            const clientId = `c_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
            // ensure photo is saved locally and get base64 if needed
            let photoLocal = null as any;
            if (this.photo()) {
              // normalize blob: URL to data URL before saving
              let photoToSave = this.photo();
              if (photoToSave && photoToSave.startsWith('blob:')) {
                try {
                  photoToSave = await this.blobUrlToDataUrl(photoToSave);
                } catch (e) {
                  console.warn('Failed to convert blob URL to data URL', e);
                }
              }

              // try to save the data url to offline storage; it dedupes by hash
              try {
                photoLocal = (await this.offline.savePhotoFromDataUrl(
                  photoToSave as string,
                  `labour_${Date.now()}.jpg`,
                  { clientId }
                )) as { id: number; localRef: string };
              } catch (e) {
                console.warn('Failed to save photo locally', e);
              }
            }

            // persist a local person record for mapping
            await this.offline.saveLocalPerson({
              clientId,
              name: this.name,
              phoneNumber: this.phone,
              photoLocalRef: photoLocal?.localRef,
            });

            // enqueue photo upload action (will run before registration)
            if (photoLocal && photoLocal.id) {
              await this.offline.enqueueAction('photoUpload', {
                photoLocalId: photoLocal.id,
                clientId,
              });
            }

            // enqueue registration action referencing clientId (server id will be patched later)
            const regPayload = {
              clientId,
              name: this.name,
              phoneNumber: this.phone,
              aadharNumber: this.aadharNumber || undefined,
              // include pointer to photoLocalId so SyncService can replace with server photoPath after upload
              photoLocalId: photoLocal?.id || null,
              projectId: profile.projectId,
              contractorId: this.contractorId,
              classificationId: this.classification ? Number(this.classification) : undefined,
              barcode: this.barcode || `LAB-${Date.now()}`,
            };

            await this.offline.enqueueAction('registerLabour', regPayload);

            this.submitting.set(false);
            this.notifier.showSuccess('Labour saved offline and queued for sync');
            // navigate to entry-exit so user can view record
            setTimeout(() => this.router.navigate(['/entry-exit']), 800);
          } catch (queueErr) {
            this.submitting.set(false);
            this.notifier.showError('Failed to queue registration for offline sync');
            console.error('Failed to enqueue offline registration', queueErr);
          }
        },
      });
  }

  async registerAndEntry(): Promise<void> {
    const profile = this.guardProfile();
    if (!profile) {
      this.notifier.showError('Guard profile not loaded');
      return;
    }

    // Run validators
    const nameOk = this.validateName(this.name);
    const phoneValid = this.validatePhone(this.phone);
    const aadharOk = this.validateAadhar(this.aadharNumber);
    const addressOk = this.validateAddress(this.address);
    const contractorOk = this.validateContractor(this.contractorId as any);
    const classOk = this.validateClassification(this.classification as any);
    const panOk = this.validatePan(this.panNumber);
    const barcodeOk = this.validateBarcode(this.barcode);

    if (
      !(
        nameOk &&
        phoneValid &&
        aadharOk &&
        addressOk &&
        barcodeOk &&
        contractorOk &&
        classOk &&
        panOk &&
        this.photo()
      )
    ) {
      this.notifier.showError('Please fix validation errors before submitting');
      return;
    }

    this.notifier.clear();
    this.submitting.set(true);

    // Ensure photo is a data URL before sending (handle blob: URLs produced by browser capture)
    let photoForUpload: string | undefined = undefined;
    if (this.photo()) {
      const p = this.photo();
      if (p.startsWith('blob:')) {
        photoForUpload = await this.blobUrlToDataUrl(p);
      } else {
        photoForUpload = p;
      }
    }

    const labourData = {
      name: this.name,
      phoneNumber: this.phone,
      aadharNumber: this.aadharNumber || undefined,
      panNumber: this.panNumber || undefined,
      address: this.address,
      photoBase64: photoForUpload || '',
      projectId: profile.projectId,
      contractorId: this.contractorId,
      classificationId: this.classification ? Number(this.classification) : undefined,
      barcode: this.barcode || `LAB-${Date.now()}`,
    };

    this.api
      .registerLabour(labourData)
      .pipe(take(1))
      .subscribe({
        next: async (response: any) => {
          this.submitting.set(false);
          if (response.success && response.data) {
            const data = response.data;
            // prefer labourId if returned, otherwise id
            const labourId = data.labourId ?? data.id;
            if (labourId) {
              // create entry record
              try {
                const rec = { personType: 'Labour' as const, labourId, action: 'Entry' as const };
                const recRes = await this.api.createRecord(rec).pipe(take(1)).toPromise();
                if (recRes && recRes.success) {
                  this.notifier.showSuccess('Registered and entry logged successfully');
                  return;
                } else {
                  this.notifier.showError(recRes?.message || 'Registered but failed to log entry');
                  return;
                }
              } catch (err) {
                console.warn('Failed to log entry after registration', err);
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
          console.warn('Register & entry API error:', err);
          const status = err && typeof err.status === 'number' ? err.status : undefined;

          // Treat HTTP 4xx/5xx as errors: show message and do not enqueue.
          if (typeof status === 'number' && status >= 400 && status < 600) {
            const errorMsg = err?.error?.message || err?.message || `Registration failed (${status})`;
            this.submitting.set(false);
            this.notifier.showError(errorMsg);
            return;
          }

          // Network failure — queue for offline sync
          this.submitting.set(false);
          try {
            const clientId = `c_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
            let photoLocal: any = null;
            if (this.photo()) {
              try {
                // use normalized data URL when saving locally
                const photoToSave = photoForUpload || this.photo();
                photoLocal = (await this.offline.savePhotoFromDataUrl(
                  photoToSave as string,
                  `labour_${Date.now()}.jpg`,
                  { clientId }
                )) as { id: number; localRef: string };
              } catch (e) {
                console.warn('Failed to save photo locally', e);
              }
            }

            await this.offline.saveLocalPerson({
              clientId,
              name: this.name,
              phoneNumber: this.phone,
              photoLocalRef: photoLocal?.localRef,
            });

            if (photoLocal && photoLocal.id) {
              await this.offline.enqueueAction('photoUpload', {
                photoLocalId: photoLocal.id,
                clientId,
              });
            }

            const regPayload = {
              clientId,
              name: this.name,
              phoneNumber: this.phone,
              aadharNumber: this.aadharNumber || undefined,
              photoLocalId: photoLocal?.id || null,
              projectId: profile.projectId,
              contractorId: this.contractorId,
              classificationId: this.classification ? Number(this.classification) : undefined,
              barcode: this.barcode || `LAB-${Date.now()}`,
            };

            await this.offline.enqueueAction('registerLabour', regPayload);
            // enqueue an entry action referencing clientId so sync can process it after registration
            await this.offline.enqueueAction('createRecord', {
              clientId,
              personType: 'Labour',
              action: 'Entry',
            });

            this.notifier.showSuccess('Labour saved offline and queued for sync (entry will be logged)');
            setTimeout(() => this.resetForm(), 800);
          } catch (queueErr) {
            this.notifier.showError('Failed to queue registration for offline sync');
            console.error('Failed to enqueue offline registration', queueErr);
          }
        },
      });
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

  goBack(): void {
    this.router.navigate(['/dashboard']);
  }
}
