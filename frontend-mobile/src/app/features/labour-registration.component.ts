import { Component, inject, signal, OnInit } from '@angular/core';
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
    <div class="container">
      <div class="row mb-2">
        <div class="col-12">
          <div class="row align-center">
            <h1 class="mb-0">Register Labour</h1>
          </div>
        </div>
      </div>

      <ng-container *ngIf="loading(); else formTemplate">
        <div class="row">
          <div class="col-12">
            <div class="card">
              <div class="card-body">
                <p class="text-muted mb-0">Loading...</p>
              </div>
            </div>
          </div>
        </div>
      </ng-container>

      <ng-template #formTemplate>
        <div class="row">
          <div class="col-12">
            <div class="card mb-2">
              <div class="card-body">
                <p class="text-muted mb-1">Registering for:</p>
                <h3 class="mb-0">{{ guardProfile()?.projectName }}</h3>
              </div>
            </div>
          </div>
        </div>

        <div class="row">
          <div class="col-12">
            <div class="card mb-2">
              <div class="card-body">
                <div class="mb-2">
                  <label>Contractor *</label>
                  <select [(ngModel)]="contractorId">
                    <option [ngValue]="0">Select Contractor</option>
                    <option *ngFor="let c of contractors()" [ngValue]="c.id">{{ c.name }}</option>
                  </select>
                </div>

                <div class="mb-2">
                  <label>Worker Name *</label>
                  <input [(ngModel)]="name" placeholder="Enter worker name" required />
                </div>

                <div class="mb-2">
                  <label>Phone Number *</label>
                  <input [(ngModel)]="phone" placeholder="Enter phone number" type="tel" required />
                </div>

                <div class="mb-2">
                  <label>Aadhar Number</label>
                  <input [(ngModel)]="aadharNumber" placeholder="Enter Aadhar number (optional)" type="text" maxlength="12" />
                </div>

                <div class="mb-2">
                  <label>Barcode ID</label>
                  <div class="row align-center mb-1">
                    <input [(ngModel)]="barcode" placeholder="Scan or enter barcode" class="flex-1" />
                  </div>
                  <button class="btn btn-outline" (click)="scanBarcode()">📷 Scan Barcode</button>
                </div>

                <div class="mb-2">
                  <label>Photo *</label>
                  <button class="btn mb-1" (click)="takePhoto()">
                    <span *ngIf="photo(); else takePhotoTpl">📸 Retake Photo</span>
                    <ng-template #takePhotoTpl>📸 Take Photo</ng-template>
                  </button>
                  <div *ngIf="photo()" class="photo-preview">
                    <img [src]="photo()" alt="Worker photo" />
                  </div>
                </div>

                <div *ngIf="errorMessage()" class="text-danger mb-2">{{ errorMessage() }}</div>
                <div *ngIf="successMessage()" class="text-success mb-2">{{ successMessage() }}</div>

                <button class="btn" (click)="submit()" [disabled]="!isValid() || submitting()">
                  <span *ngIf="submitting(); else notSubmitting">Registering...</span>
                  <ng-template #notSubmitting>Register Labour Worker</ng-template>
                </button>
              </div>
            </div>
          </div>
        </div>
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
    this.api.getContractorsByProject(projectId).subscribe({
      next: (response) => {
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

    this.api.registerLabour(labourData).subscribe({
      next: (response) => {
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
