import { Component, inject, signal, OnInit } from '@angular/core';
import { take } from 'rxjs/operators';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ApiService } from '../core/services/api.service';
import { PhotoService } from '../core/services/photo.service';
import { AuthService } from '../core/auth/auth.service';

@Component({
  selector: 'app-visitor-registration',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="visitor-registration-page">
      <section class="registration-hero card">
        <div class="registration-hero__heading">
          <h1>Register Visitor</h1>
          <p class="registration-hero__sub" *ngIf="guardProfile()">{{ guardProfile()!.projectName }}</p>
          <p class="registration-hero__sub text-muted" *ngIf="!guardProfile()">No project assigned</p>
        </div>
        <div class="chip-actions">
          <button type="button" class="chip-button" (click)="resetForm()">Reset Form</button>
          <button type="button" class="chip-button" (click)="takePhoto()">
            <span *ngIf="photo(); else takeLabel">Retake Photo</span>
            <ng-template #takeLabel>Capture Photo</ng-template>
          </button>
          <button type="button" class="chip-button" (click)="goBack()">Back to Dashboard</button>
        </div>
      </section>

      <section class="registration-card card">
        <form (ngSubmit)="submit()" class="registration-form">
          <label class="form-field">
            <span>Full Name *</span>
            <input
              id="name"
              [(ngModel)]="name"
              name="name"
              placeholder="Full name"
              required
            />
          </label>

          <label class="form-field">
            <span>Phone Number *</span>
            <input
              [(ngModel)]="phoneNumber"
              placeholder="Phone number"
              type="tel"
              name="phone"
              required
            />
          </label>

          <label class="form-field">
            <span>Company Name</span>
            <input
              [(ngModel)]="companyName"
              placeholder="Company (optional)"
              name="company"
            />
          </label>

          <label class="form-field">
            <span>Purpose of Visit *</span>
            <textarea
              [(ngModel)]="purpose"
              rows="3"
              placeholder="Purpose of visit"
              name="purpose"
              required
            ></textarea>
          </label>

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
              <img [src]="photo()" alt="Visitor photo" />
            </div>
          </div>

          <div class="form-message error" *ngIf="errorMessage()">{{ errorMessage() }}</div>
          <div class="form-message success" *ngIf="successMessage()">{{ successMessage() }}</div>

          <button class="btn" type="submit" [disabled]="!isValid() || submitting()">
            <span *ngIf="submitting(); else registerLabel">Registering...</span>
            <ng-template #registerLabel>Register Visitor</ng-template>
          </button>
        </form>
      </section>
    </div>
  `,
})
export class VisitorRegistrationComponent implements OnInit {
  private photoSvc = inject(PhotoService);
  private authService = inject(AuthService);
  private api = inject(ApiService);
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
    // Prefill support: read navigation state for quick prefill (e.g., phone number)
    try {
      const navState = (history && history.state) ? (history.state as { prefill?: { phoneNumber?: string; name?: string } }) : { prefill: {} } as { prefill?: { phoneNumber?: string; name?: string } };
      if (navState?.prefill?.phoneNumber) {
        this.phoneNumber = navState.prefill.phoneNumber;
      }
      if (navState?.prefill?.name) {
        this.name = navState.prefill.name;
      }
    } catch (e) {
      // ignore malformed state
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

  /**
   * Submit visitor registration form.
   * Calls API directly for immediate registration.
   */
  submit(): void {
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
      name: this.name.trim(),
      phoneNumber: this.phoneNumber.trim(),
      companyName: this.companyName.trim() || undefined,
      purpose: this.purpose.trim(),
      photoBase64: this.photo(),
      projectId: profile.projectId
    };

    console.log('Registering visitor with data:', visitorData);

    this.api.registerVisitor(visitorData).pipe(take(1)).subscribe({
      next: (res: any) => {
        console.log('Visitor registration response:', res);
        this.submitting.set(false);
        
        if (res?.success) {
          this.successMessage.set('Visitor registered successfully!');
          setTimeout(() => {
            this.resetForm();
            this.router.navigate(['/entry-exit']);
          }, 2000);
        } else {
          this.errorMessage.set(res?.message || 'Failed to register visitor');
        }
      },
      error: (err) => {
        console.error('Register visitor API error:', err);
        console.error('Error details:', err.error);
        this.submitting.set(false);
        
        const errorMsg = err.error?.message || err.error?.Message || err.message || 'Failed to register visitor. Please try again.';
        this.errorMessage.set(errorMsg);
      }
    });
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

