import { Injectable } from '@angular/core';
import Dexie from 'dexie';

interface PhotoRecord {
  id?: number;
  filename: string;
  data?: Blob | string; // Blob on web, base64 path string on native
  metadata?: any;
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

  private initDexie() {
    if (!this.dexieDb) {
      this.dexieDb = new Dexie('VermillionOfflineDB');
      this.dexieDb.version(1).stores({ photos: '++id,filename,uploaded,createdAt' });
      this.photosTable = this.dexieDb.table('photos');
    }
  }

  /**
   * Save photo payload and metadata locally.
   * On native: writes file to device filesystem and stores metadata in Dexie/SQLite.
   * On web: stores blob in IndexedDB (Dexie).
   * Returns inserted record id and a local reference.
   */
  async savePhoto(file: Blob, filename: string, metadata: any = {}): Promise<{ id: number; localRef: string }> {
    const createdAt = Date.now();

    if (this.isNative && this.Filesystem) {
      // write base64 file to Filesystem
      const base64 = await this.blobToBase64(file);
      const path = `photos/${createdAt}-${filename}`;
      try {
        await this.Filesystem.writeFile({ path, data: base64, directory: 'DATA' });
        // store metadata in Dexie for simplicity (you may use SQLite for performant queries)
        const id = await this.photosTable!.add({ filename, data: path, metadata, uploaded: false, createdAt });
        return { id, localRef: path };
      } catch (err) {
        console.error('Filesystem write failed', err);
        // fallback to Dexie blob store
      }
    }

    // Web fallback: store blob directly in IndexedDB via Dexie
    const id = await this.photosTable!.add({ filename, data: file, metadata, uploaded: false, createdAt });
    return { id, localRef: `dexie:${id}` };
  }

  async getPendingPhotos(): Promise<PhotoRecord[]> {
    if (!this.photosTable) this.initDexie();
    return (await this.photosTable!.where('uploaded').equals(false).toArray()) as PhotoRecord[];
  }

  async markUploaded(id: number): Promise<void> {
    if (!this.photosTable) this.initDexie();
    await this.photosTable!.update(id, { uploaded: true });
  }

  async remove(id: number): Promise<void> {
    if (!this.photosTable) this.initDexie();
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

  async getPhotoData(record: PhotoRecord): Promise<Blob | string | null> {
    if (!record) return null;
    if (this.isNative && typeof record.data === 'string') {
      // it's a path to filesystem; read and return base64 string
      try {
        const result = await this.Filesystem.readFile({ path: record.data, directory: 'DATA' });
        return result.data as string; // base64
      } catch (e) {
        console.error('readFile failed', e);
        return null;
      }
    }

    if (record.data instanceof Blob) return record.data;
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
}
