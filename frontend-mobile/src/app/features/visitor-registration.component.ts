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
    <div class="registration-container">
      <div class="registration-header">
        <button class="back-button" (click)="goBack()">← Back</button>
        <h1>Register Visitor</h1>
      </div>

      <div class="form-card">
        <div class="guard-project-info">
          <div class="info-label">Registering for:</div>
          <div class="info-value">{{ guardProfile()?.projectName }}</div>
        </div>

        <div class="form-group">
          <label>Visitor Name *</label>
          <input 
            [(ngModel)]="name" 
            placeholder="Enter visitor name"
            class="form-input"
            required
          >
        </div>

        <div class="form-group">
          <label>Phone Number *</label>
          <input 
            [(ngModel)]="phoneNumber" 
            placeholder="Enter phone number"
            type="tel"
            class="form-input"
            required
          >
        </div>

        <div class="form-group">
          <label>Company Name</label>
          <input 
            [(ngModel)]="companyName" 
            placeholder="Company name (optional)"
            class="form-input"
          >
        </div>

        <div class="form-group">
          <label>Purpose of Visit *</label>
          <textarea 
            [(ngModel)]="purpose" 
            placeholder="What is the purpose of this visit?"
            class="form-textarea"
            rows="3"
            required
          ></textarea>
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
              <img [src]="photo()" alt="Visitor photo">
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
            Register Visitor
          }
        </button>
      </div>
    </div>
  `
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
      photoPath: this.photo()
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
