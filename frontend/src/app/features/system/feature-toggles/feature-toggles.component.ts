import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FeatureToggleService, FeatureToggle } from '../../../core/services/feature-toggle.service';
import { take } from 'rxjs/operators';

@Component({
  selector: 'app-feature-toggles',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './feature-toggles.component.html'
})
export class FeatureTogglesComponent implements OnInit {
  private featureService = inject(FeatureToggleService);

  toggles: FeatureToggle[] = [];
  loading = false;
  error = '';

  ngOnInit(): void {
    this.loadToggles();
  }

  loadToggles() {
    this.loading = true;
    this.featureService.getAll().pipe(take(1)).subscribe({
      next: (list) => { this.toggles = list; this.loading = false; },
      error: (err) => { this.error = err.message || 'Failed to load'; this.loading = false; }
    });
  }

  toggleFeature(t: FeatureToggle) {
    this.loading = true;
    this.featureService.toggle(t.id, !t.isEnabled).pipe(take(1)).subscribe({
      next: () => this.loadToggles(),
      error: (err) => { this.error = err.message || 'Failed to toggle'; this.loading = false; }
    });
  }
}
