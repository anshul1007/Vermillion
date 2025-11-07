import { Injectable, inject } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { LocalDbService } from './local-db.service';
import { ApiService } from './api.service';
import { Network } from '@capacitor/network';

@Injectable({ providedIn: 'root' })
export class SyncService {
  private localDb = inject(LocalDbService);
  private api = inject(ApiService);

  syncStatus$ = new BehaviorSubject<string>('idle');
  lastSyncTime$ = new BehaviorSubject<number | null>(null);

  async queueOperation(operationType: string, data: any): Promise<string> {
    const clientId = this.generateClientId();
    await this.localDb.addPendingOperation(clientId, operationType, data);
    
    // Try immediate sync if online
    this.attemptSync();
    
    return clientId;
  }

  async attemptSync(): Promise<void> {
    const status = await Network.getStatus();
    if (!status.connected) {
      this.syncStatus$.next('offline');
      return;
    }

    this.syncStatus$.next('syncing');

    try {
      const pending = await this.localDb.getPendingOperations();
      
      if (pending.length === 0) {
        this.syncStatus$.next('idle');
        return;
      }

      const operations = pending.map((op: any, index: number) => ({
        id: index + 1,
        clientId: op.clientId,
        operationType: op.operationType,
        entityType: op.operationType,
        data: JSON.parse(op.data),
        timestamp: new Date().toISOString()
      }));

      const result = await this.api.syncBatch({ operations }).toPromise();

      if (result?.success) {
        for (const syncResult of result.data.results) {
          if (syncResult.success) {
            await this.localDb.markOperationSynced(syncResult.clientId);
          }
        }

        this.lastSyncTime$.next(Date.now());
        this.syncStatus$.next('idle');
        await this.localDb.clearSyncedOperations();
      }
    } catch (error) {
      console.error('Sync failed:', error);
      this.syncStatus$.next('error');
    }
  }

  private generateClientId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(7)}`;
  }

  startAutoSync(): void {
    setInterval(() => this.attemptSync(), 30000); // Every 30 seconds

    Network.addListener('networkStatusChange', (status) => {
      if (status.connected) {
        this.attemptSync();
      }
    });
  }
}
