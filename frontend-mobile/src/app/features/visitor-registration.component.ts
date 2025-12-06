import { Component, inject, signal, OnInit, effect } from '@angular/core';
import { take } from 'rxjs/operators';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ApiService } from '../core/services/api.service';
import { PhotoService } from '../core/services/photo.service';
import { AuthService } from '../core/auth/auth.service';
import { LocalImageService } from '../core/services/local-image.service';
import { OfflineStorageService } from '../core/services/offline-storage.service';
import { NotificationService } from '../core/services/notification.service';
import { projectStore } from '../core/state/project.store';

@Component({
  selector: 'app-visitor-registration',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="page">
      <!-- <div class="scan-toast" *ngIf="notifier.successMessage() || notifier.errorMessage()">
        <div class="toast success" *ngIf="notifier.successMessage()">{{ notifier.successMessage() }}</div>
        <div class="toast error" *ngIf="notifier.errorMessage()">{{ notifier.errorMessage() }}</div>
      </div> -->
      <section class="hero card">
        <div class="d-flex flex-column gap-1">
          <h1 class="page-title mb-0">Register Visitor</h1>
          <ng-container *ngIf="currentProjectId(); else noProjectTpl">
            <p class="page-subtitle mb-0">
              {{ currentProjectName() || 'Assigned project' }}
            </p>
          </ng-container>
          <ng-template #noProjectTpl>
            <p class="page-subtitle mb-0">No project assigned</p>
          </ng-template>
        </div>
      </section>

      <section class="card">
        <div class="form-message error" *ngIf="!currentProjectId()">
          Project not assigned. Please contact your administrator.
        </div>
        <form *ngIf="currentProjectId()" (ngSubmit)="submit()" class="form">
          <label class="form-field">
            <span class="text-label mb-1">Full Name *</span>
            <input
              id="name"
              [(ngModel)]="name"
              name="name"
              placeholder="Enter full name"
              required
              (ngModelChange)="validateName($event)"
              (blur)="validateName(name)"
            />
            <div class="field-error" *ngIf="nameError()">{{ nameError() }}</div>
          </label>

          <label class="form-field">
            <span class="text-label mb-1">Phone Number *</span>
            <input
              [(ngModel)]="phoneNumber"
              placeholder="Enter phone number"
              type="tel"
              name="phone"
              required
              (ngModelChange)="validatePhone($event)"
              (blur)="validatePhone(phoneNumber)"
            />
            <div class="field-error" *ngIf="phoneError()">{{ phoneError() }}</div>
          </label>

          <label class="form-field">
            <span class="text-label mb-1">Company Name</span>
            <input [(ngModel)]="companyName" placeholder="Company (optional)" name="company" />
          </label>

          <label class="form-field">
            <span class="text-label mb-1">Purpose of Visit *</span>
            <textarea
              [(ngModel)]="purpose"
              rows="3"
              placeholder="Reason for visit"
              name="purpose"
              required
              (ngModelChange)="validatePurpose($event)"
              (blur)="validatePurpose(purpose)"
            ></textarea>
            <div class="field-error" *ngIf="purposeError()">{{ purposeError() }}</div>
          </label>

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
              <img [src]="photo()" alt="Visitor photo" />
            </div>
          </div>

          <!-- <div class="form-message error" *ngIf="notifier.errorMessage()">
            {{ notifier.errorMessage() }}
          </div>
          <div class="form-message success" *ngIf="notifier.successMessage()">
            {{ notifier.successMessage() }}
          </div> -->

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
              <span *ngIf="submitting(); else registerLabel">Registering...</span>
              <ng-template #registerLabel>Register Visitor</ng-template>
            </button>
          </div>
        </form>
      </section>
    </div>
  `,
})
export class VisitorRegistrationComponent implements OnInit {
  private photoSvc = inject(PhotoService);
  private authService = inject(AuthService);
  private localImage = inject(LocalImageService);
  private api = inject(ApiService);
  private offline = inject(OfflineStorageService);
  private router = inject(Router);
  guardProfile = this.authService.guardProfile;
  currentProjectId = signal<number | null>(
    projectStore.projectId() ?? this.guardProfile()?.projectId ?? null
  );
  currentProjectName = signal<string>(
    projectStore.projectName() ?? this.guardProfile()?.projectName ?? ''
  );
  name = '';
  phoneNumber = '';
  companyName = '';
  purpose = '';
  photo = signal('');
  notifier = inject(NotificationService);
  nameError = signal('');
  phoneError = signal('');
  purposeError = signal('');
  submitting = signal(false);

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
    },
    { allowSignalWrites: true }
  );

  ngOnInit(): void {
    if (!this.currentProjectId()) {
      this.notifier.showError('No project assigned. Please contact admin.');
    }
    // Prefill support: read navigation state for quick prefill (e.g., phone number)
    try {
      const navState =
        history && history.state
          ? (history.state as { prefill?: { phoneNumber?: string; name?: string } })
          : ({ prefill: {} } as { prefill?: { phoneNumber?: string; name?: string } });
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
      this.notifier.clear();
      const photoData = await this.photoSvc.takePhoto();
      // Resolve and cache locally if needed
      try {
        const resolved = await this.localImage.resolveImage(photoData, `visitor_${Date.now()}.jpg`);
        this.photo.set(resolved || photoData);
      } catch (e) {
        this.photo.set(photoData);
      }
    } catch (err) {
      this.notifier.showError('Photo capture failed. Please try again.');
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

  validatePurpose(value: string) {
    if (!value || !value.trim() || value.trim().length < 3) {
      this.purposeError.set('Purpose must be at least 3 characters');
      return false;
    }
    this.purposeError.set('');
    return true;
  }

  isValid(): boolean {
    return !!(
      this.name &&
      this.name.trim().length >= 2 &&
      this.phoneNumber &&
      this.phoneNumber.trim().length >= 10 &&
      this.purpose &&
      this.purpose.trim().length >= 3 &&
      this.photo()
    );
  }

  /**
   * Submit visitor registration form.
   * Calls API directly for immediate registration.
   */
  submit(): void {
    const profile = this.guardProfile();
    const projectId = profile?.projectId ?? this.currentProjectId();
    if (!projectId || projectId <= 0) {
      this.notifier.showError('No project assigned. Please contact admin.');
      return;
    }

    // Run validators to set error signals before template rendering
    const nameOk = this.validateName(this.name);
    const phoneOk = this.validatePhone(this.phoneNumber);
    const purposeOk = this.validatePurpose(this.purpose);

    if (!(nameOk && phoneOk && purposeOk && this.photo())) {
      this.notifier.showError('Please fix validation errors before submitting');
      return;
    }

    this.notifier.clear();
    this.submitting.set(true);

    const visitorData = {
      name: this.name.trim(),
      phoneNumber: this.phoneNumber.trim(),
      companyName: this.companyName.trim() || undefined,
      purpose: this.purpose.trim(),
      photoBase64: this.photo(),
      projectId,
    };

    // registering visitor

    const handlers = {
      next: (res: any) => {
        this.submitting.set(false);

        if (res?.success) {
          this.notifier.showSuccess('Visitor registered successfully!');
          setTimeout(() => this.router.navigate(['/entry-exit']), 800);
        } else {
          this.notifier.showError(res?.message || 'Failed to register visitor');
        }
      },
      error: async (err: any) => {
        console.warn('Register visitor API error:', err);
        this.submitting.set(false);

        const status = err && typeof err.status === 'number' ? err.status : undefined;

        // Only fall back to offline queue for network failures (status 0 or undefined).
        // For server errors (4xx/5xx) we return and rely on the interceptor to show messages.
        if (status === 0 || typeof status === 'undefined') {
          try {
            const clientId = `c_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
            let photoLocal: any = null;
            if (this.photo()) {
              try {
                photoLocal = (await this.offline.savePhotoFromDataUrl(
                  this.photo(),
                  `visitor_${Date.now()}.jpg`,
                  { clientId }
                )) as { id: number; localRef: string };
              } catch (e) {
                console.warn('Failed to save visitor photo locally', e);
              }
            }

            await this.offline.saveLocalPerson({
              clientId,
              name: this.name,
              phoneNumber: this.phoneNumber,
              photoLocalRef: photoLocal?.localRef,
            });

            if (photoLocal && photoLocal.id) {
              await this.offline.enqueueAction('photoUpload', {
                photoLocalId: photoLocal.id,
                clientId,
              });
            }

            const payload = {
              clientId,
              name: this.name.trim(),
              phoneNumber: this.phoneNumber.trim(),
              companyName: this.companyName.trim() || undefined,
              purpose: this.purpose.trim(),
              photoLocalId: photoLocal?.id || null,
              projectId,
            };
            await this.offline.enqueueAction('registerVisitor', payload);

            this.notifier.showSuccess('Visitor saved offline and queued for sync');
            setTimeout(() => {
              this.resetForm();
              this.router.navigate(['/entry-exit']);
            }, 800);
            return;
          } catch (qErr) {
            const errorMsg =
              err?.error?.message ||
              err?.error?.Message ||
              err?.message ||
              'Failed to register visitor. Please try again.';
            this.notifier.showError(errorMsg);
            console.warn('Failed to enqueue offline visitor registration', qErr);
            return;
          }
        }

        // For server-side errors (4xx/5xx) do nothing here — interceptor already displays the message.
        return;
      },
    };

    this.api
      .registerVisitor(visitorData)
      .pipe(take(1))
      .subscribe(handlers as any);
  }

  resetForm(): void {
    this.name = '';
    this.phoneNumber = '';
    this.companyName = '';
    this.purpose = '';
    this.photo.set('');
  }

  async registerAndEntry(): Promise<void> {
    const profile = this.guardProfile();
    const projectId = profile?.projectId ?? this.currentProjectId();
    if (!projectId || projectId <= 0) {
      this.notifier.showError('No project assigned. Please contact admin.');
      return;
    }

    const nameOk = this.validateName(this.name);
    const phoneOk = this.validatePhone(this.phoneNumber);
    const purposeOk = this.validatePurpose(this.purpose);

    if (!(nameOk && phoneOk && purposeOk && this.photo())) {
      this.notifier.showError('Please fix validation errors before submitting');
      return;
    }

    this.notifier.clear();
    this.submitting.set(true);

    const visitorData = {
      name: this.name.trim(),
      phoneNumber: this.phoneNumber.trim(),
      companyName: this.companyName.trim() || undefined,
      purpose: this.purpose.trim(),
      photoBase64: this.photo(),
      projectId,
    };

    this.api
      .registerVisitor(visitorData)
      .pipe(take(1))
      .subscribe({
        next: async (res: any) => {
          this.submitting.set(false);
          if (res?.success && res.data) {
            const visitorId = res.data.id;
            if (visitorId) {
              try {
                const rec = { personType: 'Visitor' as const, visitorId, action: 'Entry' as const };
                const recRes = await this.api.createRecord(rec).pipe(take(1)).toPromise();
                if (recRes && recRes.success) {
                  this.notifier.showSuccess('Registered and entry logged successfully');
                  // remain on page so user can review or register another
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
            this.notifier.showSuccess('Visitor registered successfully');
            // remain on page
          } else {
            this.notifier.showError(res?.message || 'Failed to register visitor');
          }
        },
        error: async (err: any) => {
          this.submitting.set(false);
          console.error('Register visitor API error:', err);
          try {
            const clientId = `c_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
            let photoLocal: any = null;
            if (this.photo()) {
              try {
                photoLocal = (await this.offline.savePhotoFromDataUrl(
                  this.photo(),
                  `visitor_${Date.now()}.jpg`,
                  { clientId }
                )) as { id: number; localRef: string };
              } catch (e) {
                console.warn('Failed to save visitor photo locally', e);
              }
            }

            await this.offline.saveLocalPerson({
              clientId,
              name: this.name,
              phoneNumber: this.phoneNumber,
              photoLocalRef: photoLocal?.localRef,
            });

            if (photoLocal && photoLocal.id) {
              await this.offline.enqueueAction('photoUpload', {
                photoLocalId: photoLocal.id,
                clientId,
              });
            }

            const payload = {
              clientId,
              name: this.name.trim(),
              phoneNumber: this.phoneNumber.trim(),
              companyName: this.companyName.trim() || undefined,
              purpose: this.purpose.trim(),
              photoLocalId: photoLocal?.id || null,
              projectId,
            };
            await this.offline.enqueueAction('registerVisitor', payload);
            // enqueue createRecord action to log entry after registration
            await this.offline.enqueueAction('createRecord', {
              clientId,
              personType: 'Visitor',
              action: 'Entry',
            });

            this.notifier.showSuccess(
              'Visitor saved offline and queued for sync (entry will be logged)'
            );
            setTimeout(() => {
              this.resetForm();
              this.router.navigate(['/entry-exit']);
            }, 800);
          } catch (qErr) {
            console.error('Failed to enqueue offline visitor registration', qErr);
            this.notifier.showError('Failed to queue visitor for offline sync');
          }
        },
      });
  }
}
