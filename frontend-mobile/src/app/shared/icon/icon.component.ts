import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-icon',
  standalone: true,
  imports: [CommonModule],
  template: `
    <ng-container [ngSwitch]="name">
      <svg *ngSwitchCase="'logo'" [attr.width]="size" [attr.height]="size" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" [ngClass]="klass" aria-hidden="true"><path d="M3 21V7l9-4 9 4v14" /><path d="M9 21V12h6v9" /><path d="M9 12 3 8" /><path d="m15 12 6-4" /></svg>

      <svg *ngSwitchCase="'shield-check'" [attr.width]="size" [attr.height]="size" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" [ngClass]="klass" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="M9 12l2 2 4-4" /></svg>

      <svg *ngSwitchCase="'user-group'" [attr.width]="size" [attr.height]="size" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" [ngClass]="klass" aria-hidden="true"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>

      <svg *ngSwitchCase="'user'" [attr.width]="size" [attr.height]="size" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" [ngClass]="klass" aria-hidden="true"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>

      <svg *ngSwitchCase="'search'" [attr.width]="size" [attr.height]="size" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" [ngClass]="klass" aria-hidden="true"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></svg>

      <svg *ngSwitchCase="'trend-up'" [attr.width]="size" [attr.height]="size" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" [ngClass]="klass" aria-hidden="true"><path d="M3 3v18h18" /><path d="M19 17 13 11 9 15 5 11" /></svg>

      <svg *ngSwitchCase="'clock'" [attr.width]="size" [attr.height]="size" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" [ngClass]="klass" aria-hidden="true"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>

      <svg *ngSwitchCase="'dashboard'" [attr.width]="size" [attr.height]="size" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" [ngClass]="klass" aria-hidden="true"><rect x="3" y="3" width="7" height="9" rx="1" /><rect x="14" y="3" width="7" height="5" rx="1" /><rect x="14" y="12" width="7" height="9" rx="1" /><rect x="3" y="16" width="7" height="5" rx="1" /></svg>

      <svg *ngSwitchCase="'logout'" [attr.width]="size" [attr.height]="size" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" [ngClass]="klass" aria-hidden="true"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>

      <svg *ngSwitchCase="'entry'" [attr.width]="size" [attr.height]="size" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" [ngClass]="klass" aria-hidden="true"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" /><path d="M10 17l5-5-5-5" /><path d="M13.8 12H3" /></svg>

      <svg *ngSwitchCase="'exit'" [attr.width]="size" [attr.height]="size" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" [ngClass]="klass" aria-hidden="true"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="M16 17l-5-5 5-5" /><path d="M21 12H9" /></svg>

      <svg *ngSwitchCase="'contractor'" [attr.width]="size" [attr.height]="size" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" [ngClass]="klass" aria-hidden="true"><path d="M3 21V7a2 2 0 0 1 2-2h6l2-3h6a2 2 0 0 1 2 2v17" /><path d="M12 9h4" /><path d="M12 13h4" /><path d="M6 9h2" /><path d="M6 13h2" /></svg>

      <svg *ngSwitchCase="'barcode'" [attr.width]="size" [attr.height]="size" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" [ngClass]="klass" aria-hidden="true"><path d="M3 5h2" /><path d="M17 5h2" /><path d="M7 5v14" /><path d="M11 5v14" /><path d="M15 5v14" /><path d="M19 5v14" /><path d="M3 19h18" /></svg>

      <svg *ngSwitchCase="'visitor-pass'" [attr.width]="size" [attr.height]="size" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" [ngClass]="klass" aria-hidden="true"><path d="M8 3h8a2 2 0 0 1 2 2v15l-6-3-6 3V5a2 2 0 0 1 2-2z" /><path d="M9 7h6" /><path d="M9 11h6" /></svg>

      <svg *ngSwitchCase="'entry-exit'" [attr.width]="size" [attr.height]="size" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" [ngClass]="klass" aria-hidden="true"><path d="M3 3h18" /><path d="M3 21h18" /><path d="M9 3v18" /><path d="M9 12h6" /></svg>

      <svg *ngSwitchCase="'report-trend'" [attr.width]="size" [attr.height]="size" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" [ngClass]="klass" aria-hidden="true"><path d="M3 3v18h18" /><path d="M7 14l4-4 4 4 5-5" /></svg>

      <svg *ngSwitchCase="'entry-arrow'" [attr.width]="size" [attr.height]="size" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" [ngClass]="klass" aria-hidden="true"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" /><path d="M10 17l5-5-5-5" /><path d="M13.8 12H3" /></svg>

      <svg *ngSwitchCase="'document'" [attr.width]="size" [attr.height]="size" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" [ngClass]="klass" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" /></svg>

      <svg *ngSwitchCase="'phone'" [attr.width]="size" [attr.height]="size" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" [ngClass]="klass" aria-hidden="true"><path d="M22 16.92v2.09a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.1 2h2.09a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L7.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2z" /></svg>

      <svg *ngSwitchCase="'id-card'" [attr.width]="size" [attr.height]="size" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" [ngClass]="klass" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2" /><line x1="7" y1="8" x2="7" y2="16" /><line x1="12" y1="8" x2="12" y2="16" /><line x1="17" y1="8" x2="17" y2="16" /></svg>

      <svg *ngSwitchCase="'square'" [attr.width]="size" [attr.height]="size" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" [ngClass]="klass" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2" /></svg>

      <svg *ngSwitchCase="'check-square'" [attr.width]="size" [attr.height]="size" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" [ngClass]="klass" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2" /><polyline points="9 12 12 15 15 9" /></svg>

      <svg *ngSwitchCase="'record-circle'" [attr.width]="size" [attr.height]="size" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" [ngClass]="klass" aria-hidden="true"><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="5" /></svg>

      <svg *ngSwitchCase="'dot'" [attr.width]="size" [attr.height]="size" viewBox="0 0 16 16" fill="currentColor" stroke="none" [ngClass]="klass" aria-hidden="true"><circle cx="8" cy="8" r="6" /></svg>

      <svg *ngSwitchCase="'dot-check'" [attr.width]="size" [attr.height]="size" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" [ngClass]="klass" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="currentColor" stroke="none" /><polyline points="9 12.5 10.8 14.3 15 11" stroke="#fff" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" /></svg>

      <svg *ngSwitchCase="'close'" [attr.width]="size" [attr.height]="size" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" [ngClass]="klass" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>

      <svg *ngSwitchCase="'check'" [attr.width]="size" [attr.height]="size" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" [ngClass]="klass" aria-hidden="true"><polyline points="5 12 9 16 19 6" /></svg>

      <svg *ngSwitchDefault [attr.width]="size" [attr.height]="size" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" [ngClass]="klass" aria-hidden="true"><circle cx="12" cy="12" r="10" /></svg>
    </ng-container>
  `
})
export class IconComponent {
  @Input() name: string = '';
  @Input() size: number | string = 24;
  @Input('class') klass: string | string[] = '';
}
