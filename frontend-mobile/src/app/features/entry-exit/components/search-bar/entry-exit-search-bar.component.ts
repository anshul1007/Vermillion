import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import { debounceTime } from 'rxjs/operators';

@Component({
  selector: 'app-entry-exit-search-bar',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="entry-exit-search card">
      <div class="entry-exit-search__body">
        <div class="entry-exit-search__row">
          <div class="entry-exit-search__field">
            <label class="sr-only" for="entry-exit-search-term">Search term</label>
            <input
              id="entry-exit-search-term"
              type="search"
              autocomplete="off"
              inputmode="search"
              [ngModel]="searchTerm"
              (ngModelChange)="onInput($event)"
              [placeholder]="placeholder"
              (keyup.enter)="searchPerson.emit()"
              class="entry-exit-search__input"
            />
          </div>
          <div class="entry-exit-search__primary">
            <button
              type="button"
              class="btn entry-exit-search__btn"
              (click)="searchPerson.emit()"
              [disabled]="disabled"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.35-4.35" />
              </svg>
              <span>Search</span>
            </button>
            <button
              type="button"
              class="btn btn-ghost entry-exit-search__btn"
              (click)="searchContractor.emit()"
              [disabled]="disabled"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M3 21V7a2 2 0 0 1 2-2h6l2-3h6a2 2 0 0 1 2 2v17" />
                <path d="M12 9h4" />
                <path d="M12 13h4" />
                <path d="M6 9h2" />
                <path d="M6 13h2" />
              </svg>
              <span>Contractors</span>
            </button>
          </div>
        </div>

        <div class="entry-exit-search__quick">
          <button type="button" class="chip-button" (click)="scan.emit()" [disabled]="disabled">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M3 5h2" />
              <path d="M17 5h2" />
              <path d="M7 5v14" />
              <path d="M11 5v14" />
              <path d="M15 5v14" />
              <path d="M19 5v14" />
              <path d="M3 19h18" />
            </svg>
            <span>Scan Barcode</span>
          </button>
          <button type="button" class="chip-button" (click)="registerLabour.emit()" [disabled]="disabled">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
            <span>Register Labour</span>
          </button>
          <button type="button" class="chip-button" (click)="registerVisitor.emit()" [disabled]="disabled">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M8 3h8a2 2 0 0 1 2 2v15l-6-3-6 3V5a2 2 0 0 1 2-2z" />
              <path d="M9 7h6" />
              <path d="M9 11h6" />
            </svg>
            <span>Register Visitor</span>
          </button>
        </div>
      </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EntryExitSearchBarComponent {
  @Input() searchTerm = '';
  @Input() placeholder = 'Search by name, phone or contractor';
  @Input() disabled = false;

  @Output() searchTermChange = new EventEmitter<string>();
  @Output() searchPerson = new EventEmitter<void>();
  @Output() searchContractor = new EventEmitter<void>();
  @Output() scan = new EventEmitter<void>();
  @Output() registerLabour = new EventEmitter<void>();
  @Output() registerVisitor = new EventEmitter<void>();
  private readonly destroy$ = new Subject<void>();
  private readonly input$ = new Subject<string>();

  constructor() {
    this.input$
      .pipe(debounceTime(300), takeUntil(this.destroy$))
      .subscribe((v) => this.searchTermChange.emit(v));
  }

  onInput(value: string) {
    this.input$.next(value);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.input$.complete();
  }
}
