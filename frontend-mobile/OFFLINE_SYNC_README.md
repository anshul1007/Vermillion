Offline Sync (mobile)

Overview
- Uses Dexie (IndexedDB) on web and Capacitor SQLite on device (SQLite path to be completed).
- Queues offline actions in `sync_queue` and stores entities locally in `labours`, `visitors`, `attendances`.
- `SyncService` triggers automatic sync on network restore and provides a manual `Sync` button in dashboard.

How to test locally (browser)
1. Start the frontend-mobile app: `npm run watch` or `npm start` from `frontend-mobile`.
2. Open the app in the browser, log in (requires internet). 
3. Use the app and toggle network offline in devtools — observe the offline banner.
4. Perform registrations/checkin/checkouts — they will be queued in IndexedDB.
5. Re-enable network and click `Sync` or wait — the SyncService will attempt to sync queued items.

Notes
- The SQLite integration path (native) will be implemented next; current Dexie support enables web testing.
- Conflict resolution policy: last-write-wins by `updatedAt`, server-wins if unresolved.
- Attachments are stored locally via `Filesystem` and uploaded during sync (to be implemented).
- Audit logs are stored in `audit_logs` table whenever sync runs or errors occur.
