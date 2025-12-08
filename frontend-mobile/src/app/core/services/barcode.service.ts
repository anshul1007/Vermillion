import { Injectable, inject } from '@angular/core';
import { LoggerService } from './logger.service';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';

@Injectable({ providedIn: 'root' })
export class BarcodeService {
  private codeReader: any | null = null;
  private NotFoundException: any | null = null;
  private logger = inject(LoggerService);

  async scanBarcodeWithCamera(): Promise<string> {
    try {
      const photo = await Camera.getPhoto({
        quality: 90,
        allowEditing: false,
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Camera
      });

      if (!photo.dataUrl) throw new Error('No photo data');

      // Normalize/resize the image to avoid huge payloads or orientation issues
      const normalized = await this.normalizeDataUrl(photo.dataUrl, 1024);
      const code = await this.decodeBarcode(normalized);
      // reset reader to clear internal state if available
      try { this.codeReader?.reset(); } catch { }
      return code;
    } catch (error) {
      this.logger.error('Barcode scan error:', error);
      throw error;
    }
  }

  private async ensureReader() {
    if (this.codeReader) return;
    const zxing = await import('@zxing/library');
    const { BrowserMultiFormatReader, NotFoundException } = zxing as any;
    this.codeReader = new BrowserMultiFormatReader();
    this.NotFoundException = NotFoundException;
  }

  private async decodeBarcode(imageData: string): Promise<string> {
    await this.ensureReader();

    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = async () => {
        try {
          const result = await this.codeReader.decodeFromImageElement(img);
          resolve(result.getText());
        } catch (error) {
          if (this.NotFoundException && error instanceof this.NotFoundException) {
            reject(new Error('No barcode found in image'));
          } else {
            reject(error);
          }
        }
      };
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = imageData;
    });
  }

  // Draw DataURL into a canvas scaled to maxDimension and return a new DataURL
  private async normalizeDataUrl(dataUrl: string, maxDimension = 1024): Promise<string> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        try {
          const { width, height } = img;
          let w = width;
          let h = height;
          if (Math.max(w, h) > maxDimension) {
            const ratio = maxDimension / Math.max(w, h);
            w = Math.round(w * ratio);
            h = Math.round(h * ratio);
          }
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          if (!ctx) return reject(new Error('Canvas unsupported'));
          // draw the image; this also normalizes orientation when browsers apply it
          ctx.drawImage(img, 0, 0, w, h);
          const out = canvas.toDataURL('image/jpeg', 0.9);
          resolve(out);
        } catch (e) {
          reject(e);
        }
      };
      img.onerror = () => reject(new Error('Failed to load image for normalization'));
      img.src = dataUrl;
    });
  }
}
