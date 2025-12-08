import { Directive, ElementRef, inject, OnInit } from '@angular/core';
import { ImageCacheService } from '../services/image-cache.service';
import { PLACEHOLDER_DATA_URL } from '../constants/image.constants';

@Directive({
  selector: '[appResolvePhoto]',
  standalone: true
})
export class ResolvePhotoDirective implements OnInit {
  private elRef = inject(ElementRef) as ElementRef<HTMLImageElement>;
  private el: HTMLImageElement = this.elRef.nativeElement;
  private imageCache = inject(ImageCacheService);

  async ngOnInit() {
    try {
      const raw = this.el.getAttribute('src') || this.el.src || '';
      if (!raw) return;
      const trimmed = raw.trim();
      if (!/^(\/api\/entryexit\/photos\/|\/api\/photos\/|api\/entryexit\/photos\/|api\/photos\/)/i.test(trimmed)) {
        return;
      }

      // If cache has a synchronous value, use it immediately to avoid flicker
      const quick = this.imageCache.getCached(trimmed);
      if (quick) {
        this.el.src = quick;
        try { this.el.dataset['imageCacheOwner'] = `dir:${Math.random().toString(36).slice(2)}`; this.imageCache.addOwnerForOriginal(quick, this.el.dataset['imageCacheOwner']!); } catch {}
        return;
      }

      // set placeholder to avoid showing raw path while resolving
      try { this.el.src = PLACEHOLDER_DATA_URL; } catch {}

      // ensure stable cached url (this consults LocalImageService/OfflineStorage internally)
      const stable = await this.imageCache.ensureCached(trimmed);
      if (stable) {
        this.el.src = stable;
        try { const owner = `dir:${Math.random().toString(36).slice(2)}`; this.el.dataset['imageCacheOwner'] = owner; this.imageCache.addOwnerForOriginal(stable, owner); } catch {}
      }
    } catch (e) {
      // ignore
    }
  }

  // when directive is removed, remove ownership registration
  ngOnDestroy() {
    try {
      const owner = this.el.dataset['imageCacheOwner'];
      const src = this.el.src;
      if (owner && src) {
        try { this.imageCache.removeOwnerForOriginal(src, owner); } catch {}
      }
    } catch {}
  }
}
