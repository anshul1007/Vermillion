import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { BarcodeService } from '../core/services/barcode.service';
import { ApiService } from '../core/services/api.service';
import { SyncService } from '../core/services/sync.service';
import { AuthService } from '../core/auth/auth.service';

@Component({
  selector: 'app-entry-exit',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="container">
      <div class="row mb-2">
        <div class="col-12">
          <div class="row align-center">
            <h1 class="mb-0">Entry/Exit Recording</h1>
          </div>
        </div>
      </div>

      <div class="row">
        <div class="col-12">
          <div class="card mb-2">
            <div class="card-body">
              <div class="mb-2">
                <input
                  [(ngModel)]="searchTerm"
                  placeholder="Search by name or phone"
                  (keyup.enter)="search()"
                />
              </div>
              <button class="btn mb-2" (click)="search()">🔍 Search</button>

              <div class="text-center mb-2">
                <p class="text-muted mb-0">OR</p>
              </div>

              <button class="btn btn-outline" (click)="scan()">📷 Scan Barcode</button>
            </div>
          </div>
        </div>
      </div>

      <div class="row" *ngIf="errorMessage()">
        <div class="col-12">
          <div class="text-danger mb-2">{{ errorMessage() }}</div>
        </div>
      </div>

      <div class="row" *ngIf="successMessage()">
        <div class="col-12">
          <div class="text-success mb-2">{{ successMessage() }}</div>
        </div>
      </div>

      <ng-container *ngIf="result(); else noResult">
        <div class="row">
          <div class="col-12">
            <div class="card mb-2">
              <div class="card-body">
                <div class="row align-center mb-2">
                  <div class="avatar">
                    {{ result()!.personType === 'Labour' ? '👷' : '👤' }}
                  </div>
                  <div class="flex-1">
                    <h3 class="mb-1">{{ result()!.name }}</h3>
                    <p class="text-muted mb-1">{{ result()!.personType }}</p>
                    <p class="mb-0">📞 {{ result()!.phoneNumber }}</p>
                  </div>
                </div>

                <ng-container *ngIf="result()!.hasOpenEntry; else entryBtn">
                  <button class="btn mb-1" (click)="logExit()" [disabled]="submitting()">
                    <span *ngIf="submitting(); else exitText">Logging Exit...</span>
                    <ng-template #exitText>🚪 Log Exit</ng-template>
                  </button>
                </ng-container>
                <ng-template #entryBtn>
                  <button class="btn mb-1" (click)="logEntry()" [disabled]="submitting()">
                    <span *ngIf="submitting(); else entryText">Logging Entry...</span>
                    <ng-template #entryText>✅ Log Entry</ng-template>
                  </button>
                </ng-template>
                <button class="btn btn-outline" (click)="clearResult()">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      </ng-container>

      <ng-template #noResult>
        <div class="row" *ngIf="loading()">
          <div class="col-12">
            <div class="card">
              <div class="card-body">
                <p class="text-muted mb-0">Searching...</p>
              </div>
            </div>
          </div>
        </div>
      </ng-template>
    </div>
  `
})
export class EntryExitComponent {
  private api = inject(ApiService);
  private barcodeSvc = inject(BarcodeService);
  private sync = inject(SyncService);
  private authService = inject(AuthService);
  private router = inject(Router);

  guardProfile = this.authService.guardProfile;
  searchTerm = '';
  result = signal<any>(null);
  errorMessage = signal('');
  successMessage = signal('');
  loading = signal(false);
  submitting = signal(false);

  async scan(): Promise<void> {
    try {
      this.errorMessage.set('');
      const barcode = await this.barcodeSvc.scanBarcodeWithCamera();
      this.searchByBarcode(barcode);
    } catch (err) {
      this.errorMessage.set('Barcode scan failed or cancelled');
    }
  }

  search(): void {
    if (!this.searchTerm.trim()) {
      this.errorMessage.set('Please enter search term');
      return;
    }

    this.loading.set(true);
    this.errorMessage.set('');
    
    this.api.search(this.searchTerm).subscribe({
      next: (res: any) => { 
        this.loading.set(false);
        if (res.data) {
          this.result.set(res.data);
        } else {
          this.errorMessage.set('No person found with that search term');
        }
      },
      error: () => {
        this.loading.set(false);
        this.errorMessage.set('Search failed. Person not found.');
      }
    });
  }

  searchByBarcode(barcode: string): void {
    this.loading.set(true);
    this.errorMessage.set('');
    
    this.api.search(barcode).subscribe({
      next: (res: any) => { 
        this.loading.set(false);
        if (res.data) {
          this.result.set(res.data);
        } else {
          this.errorMessage.set('No person found with that barcode');
        }
      },
      error: () => {
        this.loading.set(false);
        this.errorMessage.set('Search failed. Person not found.');
      }
    });
  }

  async logEntry(): Promise<void> {
    const r = this.result();
    const profile = this.guardProfile();
    
    if (!r || !profile) return;

    this.submitting.set(true);
    this.errorMessage.set('');
    this.successMessage.set('');

    const data = {
      projectId: profile.projectId,
      personType: r?.personType || 'Labour',
      personId: r?.id || 0,
      action: 'Entry' as const,
      clientId: `client-${Date.now()}`
    };

    try {
      await this.sync.queueOperation('EntryExitRecord', data);
      this.successMessage.set('Entry logged successfully!');
      
      setTimeout(() => {
        this.clearResult();
        this.successMessage.set('');
      }, 2000);
    } catch (err) {
      this.errorMessage.set('Failed to log entry');
    } finally {
      this.submitting.set(false);
    }
  }

  async logExit(): Promise<void> {
    const r = this.result();
    const profile = this.guardProfile();
    
    if (!r || !profile) return;

    this.submitting.set(true);
    this.errorMessage.set('');
    this.successMessage.set('');

    const data = {
      projectId: profile.projectId,
      personType: r?.personType || 'Labour',
      personId: r?.id || 0,
      action: 'Exit' as const,
      clientId: `client-${Date.now()}`
    };

    try {
      await this.sync.queueOperation('EntryExitRecord', data);
      this.successMessage.set('Exit logged successfully!');
      
      setTimeout(() => {
        this.clearResult();
        this.successMessage.set('');
      }, 2000);
    } catch (err) {
      this.errorMessage.set('Failed to log exit');
    } finally {
      this.submitting.set(false);
    }
  }

  clearResult(): void {
    this.result.set(null);
    this.searchTerm = '';
    this.errorMessage.set('');
    this.successMessage.set('');
  }

  goBack(): void {
    this.router.navigate(['/dashboard']);
  }
}
