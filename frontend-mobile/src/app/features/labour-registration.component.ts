import { Component, inject, signal, OnInit } from '@angular/core';
import { take } from 'rxjs/operators';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { PhotoService } from '../core/services/photo.service';
import { BarcodeService } from '../core/services/barcode.service';
import { ApiService } from '../core/services/api.service';
import { AuthService } from '../core/auth/auth.service';

@Component({
  selector: 'app-labour-registration',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="labour-registration-page">
      <section class="registration-hero card">
        <div class="registration-hero__heading">
          <h1>Register Labour</h1>
          <p class="registration-hero__sub" *ngIf="guardProfile()">{{ guardProfile()!.projectName }}</p>
          <p class="registration-hero__sub text-muted" *ngIf="!guardProfile()">No project assigned</p>
        </div>
        <div class="chip-actions">
          <button type="button" class="chip-button" (click)="resetForm()">Reset Form</button>
          <button type="button" class="chip-button" (click)="scanBarcode()">Scan Barcode</button>
          <button type="button" class="chip-button" (click)="takePhoto()">
            <span *ngIf="photo(); else takePhotoLabel">Retake Photo</span>
            <ng-template #takePhotoLabel>Capture Photo</ng-template>
          </button>
          <button type="button" class="chip-button" (click)="goBack()">Back to Dashboard</button>
        </div>
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
              <button type="button" class="btn btn-outline" (click)="scanBarcode()">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M3 5h2" />
                  <path d="M17 5h2" />
                  <path d="M7 5v14" />
                  <path d="M11 5v14" />
                  <path d="M15 5v14" />
                  <path d="M19 5v14" />
                  <path d="M3 19h18" />
                </svg>
                <span>Scan</span>
              </button>
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

  async scanBarcode(): Promise<void> { 
    try {
      this.errorMessage.set('');
      this.barcode = await this.barcodeSvc.scanBarcodeWithCamera(); 
    } catch (err) {
      this.errorMessage.set('Barcode scan failed. You can enter manually.');
    }
  }

  async takePhoto(): Promise<void> { 
    try {
      this.errorMessage.set('');
      this.photo.set(await this.photoSvc.takePhoto()); 
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
      next: (response: any) => {
        this.submitting.set(false);
        if (response.success) {
          this.successMessage.set('Labour registered successfully!');

          // Navigate back to entry-exit after 1.5 seconds
          setTimeout(() => {
            this.router.navigate(['/entry-exit']);
          }, 1000);
        } else {
          this.errorMessage.set(response.message || 'Failed to register labour');
        }
      },
      error: (err) => {
        this.submitting.set(false);
        this.errorMessage.set('Failed to register labour. Please try again.');
        console.error('Labour registration error:', err);
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
