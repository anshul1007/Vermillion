import { Component, signal, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Network } from '@capacitor/network';
import { NetworkQualityService } from '../../core/services/network-quality.service';
import { OfflineStorageService } from '../../core/services/offline-storage.service';
import { SyncService } from '../../core/services/sync.service';
import { interval, Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-offline-banner',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div *ngIf="!connected()" class="offline-banner">
      <div class="container">
        Offline — showing cached data
        <span *ngIf="net.isSlow()" class="offline-slow-indicator">(Slow network: ~{{ net.latencyMs() }}ms)</span>
        <span *ngIf="queuedCount() > 0" class="offline-queue-indicator"> • {{ queuedCount() }} queued</span>
        <span *ngIf="sync.lastSyncAt$ | async as last" class="offline-last-sync"> • Last sync: {{ (last | date:'short') }}</span>
      </div>
    </div>
  `,
})
export class OfflineBannerComponent implements OnDestroy {
  connected = signal(true);
  queuedCount = signal(0);
  private listener: any;
  private destroy$ = new Subject<void>();
  constructor(public net: NetworkQualityService, private offline: OfflineStorageService, public sync: SyncService) {
    Network.getStatus().then(s => this.connected.set(!!s.connected)).catch(() => this.connected.set(true));
    this.listener = Network.addListener('networkStatusChange', (status) => {
      this.connected.set(!!status.connected);
    });

    // poll queued count every 10s and stop when component destroyed
    interval(10000).pipe(takeUntil(this.destroy$)).subscribe(() => this.refreshQueuedCount());
    // initial load
    this.refreshQueuedCount();
    // refresh queued count when sync completes
    this.sync.lastSyncAt$.pipe(takeUntil(this.destroy$)).subscribe(() => this.refreshQueuedCount());
  }

  private async refreshQueuedCount() {
    try {
      const items = await this.offline.getQueuedActions(1000);
      this.queuedCount.set(items?.length || 0);
    } catch {}
  }

  ngOnDestroy(): void {
    try {
      this.destroy$.next();
      this.destroy$.complete();
      this.listener && this.listener.remove && this.listener.remove();
    } catch {}
  }
}
