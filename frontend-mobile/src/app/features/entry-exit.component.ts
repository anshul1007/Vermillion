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
    <div class="entry-exit-container">
      <div class="entry-exit-header">
        <button class="back-button" (click)="goBack()">← Back</button>
        <h1>Entry/Exit Recording</h1>
      </div>

      <div class="form-card">
        <div class="guard-project-info">
          <div class="info-label">Recording for:</div>
          <div class="info-value">{{ guardProfile()?.projectName }}</div>
        </div>

        <div class="search-section">
          <div class="search-group">
            <input 
              [(ngModel)]="searchTerm" 
              placeholder="Search by name or phone"
              class="search-input"
              (keyup.enter)="search()"
            >
            <button class="search-button" (click)="search()">
              🔍 Search
            </button>
          </div>

          <div class="divider">
            <span>OR</span>
          </div>

          <button class="scan-button-large" (click)="scan()">
            📷 Scan Barcode
          </button>
        </div>

        @if (errorMessage()) {
          <div class="error-message">{{ errorMessage() }}</div>
        }

        @if (successMessage()) {
          <div class="success-message">{{ successMessage() }}</div>
        }

        @if (result()) {
          <div class="result-card">
            <div class="person-header">
              <div class="person-icon">
                {{ result()!.personType === 'Labour' ? '👷' : '👤' }}
              </div>
              <div class="person-info">
                <h3>{{ result()!.name }}</h3>
                <p class="person-type">{{ result()!.personType }}</p>
                <p class="person-phone">📞 {{ result()!.phoneNumber }}</p>
              </div>
            </div>

            <div class="action-buttons">
              @if (result()!.hasOpenEntry) {
                <button class="exit-button" (click)="logExit()" [disabled]="submitting()">
                  @if (submitting()) {
                    Logging Exit...
                  } @else {
                    🚪 Log Exit
                  }
                </button>
              } @else {
                <button class="entry-button" (click)="logEntry()" [disabled]="submitting()">
                  @if (submitting()) {
                    Logging Entry...
                  } @else {
                    ✅ Log Entry
                  }
                </button>
              }
              <button class="cancel-button" (click)="clearResult()">Cancel</button>
            </div>
          </div>
        }

        @if (loading()) {
          <div class="loading">Searching...</div>
        }
      </div>
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
