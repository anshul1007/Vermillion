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

    return photo.dataUrl || '';
  }

  async pickFromGallery(): Promise<string> {
    const photo = await Camera.getPhoto({
      quality: 80,
      allowEditing: true,
      resultType: CameraResultType.DataUrl,
      source: CameraSource.Photos
    });

    return photo.dataUrl || '';
  }
}
