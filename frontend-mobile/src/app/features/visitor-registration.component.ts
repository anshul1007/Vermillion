import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { PhotoService } from '../core/services/photo.service';
import { SyncService } from '../core/services/sync.service';
import { AuthService } from '../core/auth/auth.service';

@Component({
  selector: 'app-visitor-registration',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="container">
      <div class="row mb-2">
        <div class="col-12">
          <div class="row align-center">
            <h1 class="mb-0">Register Visitor</h1>
          </div>
        </div>
      </div>

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
                <label for="name">Full Name *</label>
                <input
                  id="name"
                  [(ngModel)]="name"
                  name="name"
                  placeholder="Enter full name"
                  required
                />
              </div>

              <div class="mb-2">
                <label>Phone Number *</label>
                <input
                  [(ngModel)]="phoneNumber"
                  placeholder="Enter phone number"
                  type="tel"
                  required
                />
              </div>

              <div class="mb-2">
                <label>Company Name</label>
                <input
                  [(ngModel)]="companyName"
                  placeholder="Company name (optional)"
                />
              </div>

              <div class="mb-2">
                <label>Purpose of Visit *</label>
                <textarea
                  [(ngModel)]="purpose"
                  rows="3"
                  placeholder="Enter purpose of visit"
                  required
                ></textarea>
              </div>

              <div class="mb-2">
                <label>Photo *</label>
                <button class="btn mb-1" (click)="takePhoto()">
                  <span *ngIf="photo(); else takePhotoLabel">📸 Retake Photo</span>
                  <ng-template #takePhotoLabel>📸 Take Photo</ng-template>
                </button>
                <div *ngIf="photo()" class="photo-preview">
                  <img [src]="photo()" alt="Visitor photo" />
                </div>
              </div>

              <div *ngIf="errorMessage()" class="text-danger mb-2">{{ errorMessage() }}</div>
              <div *ngIf="successMessage()" class="text-success mb-2">{{ successMessage() }}</div>

              <button class="btn" (click)="submit()" [disabled]="!isValid() || submitting()">
                <span *ngIf="submitting(); else registerLabel">Registering...</span>
                <ng-template #registerLabel>Register Visitor</ng-template>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
})
export class VisitorRegistrationComponent implements OnInit {
  private sync = inject(SyncService);
  private photoSvc = inject(PhotoService);
  private authService = inject(AuthService);
  private router = inject(Router);

  guardProfile = this.authService.guardProfile;
  name = '';
  phoneNumber = '';
  companyName = '';
  purpose = '';
  photo = signal('');
  errorMessage = signal('');
  successMessage = signal('');
  submitting = signal(false);

  ngOnInit(): void {
    if (!this.guardProfile()) {
      this.errorMessage.set('No project assigned. Please contact admin.');
    }
  }

  async takePhoto(): Promise<void> {
    try {
      this.errorMessage.set('');
      const photoData = await this.photoSvc.takePhoto();
      this.photo.set(photoData);
    } catch (err) {
      this.errorMessage.set('Photo capture failed. Please try again.');
    }
  }

  isValid(): boolean {
    return !!(
      this.name.trim() &&
      this.phoneNumber.trim() &&
      this.purpose.trim() &&
      this.photo()
    );
  }

  async submit(): Promise<void> {
    const profile = this.guardProfile();
    if (!profile) {
      this.errorMessage.set('Guard profile not loaded');
      return;
    }

    if (!this.isValid()) {
      this.errorMessage.set('Please fill all required fields and take a photo.');
      return;
    }

    this.submitting.set(true);
    this.errorMessage.set('');
    this.successMessage.set('');

    const visitorData = {
      projectId: profile.projectId,
      name: this.name.trim(),
      phoneNumber: this.phoneNumber.trim(),
      companyName: this.companyName.trim() || undefined,
      purpose: this.purpose.trim(),
      photoPath: this.photo(),
    };

    try {
      await this.sync.queueOperation('VisitorRegistration', visitorData);
      this.successMessage.set('Visitor registered successfully!');

      // Reset form after 2 seconds
      setTimeout(() => {
        this.resetForm();
        this.successMessage.set('');
      }, 2000);
    } catch (err) {
      this.errorMessage.set('Failed to register visitor. Please try again.');
    } finally {
      this.submitting.set(false);
    }
  }

  resetForm(): void {
    this.name = '';
    this.phoneNumber = '';
    this.companyName = '';
    this.purpose = '';
    this.photo.set('');
  }

  goBack(): void {
    this.router.navigate(['/dashboard']);
  }
}

