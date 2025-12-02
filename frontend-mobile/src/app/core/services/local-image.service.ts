import { Injectable } from '@angular/core';
import { OfflineStorageService } from './offline-storage.service';
import { ApiService } from './api.service';
import { firstValueFrom } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class LocalImageService {
  constructor(private offline: OfflineStorageService, private api: ApiService) {}

  // Resolve an image source to a local URL. If image exists locally return it,
  // otherwise download, save and return the saved local reference.
  async resolveImage(src: string | null, filenameHint?: string): Promise<string | null> {
    if (!src) return null;

    // If src is a data URL already, return as-is and ensure it's stored locally
    if (src.startsWith('data:')) {
      try {
        const blob = await this.dataUrlToBlob(src);
        const saved = await this.offline.savePhoto(blob, filenameHint || this.suggestName(), { origin: 'inline' });
        const data = await this.offline.getPhotoData(saved.id);
        return data?.localPath || src;
      } catch (e) {
        return src;
      }
    }

    // Try to find in offline DB by matching original URL in metadata
    const existing = await this.offline.findPhotoByRemoteUrl(src);
    if (existing) {
      const data = await this.offline.getPhotoData(existing.id ?? existing);
      return data?.localPath || data?.dataUrl || null;
    }

    // Not found locally: download (via ApiService for backend paths) and save
    try {
      let blob: Blob | null = null;

      // If src is an absolute URL (http/https) decide whether to fetch directly
      if (/^https?:\/\//i.test(src)) {
        try {
          const parsed = new URL(src);
          const appOrigin = (typeof location !== 'undefined' && location.origin) ? location.origin : null;
          const devOrigin = appOrigin;
          // If the absolute URL appears to point to the current app/dev origin (eg. localhost:4300),
          // treat it as a backend photo path and use ApiService which will target the backend host.
          if (devOrigin && parsed.origin === devOrigin) {
            // Use the pathname as a relative path for ApiService
            const rel = parsed.pathname + (parsed.search || '');
            try {
              blob = await firstValueFrom(this.api.getPhotoBlob(rel));
            } catch (err) {
              // fallback to direct fetch
            }
          }

          if (!blob) {
            const resp = await fetch(src);
            if (!resp.ok) throw new Error('fetch failed');
            blob = await resp.blob();
          }
        } catch (err) {
          // If URL parsing fails, fallback to fetch
          const resp = await fetch(src);
          if (!resp.ok) throw new Error('fetch failed');
          blob = await resp.blob();
        }
      } else {
        // For relative or api paths, use ApiService which constructs the backend URL and attaches headers
        try {
          const fetched = await firstValueFrom(this.api.getPhotoBlob(src));
          blob = fetched as Blob;
        } catch (err) {
          // fallback to fetch as last resort
          const resp2 = await fetch(src);
          if (resp2.ok) blob = await resp2.blob();
        }
      }

      if (!blob) return src;

      const saved = await this.offline.savePhoto(blob, filenameHint || this.suggestName(), { origin: 'remote', remoteUrl: src });
      const data = await this.offline.getPhotoData(saved.id);
      return data?.localPath || data?.dataUrl || src;
    } catch (e) {
      return src;
    }
  }

  private dataUrlToBlob(dataUrl: string): Promise<Blob> {
    return fetch(dataUrl).then(r => r.blob());
  }

  private suggestName() {
    return `img_${Date.now()}.jpg`;
  }
}
