import { Component, inject, signal } from '@angular/core';
import { take } from 'rxjs/operators';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ApiService } from '../../core/services/api.service';

interface SearchResult {
  id: number;
  name: string;
  phoneNumber: string;
  personType: 'Labour' | 'Visitor';
  barcode?: string;
  projectId?: number;
  contractorId?: number;
  companyName?: string;
  purpose?: string;
  hasOpenEntry: boolean;
}

@Component({
  selector: 'app-search',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="search-container">
      <div class="search-header">
        <button class="back-btn" (click)="goBack()">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
        </button>
        <h1>Search</h1>
      </div>

      <div class="search-box">
        <input
          type="text"
          [(ngModel)]="searchQuery"
          (input)="onSearchQueryChange()"
          placeholder="Search by name, phone, or barcode..."
          class="search-input"
        />
        @if (searchQuery()) {
          <button class="clear-btn" (click)="clearSearch()">�</button>
        }
      </div>

      @if (searching()) {
        <div class="loading">
          <div class="spinner"></div>
          <p>Searching...</p>
        </div>
      }

      @if (errorMessage()) {
        <div class="error-message">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <span>{{ errorMessage() }}</span>
        </div>
      }

      @if (searchResult()) {
        <div class="result-card">
          <div class="result-header">
            <div class="person-type" [class.labour]="searchResult()!.personType === 'Labour'" [class.visitor]="searchResult()!.personType === 'Visitor'">
              {{ searchResult()!.personType }}
            </div>
            @if (searchResult()!.hasOpenEntry) {
              <div class="open-entry-badge">Open Entry</div>
            }
          </div>

          <div class="result-body">
            <div class="info-row">
              <span class="label">Name:</span>
              <span class="value">{{ searchResult()!.name }}</span>
            </div>
            <div class="info-row">
              <span class="label">Phone:</span>
              <span class="value">{{ searchResult()!.phoneNumber }}</span>
            </div>

            @if (searchResult()!.personType === 'Labour') {
              @if (searchResult()!.barcode) {
                <div class="info-row">
                  <span class="label">Barcode:</span>
                  <span class="value">{{ searchResult()!.barcode }}</span>
                </div>
              }
            } @else {
              @if (searchResult()!.companyName) {
                <div class="info-row">
                  <span class="label">Company:</span>
                  <span class="value">{{ searchResult()!.companyName }}</span>
                </div>
              }
              @if (searchResult()!.purpose) {
                <div class="info-row">
                  <span class="label">Purpose:</span>
                  <span class="value">{{ searchResult()!.purpose }}</span>
                </div>
              }
            }
          </div>

          <div class="result-actions">
            <button class="action-btn entry" (click)="recordEntry()" [disabled]="searchResult()!.hasOpenEntry">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M13.8 12H3"/>
              </svg>
              Record Entry
            </button>
            <button class="action-btn exit" (click)="recordExit()" [disabled]="!searchResult()!.hasOpenEntry">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l-5-5 5-5M21 12H9"/>
              </svg>
              Record Exit
            </button>
          </div>
        </div>
      }

      @if (!searching() && !searchResult() && !errorMessage() && searchQuery() && searchQuery().length >= 3) {
        <div class="no-results">
          <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="11" cy="11" r="8"/>
            <path d="m21 21-4.35-4.35"/>
          </svg>
          <p>No person found with query: {{ searchQuery() }}</p>
          <small>Try searching by name, phone number, or barcode</small>
        </div>
      }
    </div>
  `
})
export class SearchComponent {
  private apiService = inject(ApiService);
  private router = inject(Router);

  searchQuery = signal('');
  searchResult = signal<SearchResult | null>(null);
  searching = signal(false);
  errorMessage = signal('');

  private searchTimeout: any;

  onSearchQueryChange() {
    clearTimeout(this.searchTimeout);

    const query = this.searchQuery().trim();

    if (query.length < 3) {
      this.searchResult.set(null);
      this.errorMessage.set('');
      return;
    }

    this.searchTimeout = setTimeout(() => {
      this.performSearch(query);
    }, 500);
  }

  private performSearch(query: string) {
    this.searching.set(true);
    this.errorMessage.set('');
    this.searchResult.set(null);

    this.apiService.search(query).pipe(take(1)).subscribe({
      next: (response: any) => {
        this.searching.set(false);

        if (response.success && response.data) {
          this.searchResult.set(response.data as SearchResult);
        } else {
          this.errorMessage.set(response.message || 'No results found');
        }
      },
      error: (error) => {
        this.searching.set(false);
        this.errorMessage.set('Error searching. Please try again.');
        console.error('Search error:', error);
      }
    });
  }

  clearSearch() {
    this.searchQuery.set('');
    this.searchResult.set(null);
    this.errorMessage.set('');
  }

  recordEntry() {
    const result = this.searchResult();
    if (!result || result.hasOpenEntry) return;

    this.router.navigate(['/entry-exit'], {
      queryParams: {
        personType: result.personType,
        personId: result.id,
        action: 'Entry'
      }
    });
  }

  recordExit() {
    const result = this.searchResult();
    if (!result || !result.hasOpenEntry) return;

    this.router.navigate(['/entry-exit'], {
      queryParams: {
        personType: result.personType,
        personId: result.id,
        action: 'Exit'
      }
    });
  }

  goBack() {
    this.router.navigate(['/dashboard']);
  }
}
