import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-entry-exit-shell',
  standalone: true,
  imports: [CommonModule, RouterOutlet],
  template: `
    <div class="entry-exit-shell">
      <router-outlet />
    </div>
  `,
  styles: [
    `
      .entry-exit-shell {
        min-height: 100vh;
        display: flex;
        flex-direction: column;
      }
    `
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EntryExitShellComponent {}
