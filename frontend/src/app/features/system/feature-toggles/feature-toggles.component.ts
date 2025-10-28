import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FeatureToggleService, FeatureToggle } from '../../../core/services/feature-toggle.service';

@Component({
  selector: 'app-feature-toggles',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './feature-toggles.component.html',
  styleUrls: ['./feature-toggles.component.scss']
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
    this.featureService.getAll().subscribe({
      next: (list) => { this.toggles = list; this.loading = false; },
      error: (err) => { this.error = err.message || 'Failed to load'; this.loading = false; }
    });
  }

  toggleFeature(t: FeatureToggle) {
    this.loading = true;
    this.featureService.toggle(t.id, !t.isEnabled).subscribe({
      next: () => this.loadToggles(),
      error: (err) => { this.error = err.message || 'Failed to toggle'; this.loading = false; }
    });
  }
}
