import { Component, inject, signal, OnInit } from '@angular/core';
import { take } from 'rxjs/operators';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { PhotoService } from '../core/services/photo.service';
import { BarcodeService } from '../core/services/barcode.service';
import { ApiService } from '../core/services/api.service';
import { AuthService } from '../core/auth/auth.service';
import { LocalImageService } from '../core/services/local-image.service';
import { OfflineStorageService } from '../core/services/offline-storage.service';
import { BarcodeButtonComponent } from '../shared/components/barcode-button.component';

@Component({
  selector: 'app-labour-registration',
  standalone: true,
  imports: [CommonModule, FormsModule, BarcodeButtonComponent],
  template: `
    <div class="labour-registration-page">
      <div class="scan-toast" *ngIf="successMessage() || errorMessage()">
        <div class="toast success" *ngIf="successMessage()">{{ successMessage() }}</div>
        <div class="toast error" *ngIf="errorMessage()">{{ errorMessage() }}</div>
      </div>
      <section class="registration-hero card">
        <div class="registration-hero__heading">
          <h1>Register Labour</h1>
          <p class="registration-hero__sub" *ngIf="guardProfile()">{{ guardProfile()!.projectName }}</p>
          <p class="registration-hero__sub text-muted" *ngIf="!guardProfile()">No project assigned</p>
        </div>
        <!-- <div class="chip-actions">
          <button type="button" class="chip-button" (click)="resetForm()">Reset Form</button>
          <div class="chip-button"><app-barcode-button (scanned)="onScanned($event)" (error)="onScanError($event)"></app-barcode-button></div>
          <button type="button" class="chip-button" (click)="takePhoto()">
            <span *ngIf="photo(); else takePhotoLabel">Retake Photo</span>
            <ng-template #takePhotoLabel>Capture Photo</ng-template>
          </button>
          <button type="button" class="chip-button" (click)="goBack()">Back to Dashboard</button>
        </div> -->
      </section>

      <section class="registration-card card" *ngIf="!loading(); else loadingTpl">
        <form (ngSubmit)="submit()" class="registration-form">
          <label class="form-field">
            <span>Contractor *</span>
            <select [(ngModel)]="contractorId" name="contractor" required>
              <option [ngValue]="0">Select Contractor</option>
              <option *ngFor="let c of contractors()" [ngValue]="c.id">{{ c.name }}</option>
            </select>
          </label>

          <label class="form-field">
            <span>Worker Name *</span>
            <input [(ngModel)]="name" placeholder="Worker name" name="name" required />
          </label>

          <label class="form-field">
            <span>Phone Number *</span>
            <input [(ngModel)]="phone" placeholder="Phone number" type="tel" name="phone" required />
          </label>

          <label class="form-field">
            <span>Aadhar Number</span>
            <input [(ngModel)]="aadharNumber" placeholder="Aadhar (optional)" maxlength="12" name="aadhar" />
          </label>

          <div class="form-field">
            <span>Barcode ID</span>
            <div class="form-inline">
              <input [(ngModel)]="barcode" placeholder="Scan or enter barcode" name="barcode" />
              <app-barcode-button (scanned)="barcode = $event"></app-barcode-button>
            </div>
          </div>

          <div class="form-field">
            <span>Photo *</span>
            <button type="button" class="btn btn-outline" (click)="takePhoto()">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M4 7h3l2-3h6l2 3h3a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2z" />
                <circle cx="12" cy="13" r="4" />
              </svg>
              <span *ngIf="photo(); else photoLabel">Retake Photo</span>
              <ng-template #photoLabel><span>Take Photo</span></ng-template>
            </button>
            <div *ngIf="photo()" class="photo-preview">
              <img [src]="photo()" alt="Worker photo" />
            </div>
          </div>

          <div class="form-message error" *ngIf="errorMessage()">{{ errorMessage() }}</div>
          <div class="form-message success" *ngIf="successMessage()">{{ successMessage() }}</div>

          <button class="btn" type="submit" [disabled]="!isValid() || submitting()">
            <span *ngIf="submitting(); else submitLabel">Registering...</span>
            <ng-template #submitLabel>Register Labour Worker</ng-template>
          </button>
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
  
  guardProfile = this.authService.guardProfile;
  barcode = '';
  name = '';
  phone = '';
  aadharNumber = '';
  contractorId = 0;
  photo = signal('');
  errorMessage = signal('');
  successMessage = signal('');
  contractors = signal<any[]>([]);
  loading = signal(false);
  submitting = signal(false);

  onScanned(code: string) {
    this.barcode = code;
    this.successMessage.set('Barcode scanned');
    setTimeout(() => this.successMessage.set(''), 1500);
  }

  onScanError(err: any) {
    console.error('Scan error', err);
    this.errorMessage.set('Barcode scan failed. Try again.');
    setTimeout(() => this.errorMessage.set(''), 2000);
  }

  ngOnInit(): void {
    const profile = this.guardProfile();
    if (profile && profile.projectId) {
      this.loadContractors(profile.projectId);
    } else {
      this.errorMessage.set('No project assigned. Please contact admin.');
    }
  }

  loadContractors(projectId: number): void {
    this.loading.set(true);
    this.api.getContractorsByProject(projectId).pipe(take(1)).subscribe({
      next: (response: any) => {
        this.contractors.set(response.data || []);
        this.loading.set(false);
      },
      error: (err) => {
        this.errorMessage.set('Failed to load contractors');
        this.loading.set(false);
      }
    });
  }

  // scanBarcode() deprecated — use app-barcode-button component

  async takePhoto(): Promise<void> { 
    try {
      this.errorMessage.set('');
      const photoData = await this.photoSvc.takePhoto();
      try {
        const resolved = await this.localImage.resolveImage(photoData, `labour_${Date.now()}.jpg`);
        this.photo.set(resolved || photoData);
      } catch (e) {
        this.photo.set(photoData);
      }
    } catch (err) {
      this.errorMessage.set('Photo capture failed. Please try again.');
    }
  }

  isValid(): boolean { 
    return !!(this.name && this.phone && this.photo() && this.contractorId > 0); 
  }

  submit(): void {
    const profile = this.guardProfile();
    if (!profile) {
      this.errorMessage.set('Guard profile not loaded');
      return;
    }

    this.submitting.set(true);
    this.errorMessage.set('');
    this.successMessage.set('');

    const labourData = {
      name: this.name,
      phoneNumber: this.phone,
      aadharNumber: this.aadharNumber || undefined,
      photoBase64: this.photo(),
      projectId: profile.projectId,
      contractorId: this.contractorId,
      barcode: this.barcode || `LAB-${Date.now()}`
    };

    this.api.registerLabour(labourData).pipe(take(1)).subscribe({
      next: async (response: any) => {
        this.submitting.set(false);
        if (response.success) {
          this.successMessage.set('Labour registered successfully!');
          setTimeout(() => this.router.navigate(['/entry-exit']), 1000);
        } else {
          this.errorMessage.set(response.message || 'Failed to register labour');
        }
      },
      error: async (err) => {
        // Network or server failure — fall back to offline queue
        console.warn('Network registration failed, queuing for offline sync', err);
        try {
          // create a clientId and persist local person and photo
          const clientId = `c_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
          // ensure photo is saved locally and get base64 if needed
          let photoLocal = null as any;
          if (this.photo()) {
            // try to save the data url to offline storage; it dedupes by hash
            try {
              photoLocal = await this.offline.savePhotoFromDataUrl(this.photo(), `labour_${Date.now()}.jpg`, { clientId }) as { id: number; localRef: string };
            } catch (e) {
              console.warn('Failed to save photo locally', e);
            }
          }

          // persist a local person record for mapping
          await this.offline.saveLocalPerson({ clientId, name: this.name, phoneNumber: this.phone, photoLocalRef: photoLocal?.localRef });

          // enqueue photo upload action (will run before registration)
          if (photoLocal && photoLocal.id) {
            await this.offline.enqueueAction('photoUpload', { photoLocalId: photoLocal.id, clientId });
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
            barcode: this.barcode || `LAB-${Date.now()}`
          };

          await this.offline.enqueueAction('registerLabour', regPayload);

          this.submitting.set(false);
          this.successMessage.set('Worker saved offline and queued for sync');
          setTimeout(() => this.router.navigate(['/entry-exit']), 800);
        } catch (queueErr) {
          this.submitting.set(false);
          this.errorMessage.set('Failed to queue registration for offline sync');
          console.error('Failed to enqueue offline registration', queueErr);
        }
      }
    });
  }

  resetForm(): void {
    this.barcode = '';
    this.name = '';
    this.phone = '';
    this.aadharNumber = '';
    this.contractorId = 0;
    this.photo.set('');
  }

  goBack(): void {
    this.router.navigate(['/dashboard']);
  }
}
