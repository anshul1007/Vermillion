import { Injectable } from '@angular/core';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';

@Injectable({ providedIn: 'root' })
export class PhotoService {
  async takePhoto(): Promise<string> {
    const photo = await Camera.getPhoto({
      quality: 80,
      allowEditing: false,
      resultType: CameraResultType.DataUrl,
      source: CameraSource.Camera,
      saveToGallery: false
    });

    return photo.dataUrl ? this.normalizeDataUrl(photo.dataUrl) : '';
  }

  async pickFromGallery(): Promise<string> {
    const photo = await Camera.getPhoto({
      quality: 80,
      allowEditing: true,
      resultType: CameraResultType.DataUrl,
      source: CameraSource.Photos
    });

    return photo.dataUrl ? this.normalizeDataUrl(photo.dataUrl) : '';
  }

  private async normalizeDataUrl(dataUrl: string): Promise<string> {
    if (!dataUrl || dataUrl.startsWith('data:image/jpeg') || dataUrl.startsWith('data:image/png')) {
      return dataUrl;
    }

    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return dataUrl;
    }

    const image = new Image();
    const loadPromise = new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error('Image load failed'));
    });

    image.src = dataUrl;

    try {
      await loadPromise;
    } catch {
      return dataUrl;
    }

    const canvas = document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = image.height;
    const context = canvas.getContext('2d');
    if (!context) {
      return dataUrl;
    }

    context.drawImage(image, 0, 0);
    return canvas.toDataURL('image/jpeg', 0.95);
  }
}
