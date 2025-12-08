import { Injectable, inject } from '@angular/core';
import { LoggerService } from './logger.service';
import Dexie from 'dexie';

interface PhotoRecord {
  id?: number;
  filename: string;
  data?: Blob | string; // Blob on web, base64 path string on native
  metadata?: any;
  remoteUrl?: string | null;
  hash?: string | null;
  uploaded?: boolean;
  createdAt?: number;
}

@Injectable({ providedIn: 'root' })
export class OfflineStorageService {
  private dexieDb: Dexie | null = null;
  private photosTable: Dexie.Table<PhotoRecord, number> | null = null;
  private isNative = false;
  private Filesystem: any = null;
  private Capacitor: any = null;

  constructor() {
    this.detectPlatform();
  }

  private logger = inject(LoggerService);

  private async detectPlatform() {
    try {
      // dynamic import to avoid issues in browser build if Capacitor isn't available
      const cap = await import('@capacitor/core');
      this.Capacitor = cap.Capacitor;
      this.isNative = (this.Capacitor && this.Capacitor.getPlatform && this.Capacitor.getPlatform() !== 'web');
      if (this.isNative) {
        // only import Filesystem on native
        const fsMod = await import('@capacitor/filesystem');
        this.Filesystem = fsMod.Filesystem;
      }
    } catch (e) {
      this.isNative = false;
    }

    // initialize Dexie (IndexedDB) fallback for web or as metadata store
    this.initDexie();
  }

  private async initDexie(): Promise<void> {
    if (this.dexieDb) return;
    this.dexieDb = new Dexie('VermillionOfflineDB');

    // single version 1 declaring photos, actionQueue and people (initial fresh schema)
    this.dexieDb.version(1).stores({
      photos: '++id,filename,uploaded,createdAt,remoteUrl,hash',
      actionQueue: '++id,createdAt,status',
      people: '++id,clientId,serverId,name'
    });

    // open DB to ensure tables are created/upgraded before use
    try {
      await this.dexieDb.open();
    } catch (e) {
      // ignore open errors; callers will handle missing tables if any
    }

    this.photosTable = this.dexieDb.table('photos');
  }

  /**
   * Save photo payload and metadata locally.
   * On native: writes file to device filesystem and stores metadata in Dexie/SQLite.
   * On web: stores blob in IndexedDB (Dexie).
   * Returns inserted record id and a local reference.
   */
  async savePhoto(file: Blob, filename: string, metadata: any = {}): Promise<{ id: number; localRef: string }> {
    const createdAt = Date.now();

    // compute blob hash for deduplication
    const hash = await this.computeBlobHash(file);
    if (hash) {
      if (!this.photosTable) await this.initDexie();
      try {
        const existing = await this.photosTable!.where('hash').equals(hash).first();
        if (existing) {
          // return existing reference instead of duplicating
          const localRef = (typeof existing.data === 'string') ? existing.data : `dexie:${existing.id}`;
          return { id: existing.id!, localRef };
        }
      } catch (e) {
        // ignore and proceed to save
      }
    }

    if (this.isNative && this.Filesystem) {
      // write base64 file to Filesystem
      const base64 = await this.blobToBase64(file);
      const path = `photos/${createdAt}-${filename}`;
      try {
        await this.Filesystem.writeFile({ path, data: base64, directory: 'DATA' });
        // store metadata in Dexie for simplicity (you may use SQLite for performant queries)
        const id = await this.photosTable!.add({ filename, data: path, metadata, remoteUrl: metadata?.remoteUrl ?? null, hash: hash ?? null, uploaded: false, createdAt });
        return { id, localRef: path };
      } catch (err) {
        this.logger.error('Filesystem write failed', err);
        // fallback to Dexie blob store
      }
    }

    // Web fallback: store blob directly in IndexedDB via Dexie
    if (!this.photosTable) await this.initDexie();
    const id = await this.photosTable!.add({ filename, data: file, metadata, remoteUrl: metadata?.remoteUrl ?? null, hash: hash ?? null, uploaded: false, createdAt });
    return { id, localRef: `dexie:${id}` };
  }

  private async computeBlobHash(blob: Blob): Promise<string | null> {
    try {
      const buffer = await blob.arrayBuffer();
      const digest = await crypto.subtle.digest('SHA-1', buffer);
      const view = new Uint8Array(digest);
      let hex = '';
      for (let i = 0; i < view.length; i++) {
        const h = view[i].toString(16).padStart(2, '0');
        hex += h;
      }
      return hex;
    } catch (e) {
      this.logger.warn('computeBlobHash failed', e);
      return null;
    }
  }

  async getPendingPhotos(): Promise<PhotoRecord[]> {
    if (!this.photosTable) await this.initDexie();
    // Dexie type definitions can be strict for .equals(false). Use a safe filter here.
    const all = await this.photosTable!.toArray();
    return all.filter((r) => !r.uploaded) as PhotoRecord[];
  }

  async markUploaded(id: number): Promise<void> {
    if (!this.photosTable) await this.initDexie();
    await this.photosTable!.update(id, { uploaded: true });
  }

  async remove(id: number): Promise<void> {
    if (!this.photosTable) await this.initDexie();
    const rec = await this.photosTable!.get(id);
    if (!rec) return;
    // if native and stored in filesystem, remove file
    if (this.isNative && typeof rec.data === 'string' && this.Filesystem) {
      try {
        await this.Filesystem.deleteFile({ path: rec.data, directory: 'DATA' });
      } catch (e) {
        // ignore
      }
    }
    await this.photosTable!.delete(id);
  }

  // Accept either a PhotoRecord or an id and return an object suitable for image display.
  async getPhotoData(recordOrId: PhotoRecord | number, options: { asDataUrl?: boolean } = { asDataUrl: true }): Promise<{ dataUrl?: string; localPath?: string; blob?: Blob } | null> {
    if (!this.photosTable) await this.initDexie();
    let record: PhotoRecord | undefined | null;
    if (typeof recordOrId === 'number') {
      record = await this.photosTable!.get(recordOrId as number);
    } else {
      record = recordOrId as PhotoRecord;
    }
    if (!record) return null;

    if (this.isNative && typeof record.data === 'string' && this.Filesystem) {
      try {
        const result = await this.Filesystem.readFile({ path: record.data, directory: 'DATA' });
        const base64 = result.data as string;
        const dataUrl = `data:image/jpeg;base64,${base64}`;
        if (options.asDataUrl === false) {
          // return the stored native filesystem path (record.data) so callers can decide how to consume it
          return { localPath: record.data as string };
        }
        return { dataUrl, localPath: dataUrl };
      } catch (e) {
        this.logger.error('readFile failed', e);
        return null;
      }
    }

    if (record.data instanceof Blob) {
      try {
        const blob = record.data;
        if (options.asDataUrl === false) {
          // return the blob for callers that prefer to create object URLs themselves
          return { blob, localPath: undefined } as any;
        }
        const b64 = await this.blobToBase64(blob);
        const dataUrl = `data:image/jpeg;base64,${b64}`;
        return { dataUrl, localPath: dataUrl, blob };
      } catch (e) {
        this.logger.error('getPhotoData blob conversion failed', e);
        return null;
      }
    }

    return null;
  }

  // Find a stored photo whose metadata.remoteUrl matches the given remote URL.
  async findPhotoByRemoteUrl(remoteUrl: string): Promise<PhotoRecord | null> {
    if (!this.photosTable) await this.initDexie();
    try {
      // Use indexed lookup on remoteUrl for fast results
      const found = await this.photosTable!.where('remoteUrl').equals(remoteUrl).first();
      if (found) return found as PhotoRecord;
    } catch (e) {
      // fallback to full scan if where/equality isn't available for some reason
      const all = await this.photosTable!.toArray();
      const found = all.find((r) => r.metadata && (r.metadata.remoteUrl === remoteUrl || r.metadata?.remoteUrl === remoteUrl));
      return found || null;
    }
    return null;
  }

  private blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = reject;
      reader.onload = () => {
        const dataUrl = reader.result as string;
        // strip data: prefix if present
        const idx = dataUrl.indexOf(',');
        resolve(idx >= 0 ? dataUrl.slice(idx + 1) : dataUrl);
      };
      reader.readAsDataURL(blob);
    });
  }

  // Convert a data URL (data:<mime>;base64,...) to a Blob
  private dataUrlToBlob(dataUrl: string): Blob {
    const parts = dataUrl.split(',');
    const meta = parts[0] || '';
    const b64 = parts[1] || '';
    const mimeMatch = meta.match(/data:([^;]+);base64/);
    const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
    const byteChars = atob(b64);
    const byteNumbers = new Array(byteChars.length);
    for (let i = 0; i < byteChars.length; i++) {
      byteNumbers[i] = byteChars.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], { type: mime });
  }

  // Save a data URL string directly (helper wrapper) and return same shape as savePhoto
  async savePhotoFromDataUrl(dataUrl: string, filename: string, metadata: any = {}): Promise<{ id: number; localRef: string }> {
    const blob = this.dataUrlToBlob(dataUrl);
    return this.savePhoto(blob, filename, metadata);
  }

  // Return a data URL (data:<mime>;base64,...) for a stored photo id
  async getPhotoBase64ById(id: number): Promise<string | null> {
    const pd = await this.getPhotoData(id);
    if (!pd) return null;
    if (pd.dataUrl && pd.dataUrl.startsWith('data:')) return pd.dataUrl;
    if (pd.blob) {
      const b64 = await this.blobToBase64(pd.blob);
      return `data:image/jpeg;base64,${b64}`;
    }
    if (pd.localPath && pd.localPath.startsWith('data:')) return pd.localPath;
    return null;
  }

  // --- Action queue APIs ---
  async enqueueAction(actionType: string, payload: any): Promise<number> {
    if (!this.dexieDb) await this.initDexie();
    const createdAt = Date.now();
    const rec = await (this.dexieDb as Dexie).table('actionQueue').add({ actionType, payload, status: 'pending', attempts: 0, createdAt });
    return rec as number;
  }

  async getQueuedActions(limit = 20): Promise<any[]> {
    if (!this.dexieDb) await this.initDexie();
    const table = (this.dexieDb as Dexie).table('actionQueue');
    return (await table.where('status').equals('pending').limit(limit).toArray()) as any[];
  }

  async updateActionStatus(id: number, status: 'pending' | 'processing' | 'done' | 'failed', attempts?: number): Promise<void> {
    if (!this.dexieDb) await this.initDexie();
    const table = (this.dexieDb as Dexie).table('actionQueue');
    const update: any = { status };
    if (typeof attempts === 'number') update.attempts = attempts;
    await table.update(id, update);
  }

  async removeQueuedAction(id: number): Promise<void> {
    if (!this.dexieDb) await this.initDexie();
    const table = (this.dexieDb as Dexie).table('actionQueue');
    await table.delete(id);
  }

  // --- Local person helpers for clientId/serverId mapping ---
  async saveLocalPerson(person: { clientId: string; name: string; phoneNumber?: string; photoLocalRef?: string; status?: string; panNumber?: string; address?: string; companyName?: string; purpose?: string; }): Promise<number> {
    if (!this.dexieDb) await this.initDexie();
    const peopleTable = (this.dexieDb as any).table('people');
    const id = await peopleTable.add({ ...person, serverId: null, createdAt: Date.now() });
    return id as number;
  }

  async getLocalPersonByClientId(clientId: string): Promise<any | null> {
    if (!this.dexieDb) await this.initDexie();
    try {
      const people = (this.dexieDb as any).table('people');
      const found = await people.where('clientId').equals(clientId).first();
      return found || null;
    } catch (e) {
      return null;
    }
  }

  async updateLocalPersonServerId(clientId: string, serverId: number): Promise<void> {
    if (!this.dexieDb) await this.initDexie();
    const people = (this.dexieDb as any).table('people');
    const rec = await people.where('clientId').equals(clientId).first();
    if (rec) {
      await people.update(rec.id, { serverId, status: 'synced' });
    }
  }

  // Find queued actions whose payload references a clientId (simple deep search)
  async findQueuedActionsReferencingClientId(clientId: string): Promise<any[]> {
    if (!this.dexieDb) await this.initDexie();
    const q = (this.dexieDb as Dexie).table('actionQueue');
    const all = await q.toArray();
    return all.filter((entry: any) => this.deepContainsClientId(entry.payload, clientId));
  }

  async patchQueuedActionPayload(actionId: number, newPayload: any): Promise<void> {
    if (!this.dexieDb) await this.initDexie();
    const q = (this.dexieDb as Dexie).table('actionQueue');
    await q.update(actionId, { payload: newPayload });
  }

  // Return true if the payload object (any nested structure) contains the clientId string
  deepContainsClientId(obj: any, clientId: string): boolean {
    if (obj == null) return false;
    if (typeof obj === 'string') return obj === clientId || obj.includes(clientId);
    if (typeof obj === 'number' || typeof obj === 'boolean') return false;
    if (Array.isArray(obj)) {
      for (const v of obj) {
        if (this.deepContainsClientId(v, clientId)) return true;
      }
      return false;
    }
    if (typeof obj === 'object') {
      for (const k of Object.keys(obj)) {
        const v = obj[k];
        if (this.deepContainsClientId(v, clientId)) return true;
      }
    }
    return false;
  }

  // Deeply replace occurrences of clientId in the payload object with serverId.
  // This will walk arrays and objects and replace exact string matches or embedded occurrences in strings.
  deepReplaceClientId(obj: any, clientId: string, serverId: string | number): any {
    if (obj == null) return obj;
    if (typeof obj === 'string') {
      if (obj === clientId) return String(serverId);
      if (obj.includes(clientId)) return obj.split(clientId).join(String(serverId));
      return obj;
    }
    if (typeof obj === 'number' || typeof obj === 'boolean') return obj;
    if (Array.isArray(obj)) return obj.map((v) => this.deepReplaceClientId(v, clientId, serverId));
    if (typeof obj === 'object') {
      const out: any = {};
      for (const k of Object.keys(obj)) {
        out[k] = this.deepReplaceClientId(obj[k], clientId, serverId);
      }
      return out;
    }
    return obj;
  }

  // Finds queued actions that reference clientId and updates their payloads to use serverId instead.
  async replaceClientIdInQueuedActions(clientId: string, serverId: string | number): Promise<void> {
    if (!this.dexieDb) await this.initDexie();
    const q = (this.dexieDb as Dexie).table('actionQueue');
    const all = await q.toArray();
    for (const entry of all) {
      if (this.deepContainsClientId(entry.payload, clientId)) {
        const patched = this.deepReplaceClientId(entry.payload, clientId, serverId);
        await q.update(entry.id, { payload: patched });
      }
    }
  }

  // Replace occurrences of a numeric local photo id in queued payloads with a server-side photo path.
  async replacePhotoLocalIdWithServerPath(photoLocalId: number, serverPath: string): Promise<void> {
    if (!this.dexieDb) await this.initDexie();
    const q = (this.dexieDb as Dexie).table('actionQueue');
    const all = await q.toArray();
    for (const entry of all) {
      let changed = false;
      const newPayload = this.deepMapReplace(entry.payload, (value: any, key?: string) => {
        if (key === 'photoLocalId' && value === photoLocalId) {
          changed = true;
          return { replaceWithKey: 'photoPath', replaceWithValue: serverPath } as any;
        }
        return value;
      });
      if (changed) {
        const normalized = this.deepApplyReplacements(newPayload);
        await q.update(entry.id, { payload: normalized });
      }
    }
  }

  // Replace payload fields named `photoLocalId` with `photoPath` (structured replacement).
  async patchPhotoLocalIdToPhotoPath(photoLocalId: number, serverPath: string): Promise<void> {
    if (!this.dexieDb) await this.initDexie();
    const q = (this.dexieDb as Dexie).table('actionQueue');
    const all = await q.toArray();
    for (const entry of all) {
      let changed = false;
      const newPayload = this.deepMapReplace(entry.payload, (value: any, key?: string) => {
        if (key === 'photoLocalId' && value === photoLocalId) {
          changed = true;
          return { replaceWithKey: 'photoPath', replaceWithValue: serverPath } as any;
        }
        return value;
      });
      if (changed) {
        // apply mapping: deepMapReplace encodes replacement objects; normalize payload
        const normalized = this.deepApplyReplacements(newPayload);
        await q.update(entry.id, { payload: normalized });
      }
    }
  }

  // Helper that walks object and allows a mapper to return either the same value or a special object { replaceWithKey, replaceWithValue }
  private deepMapReplace(obj: any, mapper: (value: any, key?: string) => any): any {
    if (obj == null) return obj;
    if (typeof obj === 'string' || typeof obj === 'number' || typeof obj === 'boolean') {
      return mapper(obj);
    }
    if (Array.isArray(obj)) return obj.map(v => this.deepMapReplace(v, mapper));
    if (typeof obj === 'object') {
      const out: any = {};
      for (const k of Object.keys(obj)) {
        const mapped = mapper(obj[k], k);
        if (mapped && typeof mapped === 'object' && mapped.replaceWithKey) {
          out[mapped.replaceWithKey] = mapped.replaceWithValue;
        } else {
          out[k] = this.deepMapReplace(mapped, mapper);
        }
      }
      return out;
    }
    return obj;
  }

  private deepApplyReplacements(obj: any): any {
    if (obj == null) return obj;
    if (Array.isArray(obj)) return obj.map(v => this.deepApplyReplacements(v));
    if (typeof obj === 'object') {
      const out: any = {};
      for (const k of Object.keys(obj)) {
        const v = obj[k];
        if (v && typeof v === 'object' && v.replaceWithKey && v.replaceWithValue) {
          out[v.replaceWithKey] = v.replaceWithValue;
        } else {
          out[k] = this.deepApplyReplacements(v);
        }
      }
      return out;
    }
    return obj;
  }

  // Generic deep replace for equality of primitive values (number/string/boolean)
  deepReplaceValue(obj: any, matchValue: any, replaceWith: any): any {
    if (obj == null) return obj;
    if (typeof obj === 'string' || typeof obj === 'number' || typeof obj === 'boolean') {
      // only replace exact matches for primitives to avoid accidental substring replacements
      if (obj === matchValue) return replaceWith;
      // if matchValue is numeric but stored as a string in payload, replace exact-equal string
      if (typeof obj === 'string' && String(matchValue) === obj) return replaceWith;
      return obj;
    }
    if (Array.isArray(obj)) return obj.map((v) => this.deepReplaceValue(v, matchValue, replaceWith));
    if (typeof obj === 'object') {
      const out: any = {};
      for (const k of Object.keys(obj)) {
        out[k] = this.deepReplaceValue(obj[k], matchValue, replaceWith);
      }
      return out;
    }
    return obj;
  }
}
