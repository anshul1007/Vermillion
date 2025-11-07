import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { PhotoService } from '../core/services/photo.service';
import { BarcodeService } from '../core/services/barcode.service';
import { SyncService } from '../core/services/sync.service';
import { ApiService } from '../core/services/api.service';
import { AuthService } from '../core/auth/auth.service';

@Component({
  selector: 'app-labour-registration',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="registration-container">
      <div class="registration-header">
        <button class="back-button" (click)="goBack()">← Back</button>
        <h1>Register Labour</h1>
      </div>

      @if (loading()) {
        <div class="loading">Loading...</div>
      } @else {
        <div class="form-card">
          <div class="guard-project-info">
            <div class="info-label">Registering for:</div>
            <div class="info-value">{{ guardProfile()?.projectName }}</div>
          </div>

          <div class="form-group">
            <label>Contractor *</label>
            <select [(ngModel)]="contractorId" class="form-select">
              <option [value]="0">Select Contractor</option>
              @for (c of contractors(); track c.id) {
                <option [value]="c.id">{{ c.name }}</option>
              }
            </select>
          </div>

          <div class="form-group">
            <label>Worker Name *</label>
            <input 
              [(ngModel)]="name" 
              placeholder="Enter worker name" 
              class="form-input"
              required
            >
          </div>

          <div class="form-group">
            <label>Phone Number *</label>
            <input 
              [(ngModel)]="phone" 
              placeholder="Enter phone number"
              type="tel"
              class="form-input"
              required
            >
          </div>

          <div class="form-group">
            <label>Barcode ID</label>
            <div class="barcode-group">
              <input 
                [(ngModel)]="barcode" 
                placeholder="Scan or enter barcode"
                class="form-input"
              >
              <button class="scan-button" (click)="scanBarcode()">
                📷 Scan
              </button>
            </div>
          </div>

          <div class="form-group">
            <label>Photo *</label>
            <button class="photo-button" (click)="takePhoto()">
              @if (photo()) {
                📸 Retake Photo
              } @else {
                📸 Take Photo
              }
            </button>
            @if (photo()) {
              <div class="photo-preview">
                <img [src]="photo()" alt="Worker photo">
              </div>
            }
          </div>

          @if (errorMessage()) {
            <div class="error-message">{{ errorMessage() }}</div>
          }

          @if (successMessage()) {
            <div class="success-message">{{ successMessage() }}</div>
          }

          <button 
            class="submit-button" 
            (click)="submit()" 
            [disabled]="!isValid() || submitting()"
          >
            @if (submitting()) {
              Registering...
            } @else {
              Register Labour Worker
            }
          </button>
        </div>
      }
    </div>
  `
})
export class LabourRegistrationComponent implements OnInit {
  private sync = inject(SyncService);
  private photoSvc = inject(PhotoService);
  private barcodeSvc = inject(BarcodeService);
  private api = inject(ApiService);
  private authService = inject(AuthService);
  private router = inject(Router);
  
  guardProfile = this.authService.guardProfile;
  barcode = ''; 
  name = ''; 
  phone = '';
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
      next: (contractors) => {
        this.contractors.set(contractors);
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

  async submit(): Promise<void> {
    const profile = this.guardProfile();
    if (!profile) {
      this.errorMessage.set('Guard profile not loaded');
      return;
    }

    this.submitting.set(true);
    this.errorMessage.set('');
    this.successMessage.set('');

    const labourData = {
      projectId: profile.projectId,
      contractorId: this.contractorId,
      barcode: this.barcode || `LAB-${Date.now()}`,
      photoPath: this.photo(),
      name: this.name,
      phoneNumber: this.phone
    };
    
    try {
      await this.sync.queueOperation('LabourRegistration', labourData);
      this.successMessage.set('Labour registered successfully!');
      
      // Reset form after 2 seconds
      setTimeout(() => {
        this.resetForm();
        this.successMessage.set('');
      }, 2000);
    } catch (err) {
      this.errorMessage.set('Failed to register labour. Please try again.');
    } finally {
      this.submitting.set(false);
    }
  }

  resetForm(): void {
    this.barcode = '';
    this.name = '';
    this.phone = '';
    this.contractorId = 0;
    this.photo.set('');
  }

  goBack(): void {
    this.router.navigate(['/dashboard']);
  }
}
