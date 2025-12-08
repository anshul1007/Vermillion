import { Component, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BarcodeService } from '../../core/services/barcode.service';
import { LoggerService } from '../../core/services/logger.service';
import { inject } from '@angular/core';

@Component({
  selector: 'app-barcode-button',
  standalone: true,
  imports: [CommonModule],
  template: `
    <button type="button" class="btn btn-secondary" (click)="scan()" [disabled]="scanning">
      <span *ngIf="!scanning">Scan Barcode</span>
      <span *ngIf="scanning">Scanning…</span>
    </button>
  `
})
export class BarcodeButtonComponent {
  @Output() scanned = new EventEmitter<string>();
  @Output() error = new EventEmitter<any>();
  scanning = false;

  private logger = inject(LoggerService);
  constructor(private barcode: BarcodeService) {}

  async scan() {
    if (this.scanning) return;
    this.scanning = true;
    try {
      const code = await this.barcode.scanBarcodeWithCamera();
      this.scanned.emit(code);
    } catch (e) {
      this.logger.warn('Scan failed', e);
      this.error.emit(e);
    } finally {
      this.scanning = false;
    }
  }
}
