import { Injectable } from '@angular/core';
import { BrowserMultiFormatReader, NotFoundException } from '@zxing/library';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';

@Injectable({ providedIn: 'root' })
export class BarcodeService {
  private codeReader = new BrowserMultiFormatReader();

  async scanBarcodeWithCamera(): Promise<string> {
    try {
      const photo = await Camera.getPhoto({
        quality: 90,
        allowEditing: false,
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Camera
      });

      if (!photo.dataUrl) throw new Error('No photo data');

      return await this.decodeBarcode(photo.dataUrl);
    } catch (error) {
      console.error('Barcode scan error:', error);
      throw error;
    }
  }

  private async decodeBarcode(imageData: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = async () => {
        try {
          const result = await this.codeReader.decodeFromImageElement(img);
          resolve(result.getText());
        } catch (error) {
          if (error instanceof NotFoundException) {
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
}
