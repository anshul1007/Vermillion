import { Injectable, inject } from '@angular/core';
import { LocalImageService } from './local-image.service';
import { OfflineStorageService } from './offline-storage.service';

type CacheEntry = {
  original: string; // original source (http/data/blob/local)
  url: string; // the stable url for binding (may be same as original)
  createdObjectUrl?: boolean; // whether we created an object URL that must be revoked
  ts: number;
  owners?: Set<string>;
};

@Injectable({ providedIn: 'root' })
export class ImageCacheService {
  private map = new Map<string, CacheEntry>();
  private localImage: LocalImageService;
  private offline: OfflineStorageService;

  // Allow optional constructor injection for unit testing; fall back to Angular inject()
  constructor(localImage?: LocalImageService, offline?: OfflineStorageService) {
    try {
      this.localImage = localImage ?? inject(LocalImageService);
      this.offline = offline ?? inject(OfflineStorageService);
    } catch (e) {
      // in non-Angular test contexts, caller should pass mocks
      if (!localImage || !offline) throw e;
      this.localImage = localImage as LocalImageService;
      this.offline = offline as OfflineStorageService;
    }
  }

  // eviction settings
  private MAX_ENTRIES = 200;
  private TTL_MS = 1000 * 60 * 10; // 10 minutes

  private touch(key: string) {
    const e = this.map.get(key);
    if (e) e.ts = Date.now();
  }

  private evictIfNeeded() {
    if (this.map.size <= this.MAX_ENTRIES) return;
    // simple eviction: remove oldest entries until under limit
    const entries = Array.from(this.map.entries());
    entries.sort((a, b) => a[1].ts - b[1].ts);
    const toRemove = entries.slice(0, entries.length - this.MAX_ENTRIES);
    for (const [k, v] of toRemove) {
      if (v.createdObjectUrl) {
        try { URL.revokeObjectURL(v.url); } catch {}
      }
      this.map.delete(k);
    }
  }

  private evictExpired() {
    const now = Date.now();
    for (const [k, v] of Array.from(this.map.entries())) {
      if (now - v.ts > this.TTL_MS) {
        if (v.createdObjectUrl) {
          try { URL.revokeObjectURL(v.url); } catch {}
        }
        this.map.delete(k);
      }
    }
  }

  // Return a cached url synchronously, or null if not cached yet
  getCached(src: string | null | undefined): string | null {
    if (!src) return null;
    const e = this.map.get(src);
    if (e) {
      this.touch(src);
      return e.url;
    }
    // If it's a data: or blob: or file/dexie/local path we can return it immediately
    if (src.startsWith('data:') || src.startsWith('blob:') || src.startsWith('dexie:') || src.startsWith('file:') || src.startsWith('/') ) {
      return src;
    }
    return null;
  }

  // Ensure a stable url is available for binding. Prefer LocalImageService/OfflineStorage first.
  async ensureCached(src: string | null | undefined): Promise<string | null> {
    if (!src) return null;
    this.evictExpired();
    const existing = this.map.get(src);
    if (existing) {
      existing.ts = Date.now();
      // touch ownership set if missing
      if (!existing.owners) existing.owners = new Set();
      return existing.url;
    }

    // Pass-throughs: data:, blob:, local file references or dexie:// style which are already stable
    if (src.startsWith('data:') || src.startsWith('blob:') || src.startsWith('dexie:') || src.startsWith('file:') || src.startsWith('/')) {
      const e: CacheEntry = { original: src, url: src, createdObjectUrl: false, ts: Date.now() };
      this.map.set(src, e);
      this.evictIfNeeded();
      return src;
    }

    // 1) Ask LocalImageService which will return a saved local path or data URL if available
    try {
      const resolved = await this.localImage.resolveImage(src);
      if (resolved) {
        const e: CacheEntry = { original: src, url: resolved, createdObjectUrl: false, ts: Date.now(), owners: new Set() };
        this.map.set(src, e);
        this.evictIfNeeded();
        return resolved;
      }
    } catch (err) {
      // ignore and continue to next fallback
    }

    // 2) Check offline storage for a matching remote record
    try {
      const found = await this.offline.findPhotoByRemoteUrl(src);
      if (found) {
        const pd = await this.offline.getPhotoData(found.id ?? found, { asDataUrl: true });
        if (pd?.localPath) {
          const e: CacheEntry = { original: src, url: pd.localPath, createdObjectUrl: false, ts: Date.now(), owners: new Set() };
          this.map.set(src, e);
          this.evictIfNeeded();
          return pd.localPath;
        }
        if (pd?.dataUrl) {
          const e: CacheEntry = { original: src, url: pd.dataUrl, createdObjectUrl: false, ts: Date.now(), owners: new Set() };
          // dataUrl returned; not createdObjectUrl
          this.map.set(src, e);
          this.evictIfNeeded();
          return pd.dataUrl;
        }
      }
    } catch (err) {
      // ignore
    }

    // 3) Fallback: fetch remote and create an object URL for stable UI binding
    try {
      const resp = await fetch(src, { cache: 'force-cache' });
      if (!resp.ok) {
        const e: CacheEntry = { original: src, url: src, createdObjectUrl: false, ts: Date.now() };
        this.map.set(src, e);
        this.evictIfNeeded();
        return src;
      }
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const e: CacheEntry = { original: src, url, createdObjectUrl: true, ts: Date.now(), owners: new Set() };
      this.map.set(src, e);
      this.evictIfNeeded();
      return url;
    } catch (err) {
      const e: CacheEntry = { original: src, url: src, createdObjectUrl: false, ts: Date.now() };
      this.map.set(src, e);
      this.evictIfNeeded();
      return src;
    }
  }

  // Revoke a cached url (if we created an object URL) and remove the mapping
  revokeForOriginal(src: string) {
    const e = this.map.get(src);
    if (!e) return;
    if (e.createdObjectUrl) {
      try { URL.revokeObjectURL(e.url); } catch {}
    }
    this.map.delete(src);
  }

  // Register an owner id (e.g. modal instance) which indicates the cached entry is in-use
  addOwnerForOriginal(src: string, ownerId: string) {
    if (!src) return;
    // try exact key first
    let e = this.map.get(src);
    if (!e) {
      // try finding by matching url value
      for (const [k, v] of this.map.entries()) {
        if (v.url === src) {
          e = v;
          break;
        }
      }
    }
    if (!e) {
      e = { original: src, url: src, createdObjectUrl: false, ts: Date.now(), owners: new Set() };
      this.map.set(src, e);
    }
    if (!e.owners) e.owners = new Set();
    e.owners.add(ownerId);
  }

  // Remove an owner; if no owners remain and we created an object URL, revoke it and remove mapping
  removeOwnerForOriginal(src: string, ownerId: string) {
    if (!src) return;
    let e = this.map.get(src);
    if (!e) {
      for (const [k, v] of this.map.entries()) {
        if (v.url === src) { e = v; break; }
      }
    }
    if (!e || !e.owners) return;
    e.owners.delete(ownerId);
    if (e.owners.size === 0) {
      if (e.createdObjectUrl) {
        try { URL.revokeObjectURL(e.url); } catch {}
      }
      // remove the map entry for this original key
      this.map.delete(e.original);
    }
  }

  // Revoke all object URLs created by this service
  clear() {
    for (const [k, v] of this.map.entries()) {
      if (v.createdObjectUrl) {
        try { URL.revokeObjectURL(v.url); } catch {}
      }
    }
    this.map.clear();
  }
}
