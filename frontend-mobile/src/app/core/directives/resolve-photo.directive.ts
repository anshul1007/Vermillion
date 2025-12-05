import { Directive, ElementRef, inject, OnInit } from '@angular/core';
import { LocalImageService } from '../services/local-image.service';

@Directive({
  selector: '[appResolvePhoto]',
  standalone: true
})
export class ResolvePhotoDirective implements OnInit {
  private elRef = inject(ElementRef) as ElementRef<HTMLImageElement>;
  private el: HTMLImageElement = this.elRef.nativeElement;
  private localImage = inject(LocalImageService);

  async ngOnInit() {
    try {
      const raw = this.el.getAttribute('src') || this.el.src || '';
      if (!raw) return;
      const trimmed = raw.trim();
      if (!/^(\/api\/entryexit\/photos\/|\/api\/photos\/|api\/entryexit\/photos\/|api\/photos\/)/i.test(trimmed)) {
        return;
      }
      // Prevent browser from requesting the raw API path by clearing src until resolved
      this.el.src = '';
      const resolved = await this.localImage.resolveImage(trimmed);
      if (resolved) this.el.src = resolved;
    } catch (e) {
      // ignore
    }
  }
}
