import { Injectable } from '@angular/core';
import { CapacitorSQLite, SQLiteConnection, SQLiteDBConnection } from '@capacitor-community/sqlite';
import { Capacitor } from '@capacitor/core';

@Injectable({ providedIn: 'root' })
export class LocalDbService {
  private sqlite: SQLiteConnection = new SQLiteConnection(CapacitorSQLite);
  private db: SQLiteDBConnection | null = null;
  private dbName = 'entryexit.db';

  async initDb(): Promise<void> {
    if (!Capacitor.isNativePlatform()) {
      console.warn('SQLite only works on native platforms. Using in-memory storage.');
      return;
    }

    try {
      this.db = await this.sqlite.createConnection(this.dbName, false, 'no-encryption', 1, false);
      await this.db.open();
      await this.createTables();
    } catch (error) {
      console.error('Error initializing database:', error);
    }
  }

  private async createTables(): Promise<void> {
    if (!this.db) return;

    const sql = `
      CREATE TABLE IF NOT EXISTS pending_operations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        clientId TEXT UNIQUE NOT NULL,
        operationType TEXT NOT NULL,
        data TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        createdAt INTEGER NOT NULL,
        syncedAt INTEGER
      );

      CREATE TABLE IF NOT EXISTS projects (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        isActive INTEGER DEFAULT 1
      );

      CREATE TABLE IF NOT EXISTS contractors (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        projectId INTEGER NOT NULL
      );
    `;

    await this.db.execute(sql);
  }

  async addPendingOperation(clientId: string, operationType: string, data: any): Promise<void> {
    if (!this.db) return;

    const sql = 'INSERT INTO pending_operations (clientId, operationType, data, createdAt) VALUES (?, ?, ?, ?)';
    await this.db.run(sql, [clientId, operationType, JSON.stringify(data), Date.now()]);
  }

  async getPendingOperations(): Promise<any[]> {
    if (!this.db) return [];

    const result = await this.db.query('SELECT * FROM pending_operations WHERE status = "pending" ORDER BY createdAt');
    return result.values || [];
  }

  async markOperationSynced(clientId: string): Promise<void> {
    if (!this.db) return;

    await this.db.run('UPDATE pending_operations SET status = "synced", syncedAt = ? WHERE clientId = ?', [Date.now(), clientId]);
  }

  async clearSyncedOperations(): Promise<void> {
    if (!this.db) return;

    await this.db.run('DELETE FROM pending_operations WHERE status = "synced" AND syncedAt < ?', [Date.now() - 7 * 24 * 60 * 60 * 1000]);
  }
}
