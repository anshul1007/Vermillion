import { TestBed } from '@angular/core/testing';
import { ImageCacheService } from './image-cache.service';
import { LocalImageService } from './local-image.service';
import { OfflineStorageService } from './offline-storage.service';

describe('ImageCacheService (ownership)', () => {
  let svc: ImageCacheService;
  let localStub: Partial<LocalImageService>;
  let offlineStub: Partial<OfflineStorageService>;

  beforeEach(() => {
    localStub = {
      resolveImage: jasmine.createSpy('resolveImage').and.returnValue(Promise.resolve(null))
    } as any;
    offlineStub = {
      findPhotoByRemoteUrl: jasmine.createSpy('findPhotoByRemoteUrl').and.returnValue(Promise.resolve(null)),
      getPhotoData: jasmine.createSpy('getPhotoData').and.returnValue(Promise.resolve(null as any))
    } as any;

    svc = new ImageCacheService(localStub as any, offlineStub as any);

    // mock global URL.createObjectURL and revokeObjectURL
    (globalThis as any).URL = (globalThis as any).URL || {};
    (globalThis as any).URL.createObjectURL = jasmine.createSpy('createObjectURL').and.returnValue('blob:fake/1');
    (globalThis as any).URL.revokeObjectURL = jasmine.createSpy('revokeObjectURL');

    // mock fetch to return a blob-like response
    spyOn(globalThis as any, 'fetch').and.returnValue(Promise.resolve({ ok: true, blob: () => Promise.resolve(new Blob(['x'], { type: 'image/jpeg' })) }));
  });

  it('creates object URL and honors ownership', async () => {
    const original = 'https://example.com/photo.jpg';
    const url = await svc.ensureCached(original);
    expect(url).toBe('blob:fake/1');

    // add owner
    svc.addOwnerForOriginal(url!, 'owner1');
    // removing a different owner should not revoke
    svc.removeOwnerForOriginal(url!, 'owner2');
    expect((globalThis as any).URL.revokeObjectURL).not.toHaveBeenCalled();

    // removing actual owner should revoke and delete
    svc.removeOwnerForOriginal(url!, 'owner1');
    expect((globalThis as any).URL.revokeObjectURL).toHaveBeenCalledWith('blob:fake/1');
  });
});
