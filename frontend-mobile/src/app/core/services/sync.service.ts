import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, lastValueFrom } from 'rxjs';
import { OfflineStorageService } from './offline-storage.service';
import { OfflineDbService } from './offline-db.service';
import { AuthService } from '../auth/auth.service';
import { ApiService } from './api.service';
import { Network } from '@capacitor/network';
import { LoggerService } from './logger.service';

@Injectable({ providedIn: 'root' })
export class SyncService {
  private syncing$ = new BehaviorSubject<boolean>(false);
  readonly syncing = this.syncing$.asObservable();
  lastSyncAt$ = new BehaviorSubject<number | null>(null);

  private offline = inject(OfflineStorageService);
  private api = inject(ApiService);
  private logger = inject(LoggerService);
  private auth = inject(AuthService);
  private offlineDb = inject(OfflineDbService);

  constructor() {
    Network.addListener('networkStatusChange', (status) => {
      if (status.connected) {
        this.syncAll().catch((e) => this.logger.error('Auto-sync failed', e));
      }
    });
    // whether the server supports /sync-batch; persisted in localStorage to avoid repeated 404s
    const stored = localStorage.getItem('syncBatchSupported');
    this.batchSupported = stored === null ? true : stored === 'true';
  }

  private batchSupported = true;

  async syncAll(batchSize = 50): Promise<void> {
    if (this.syncing$.value) return;
    const status = await Network.getStatus();
    if (!status.connected) return;

    this.syncing$.next(true);
    const start = Date.now();
    try {
      await this.audit('sync:start', { startedAt: new Date().toISOString() });

      // 1) Upload pending photos first
      const pendingPhotos = await this.offline.getPendingPhotos();
      for (const photo of pendingPhotos) {
        try {
          const base64 = await this.offline.getPhotoBase64ById(photo.id!);
          if (!base64) continue;
          const resp = await this.attemptWithBackoff(
            () =>
              this.callWithRefresh(() =>
                lastValueFrom(this.api.uploadPhoto(base64, photo.filename))
              ),
            5
          );
          if (resp && resp.success && resp.data && resp.data.path) {
            await this.offline.markUploaded(photo.id!);
            await this.offline.patchPhotoLocalIdToPhotoPath(photo.id!, resp.data.path);
            await this.audit('photo:uploaded', { photoId: photo.id, path: resp.data.path });
          }
        } catch (e) {
          this.logger.error('Photo upload failed', e);
          await this.audit('photo:upload_failed', { photoId: photo.id, error: String(e) });
        }
      }

      // 2) Process queued actions in FIFO order
      let more = true;
      while (more) {
        const queued = await this.offline.getQueuedActions(batchSize);
        if (!queued || queued.length === 0) {
          more = false;
          break;
        }

        for (const entry of queued) {
          // skip audit entries in the sync_queue; audits are stored separately
          if (entry.actionType === 'audit') {
            // mark as done to avoid reprocessing
            try {
              await this.offline.updateActionStatus(entry.id, 'done');
            } catch {}
            continue;
          }
          // cap attempts to avoid infinite retry loops for permanently failing items
          const attemptsSoFar = entry.attempts || 0;
          if (attemptsSoFar >= 5) {
            this.logger.warn('Dropping queued action after repeated failures', {
              queueId: entry.id,
              attempts: attemptsSoFar,
            });
            try {
              await this.offline.updateActionStatus(entry.id, 'failed', attemptsSoFar);
            } catch {}
            continue;
          }
          try {
            await this.offline.updateActionStatus(
              entry.id,
              'processing',
              (entry.attempts || 0) + 1
            );
            const actionType = entry.actionType as string;
            const payload = entry.payload;

            // If payload contains photoLocalId, it should have been patched earlier to photoPath
            if (actionType === 'registerLabour') {
              const res = await this.attemptWithBackoff(
                () =>
                  this.callWithRefresh(() =>
                    lastValueFrom(this.api.registerLabour(payload, { enqueueIfNeeded: false }))
                  ),
                5
              );
              if (res && res.success && res.data) {
                // If payload had clientId, update local mapping
                if (payload?.clientId) {
                  await this.offline.updateLocalPersonServerId(payload.clientId, res.data.id);
                  await this.offline.replaceClientIdInQueuedActions(payload.clientId, res.data.id);
                }
                await this.offline.removeQueuedAction(entry.id);
                await this.audit('action:registerLabour:done', { queueId: entry.id, result: res });
                continue;
              }
            } else if (actionType === 'registerVisitor') {
              const res = await this.attemptWithBackoff(
                () =>
                  this.callWithRefresh(() =>
                    lastValueFrom(this.api.registerVisitor(payload, { enqueueIfNeeded: false }))
                  ),
                5
              );
              if (res && res.success && res.data) {
                if (payload?.clientId) {
                  await this.offline.updateLocalPersonServerId(payload.clientId, res.data.id);
                  await this.offline.replaceClientIdInQueuedActions(payload.clientId, res.data.id);
                }
                await this.offline.removeQueuedAction(entry.id);
                await this.audit('action:registerVisitor:done', { queueId: entry.id, result: res });
                continue;
              }
            } else if (
              actionType === 'createRecord' ||
              actionType === 'logEntry' ||
              actionType === 'logExit'
            ) {
              // generic record creation
              const res = await this.attemptWithBackoff(
                () =>
                  this.callWithRefresh(() =>
                    lastValueFrom(this.api.createRecord(payload, { enqueueIfNeeded: false }))
                  ),
                5
              );
              if (res && res.success) {
                await this.offline.removeQueuedAction(entry.id);
                await this.audit('action:createRecord:done', { queueId: entry.id, result: res });
                continue;
              }
            } else if (actionType === 'photoUpload') {
              // photo uploads were already handled above — mark done
              await this.offline.removeQueuedAction(entry.id);
              await this.audit('action:photoUpload:skipped', { queueId: entry.id });
              continue;
            }

            // Fallback: send via syncBatch
            try {
              const op = {
                id: entry.id,
                operationType: actionType,
                entityType: entry.entityType || 'unknown',
                data: this.sanitizePayloadForBatch(payload),
                clientId: payload?.clientId || null,
                timestamp: new Date().toISOString(),
              };
              // size guard: don't send extremely large payloads in batch
              const json = JSON.stringify({ operations: [op] });
              const sizeBytes = new TextEncoder().encode(json).length;
              // 500KB threshold (500 * 1024)
              if (sizeBytes > 500 * 1024) {
                this.logger.warn('Skipping syncBatch for oversized payload', {
                  queueId: entry.id,
                  sizeBytes,
                });
                await this.audit('action:batch_skipped_oversize', { queueId: entry.id, sizeBytes });
                await this.offline.updateActionStatus(
                  entry.id,
                  'failed',
                  (entry.attempts || 0) + 1
                );
                continue;
              }

              let batchResp: any = null;
              if (this.batchSupported) {
                try {
                  batchResp = await this.attemptWithBackoff(
                    () =>
                      this.callWithRefresh(() =>
                        lastValueFrom(this.api.syncBatch({ operations: [op] }))
                      ),
                    3
                  );
                } catch (e: any) {
                  // if server returns 404 for sync-batch, disable future batch attempts
                  const status = e?.status || e?.statusCode || (e?.error && e.error.status);
                  if (status === 404) {
                    this.logger.warn('sync-batch endpoint not found; disabling batch mode');
                    this.batchSupported = false;
                    try {
                      localStorage.setItem('syncBatchSupported', 'false');
                    } catch {}
                    await this.audit('sync:batch_not_supported', { queueId: entry.id });
                  }
                  throw e;
                }
              }

              if (batchResp && batchResp.success) {
                await this.offline.removeQueuedAction(entry.id);
                await this.audit('action:batch:done', { queueId: entry.id, result: batchResp });
                continue;
              }
            } catch (e) {
              this.logger.error('syncBatch failed', e);
              await this.audit('action:batch_failed', { queueId: entry.id, error: String(e) });
            }

            // If we reach here, mark as failed but leave in queue for retry
            await this.offline.updateActionStatus(entry.id, 'failed', (entry.attempts || 0) + 1);
            await this.audit('action:failed', { queueId: entry.id, actionType });
          } catch (e) {
            this.logger.error('Processing queued action failed', e);
            try {
              await this.offline.updateActionStatus(entry.id, 'failed', (entry.attempts || 0) + 1);
            } catch {}
          }
        }

        // if we processed less than batch size then likely no more, continue loop will fetch next
      }

      // 3) Pull recent records (last 30 days) and store to local audit for offline reads
      const to = new Date();
      const from = new Date();
      from.setDate(to.getDate() - 30);
      try {
        const projIdRaw = localStorage.getItem('projectId');
        const projectId = projIdRaw ? Number(projIdRaw) : undefined;
        const recResp = await this.callWithRefresh(() =>
          lastValueFrom(
            this.api.getRecords(
              from.toISOString(),
              to.toISOString(),
              undefined,
              undefined,
              projectId
            )
          )
        );
        if (recResp && recResp.success && recResp.data) {
          const items = recResp.data as any[];
          for (const it of items) {
            try {
              const id =
                it.recordId ??
                it.id ??
                it.recordIdString ??
                `${it.personType}-${it.labourId ?? it.visitorId ?? it.personName}`;
              await this.offlineDb.upsertRecord(
                id,
                it,
                it.updatedAt ?? it.updated_at ?? it.timestamp ?? new Date().toISOString()
              );
            } catch (e) {
              // best-effort per-record
            }
          }
          await this.audit('records:pulled', {
            from: from.toISOString(),
            to: to.toISOString(),
            count: items.length,
          });
        }
      } catch (e) {
        this.logger.warn('Failed to pull records during sync', e);
      }

      await this.audit('sync:complete', { durationMs: Date.now() - start });
      try {
        this.lastSyncAt$.next(Date.now());
      } catch {}
    } catch (e) {
      this.logger.error('SyncAll top-level error', e);
      await this.audit('sync:error', { error: String(e) });
    } finally {
      this.syncing$.next(false);
    }
  }

  private async audit(eventType: string, data: any) {
    try {
      // write audit logs to the offline DB directly to avoid enqueueing into sync_queue
      if (this.offlineDb && typeof (this.offlineDb as any).add === 'function') {
        await this.offlineDb.add('audit_logs', {
          eventType,
          data,
          createdAt: new Date().toISOString(),
        });
      } else if ((this.offline as any)?.audit) {
        // fallback to OfflineStorageService.audit if available
        await (this.offline as any).audit(eventType, data);
      }
    } catch (e) {
      // best-effort
      this.logger.warn('audit write failed', e);
    }
  }

  // Sanitize a queued payload before embedding in a sync batch:
  // - remove any fields that contain base64 image data (data:...base64,)
  // - replace large strings with small placeholders
  // This helps avoid network/Chrome/WebView resource errors when sending batches.
  private sanitizePayloadForBatch(payload: any): any {
    const maxStringSize = 50 * 1024; // 50KB – keep small strings only

    const sanitize = (obj: any): any => {
      if (obj == null) return obj;
      if (typeof obj === 'string') {
        if (obj.startsWith('data:') && obj.includes('base64')) {
          return '[base64_removed]';
        }
        if (obj.length > maxStringSize) return obj.slice(0, 200) + `...[truncated:${obj.length}]`;
        return obj;
      }
      if (typeof obj === 'number' || typeof obj === 'boolean') return obj;
      if (Array.isArray(obj)) return obj.map(sanitize);
      if (typeof obj === 'object') {
        const out: any = {};
        for (const k of Object.keys(obj)) {
          // common photo fields we want to avoid embedding
          if (
            k.toLowerCase().includes('phot') ||
            k.toLowerCase().includes('image') ||
            k.toLowerCase().includes('base64')
          ) {
            // if it's a reference like photoPath/photoLocalId keep it, else strip
            const v = obj[k];
            if (typeof v === 'string' && (v.startsWith('data:') || v.length > 10000)) {
              out[k] = '[removed]';
              continue;
            }
          }
          out[k] = sanitize(obj[k]);
        }
        return out;
      }
      return obj;
    };

    try {
      return sanitize(payload);
    } catch (e) {
      this.logger.warn('sanitizePayloadForBatch failed', e);
      return { _sanitized: true };
    }
  }

  // Helper: execute an API call and on 401 attempt silent refresh and retry once
  private async callWithRefresh<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (err: any) {
      // inspect for 401-like (HttpErrorResponse) shapes
      const status = err?.status || err?.statusCode || (err?.error && err.error.status);
      if (status === 401) {
        try {
          const refresh = this.auth.getRefreshToken?.();
          if (!refresh) throw new Error('no-refresh-token');
          const refreshResp: any = await lastValueFrom(this.api.refreshToken(refresh));
          if (refreshResp && refreshResp.data && refreshResp.data.accessToken) {
            // save tokens
            this.auth.saveNewTokens(refreshResp.data.accessToken, refreshResp.data.refreshToken);
            // retry once
            return await fn();
          } else {
            // if refresh didn't return tokens, force logout flow: user will need to login later
            this.logger.warn('Refresh did not return tokens');
            throw err;
          }
        } catch (refreshErr) {
          this.logger.warn('Silent refresh failed during sync', refreshErr);
          // leave queued items for next login/sync; rethrow original error
          throw err;
        }
      }
      throw err;
    }
  }

  // Helper: attempt a function with jittered exponential backoff
  private async attemptWithBackoff<T>(
    fn: () => Promise<T>,
    maxAttempts = 5,
    baseMs = 1000
  ): Promise<T> {
    let attempt = 0;
    let lastErr: any = null;
    while (attempt < maxAttempts) {
      try {
        return await fn();
      } catch (err) {
        lastErr = err;
        attempt++;
        if (attempt >= maxAttempts) break;
        // exponential backoff with jitter
        const backoff = baseMs * Math.pow(2, attempt - 1);
        const jitter = Math.floor(Math.random() * Math.min(300, backoff));
        const delayMs = backoff + jitter;
        try {
          await new Promise((res) => setTimeout(res, delayMs));
        } catch {}
      }
    }
    throw lastErr;
  }
}
// End of SyncService - duplicate implementation removed
