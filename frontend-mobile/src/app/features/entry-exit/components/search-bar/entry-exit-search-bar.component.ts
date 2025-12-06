import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
  OnDestroy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IconComponent } from '../../../../shared/icon/icon.component';
import { Subject, takeUntil } from 'rxjs';
import { debounceTime } from 'rxjs/operators';

@Component({
  selector: 'app-entry-exit-search-bar',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent],
  template: `
    <div class="search__body">
      <div class="search__row">
        <div class="search__field">
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
            class="search__input"
          />
        </div>
        <div class="search__primary">
          <button
            type="button"
            class="btn search__btn"
            (click)="searchPerson.emit()"
            [disabled]="disabled"
          >
            <app-icon name="search" size="18"></app-icon>
            <span>Search</span>
          </button>
          <button
            type="button"
            class="btn btn-ghost search__btn"
            (click)="searchContractor.emit()"
            [disabled]="disabled"
          >
            <app-icon name="contractor" size="18"></app-icon>
            <span>Contractors</span>
          </button>
        </div>
      </div>

      <div class="search__quick">
        <button type="button" class="chip-button" (click)="scan.emit()" [disabled]="disabled">
          <app-icon name="barcode" size="16"></app-icon>
          <span>Scan Barcode</span>
        </button>
        <button
          type="button"
          class="chip-button"
          (click)="registerLabour.emit()"
          [disabled]="disabled"
        >
          <app-icon name="user-group" size="16"></app-icon>
          <span>Register Labour</span>
        </button>
        <button
          type="button"
          class="chip-button"
          (click)="registerVisitor.emit()"
          [disabled]="disabled"
        >
          <app-icon name="user" size="16"></app-icon>
          <span>Register Visitor</span>
        </button>
      </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
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
