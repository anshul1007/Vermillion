import { Injectable } from '@angular/core';
import { ApiService } from './api.service';
import { OfflineStorageService } from './offline-storage.service';

function delay(ms: number) { return new Promise(res => setTimeout(res, ms)); }

@Injectable({ providedIn: 'root' })
export class SyncService {
  private processing = false;
  private pollInterval = 5000; // ms

  constructor(private api: ApiService, private offline: OfflineStorageService) {
    // run on start
    this.start();
    // listen to online events
    if (typeof window !== 'undefined' && 'addEventListener' in window) {
      window.addEventListener('online', () => this.processQueue());
    }
  }

  start() {
    // poll periodically
    setInterval(() => this.processQueue(), this.pollInterval);
  }

  async processQueue() {
    if (this.processing) return;
    this.processing = true;
    try {
      const items = await this.offline.getQueuedActions(50);

      // process registration actions first (registerLabour/registerVisitor)
        // process photo uploads first, then registration actions, then others
        const photoUploads = items.filter((i: any) => i.actionType === 'photoUpload');
        const registrations = items.filter((i: any) => i.actionType === 'registerLabour' || i.actionType === 'registerVisitor');
        const processedIds = new Set<number>();

        for (const p of photoUploads) {
          try {
            await this.processPhotoUpload(p);
            processedIds.add(p.id);
          } catch (e) {
            console.error('SyncService: failed photoUpload', p, e);
          }
        }

        for (const reg of registrations) {
          if (processedIds.has(reg.id)) continue;
          try {
            await this.processRegistration(reg);
            processedIds.add(reg.id);
          } catch (e) {
            console.error('SyncService: failed registration', reg, e);
          }
        }

        // then process other actions (they may have been patched to reference server IDs)
        const others = items.filter((i: any) => !processedIds.has(i.id) && i.actionType !== 'photoUpload' && i.actionType !== 'registerLabour' && i.actionType !== 'registerVisitor');
        for (const it of others) {
          try {
            await this.processItem(it);
          } catch (e) {
            console.error('SyncService: failed to process item', it, e);
          }
        }
    } finally {
      this.processing = false;
    }
  }

  private async processRegistration(item: any) {
    const id = item.id;
    await this.offline.updateActionStatus(id, 'processing', (item.attempts || 0) + 1);
    const type = item.actionType;
    const payload = item.payload || {};
    try {
      let resp: any = null;
      if (type === 'registerLabour') {
        // Ensure classificationId is numeric and present. If payload contains a classification name, map it.
        await this.ensureClassificationId(payload);
        resp = await this.api.registerLabour(payload).toPromise();
      } else if (type === 'registerVisitor') {
        resp = await this.api.registerVisitor(payload).toPromise();
      }

      // expected: resp.data.id is server id
      const serverId = resp?.data?.id;
      const clientId = payload?.clientId;
      if (clientId && serverId) {
        // update local person record
        await this.offline.updateLocalPersonServerId(clientId, serverId);

        // structured patch: let OfflineStorageService find and replace clientId occurrences safely
        await this.offline.replaceClientIdInQueuedActions(clientId, serverId);
      }

      await this.offline.updateActionStatus(id, 'done', (item.attempts || 0) + 1);
      await this.offline.removeQueuedAction(id);
    } catch (err) {
      console.error('SyncService: registration failed', err);
      const attempts = (item.attempts || 0) + 1;
      if (attempts >= 5) {
        await this.offline.updateActionStatus(id, 'failed', attempts);
      } else {
        await this.offline.updateActionStatus(id, 'pending', attempts);
        const backoff = Math.min(30000, 500 * Math.pow(2, attempts));
        await delay(backoff);
      }
    }
  }

  private async processPhotoUpload(item: any) {
    const id = item.id;
    await this.offline.updateActionStatus(id, 'processing', (item.attempts || 0) + 1);
    try {
      const payload = item.payload || {};
      const photoLocalId = payload.photoLocalId;
      if (!photoLocalId) throw new Error('photoLocalId missing');

      // get base64 data for the photo
      const base64 = await this.offline.getPhotoBase64ById(photoLocalId);
      if (!base64) throw new Error('photo data not found');

      // upload via API
      const res: any = await this.api.uploadPhoto(base64, payload.filename || `photo_${photoLocalId}.jpg`).toPromise();
      const serverPath = res?.data?.path;
      if (!serverPath) throw new Error('upload did not return path');

      // mark photo as uploaded and store remoteUrl in photos table
      try {
        // update photo record metadata (best-effort)
        if ((this.offline as any).photosTable) {
          const photosTable = (this.offline as any).photosTable as any;
          await photosTable.update(photoLocalId, { uploaded: true, remoteUrl: serverPath });
        }
      } catch (e) {
        // ignore
      }

      // structured patch: replace `photoLocalId` fields with `photoPath` in queued payloads
      await this.offline.patchPhotoLocalIdToPhotoPath(photoLocalId, serverPath);

      await this.offline.updateActionStatus(id, 'done', (item.attempts || 0) + 1);
      await this.offline.removeQueuedAction(id);
    } catch (err) {
      console.error('SyncService: photoUpload failed', err);
      const attempts = (item.attempts || 0) + 1;
      if (attempts >= 5) {
        await this.offline.updateActionStatus(id, 'failed', attempts);
      } else {
        await this.offline.updateActionStatus(id, 'pending', attempts);
        const backoff = Math.min(30000, 500 * Math.pow(2, attempts));
        await delay(backoff);
      }
    }
  }

  private async processItem(item: any) {
    const id = item.id;
    // mark processing
    await this.offline.updateActionStatus(id, 'processing', (item.attempts || 0) + 1);

    const type = item.actionType;
    const payload = item.payload || {};

    try {
      if (type === 'createRecord') {
        await this.api.createRecord(payload).toPromise();
      } else if (type === 'registerLabour') {
        await this.ensureClassificationId(payload);
        await this.api.registerLabour(payload).toPromise();
      } else if (type === 'registerVisitor') {
        await this.api.registerVisitor(payload).toPromise();
      } else if (type === 'bulkCheckIn') {
        const { ids, action } = payload;
        await this.api.bulkCheckIn(ids, action).toPromise();
      } else {
        console.warn('SyncService: unknown action type', type);
      }

      // on success
      await this.offline.updateActionStatus(id, 'done', (item.attempts || 0) + 1);
      await this.offline.removeQueuedAction(id);
    } catch (err) {
      console.error('SyncService: action failed', err);
      const attempts = (item.attempts || 0) + 1;
      if (attempts >= 5) {
        await this.offline.updateActionStatus(id, 'failed', attempts);
      } else {
        // backoff before next attempt
        await this.offline.updateActionStatus(id, 'pending', attempts);
        const backoff = Math.min(30000, 500 * Math.pow(2, attempts));
        await delay(backoff);
      }
    }
  }

  // Ensure payload has numeric classificationId. If payload contains 'classification' name, map it to id.
  private async ensureClassificationId(payload: any): Promise<void> {
    if (!payload) return;
    // If classificationId exists but is a string, coerce
    if (payload.classificationId && typeof payload.classificationId === 'string') {
      const n = Number(payload.classificationId);
      if (!isNaN(n)) payload.classificationId = n;
    }

    // If classificationId missing but a classification name is present, try to map via API
    if ((!payload.classificationId || payload.classificationId === 0) && payload.classification && typeof payload.classification === 'string') {
      try {
        const resp: any = await this.api.getLabourClassifications().toPromise();
        const list = resp?.data || [];
        const name = payload.classification.trim().toLowerCase();
        const found = list.find((kv: any) => (kv.value || '').toLowerCase() === name || String(kv.key) === payload.classification);
        if (found) {
          payload.classificationId = Number(found.key ?? found[0]);
        }
      } catch (e) {
        console.warn('SyncService: failed to map classification name to id', e);
      }
    }

    // If still missing classificationId, attempt to create the classification automatically
    if ((!payload.classificationId || payload.classificationId === 0) && payload.classification && typeof payload.classification === 'string') {
      try {
        const nameToCreate = payload.classification.trim();
        if (nameToCreate) {
          const createResp: any = await this.api.createAdminClassification(nameToCreate).toPromise();
          // Expect created entity id in createResp.data.id
          const newId = createResp?.data?.id || (createResp?.data && typeof createResp.data === 'number' ? createResp.data : null);
          if (newId) {
            payload.classificationId = Number(newId);
          } else if (createResp?.data && typeof createResp.data === 'object' && createResp.data.id) {
            payload.classificationId = Number(createResp.data.id);
          }
        }
      } catch (e) {
        console.warn('SyncService: failed to create missing classification via API', e);
      }
    }
  }
}
