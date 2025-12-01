This file explains how to set up offline storage for frontend-mobile

Recommended approach:

1) Native (Capacitor) builds
- Use Capacitor Filesystem to write photos to the device and Capacitor SQLite for high-performance relational storage if needed.
- Minimal packages to install in project root (frontend-mobile):

```powershell
npm install @capacitor/core @capacitor/filesystem @capacitor-community/sqlite dexie
npx cap sync
```

- If you use the Capacitor CLI to build mobile apps, ensure the native projects are added (`npx cap add android` / `npx cap add ios`) and run `npx cap open android` to work with native toolchains.

2) Web fallback
- `dexie` is used to store blobs and metadata in IndexedDB for web builds.
- No additional native plugins required.

Using the service (example)

In a component where you capture photos (File or Camera API):

```ts
constructor(private offline: OfflineStorageService) {}

async onPhotoTaken(file: Blob) {
  const fn = `capture.jpg`;
  const { id, localRef } = await this.offline.savePhoto(file, fn, { note: 'captured' });
  // store id/localRef with the record you send to the server later
}
```

Syncing
- Implement a background/foreground sync task that calls `getPendingPhotos()` and uploads them to the server, then calls `markUploaded(id)` on success.
- Consider exponential backoff and network checks before attempting uploads.

Notes
- This is an initial implementation using Dexie for metadata; for production on native consider `@capacitor-community/sqlite` for robust storage and queries.
- Filesystem directory uses `DATA` in the sample; adjust per platform and privacy rules.
