import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import Dexie from 'dexie';

type DBMode = 'sqlite' | 'dexie';

@Injectable({ providedIn: 'root' })
export class OfflineDbService {
  private mode: DBMode = 'dexie';
  private dexie?: Dexie;
  private sqliteConn: any | null = null;

  constructor() {
    this.detectMode();
    try {
      // expose a debug helper on window for runtime verification on device/emulator
      if (typeof window !== 'undefined') (window as any).offlineDbTest = this.testSqlite?.bind(this);
    } catch (e) {
      // ignore
    }
  }

  private async detectMode() {
    const platform = Capacitor.getPlatform();
    if (platform === 'ios' || platform === 'android') {
      try {
        const sqliteModule: any = await import('@capacitor-community/sqlite');
        const SQLiteConnection = sqliteModule.SQLiteConnection || sqliteModule.SQLiteConnection;
        const CapacitorSQLite = sqliteModule.CapacitorSQLite || sqliteModule.CapacitorSQLite;
        if (SQLiteConnection && CapacitorSQLite) {
          const sqlite = new SQLiteConnection(CapacitorSQLite as any);
          // create connection and open
          const conn = await sqlite.createConnection('vermillion_offline', false, 'no-encryption', 1).catch((e: any) => { throw e; });
          await conn.open().catch((e: any) => { throw e; });
          this.sqliteConn = conn;
          // create tables if they don't exist
          const createStatements = `CREATE TABLE IF NOT EXISTS labours (id INTEGER PRIMARY KEY AUTOINCREMENT, clientId TEXT, data TEXT, createdAt TEXT, updatedAt TEXT);
CREATE TABLE IF NOT EXISTS visitors (id INTEGER PRIMARY KEY AUTOINCREMENT, clientId TEXT, data TEXT, createdAt TEXT, updatedAt TEXT);
CREATE TABLE IF NOT EXISTS attendances (id INTEGER PRIMARY KEY AUTOINCREMENT, clientId TEXT, data TEXT, createdAt TEXT, updatedAt TEXT);
CREATE TABLE IF NOT EXISTS sync_queue (id INTEGER PRIMARY KEY AUTOINCREMENT, entityType TEXT, operation TEXT, payload TEXT, clientId TEXT, createdAt TEXT);
CREATE TABLE IF NOT EXISTS audit_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, eventType TEXT, data TEXT, createdAt TEXT);
CREATE TABLE IF NOT EXISTS records (id INTEGER PRIMARY KEY AUTOINCREMENT, recordId TEXT UNIQUE, data TEXT, timestamp TEXT, updatedAt TEXT);
CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT);`;
          // try execute multiple statements if supported, otherwise split
          try {
            if ((conn as any).execute) await (conn as any).execute(createStatements);
            else {
              const stmts = createStatements.split('\n').map((s: string) => s.trim()).filter((s: string) => s.length > 0);
              for (const s of stmts) {
                if ((conn as any).run) await (conn as any).run(s).catch(() => {});
                else await (conn as any).execute?.(s).catch(() => {});
              }
            }
          } catch (e) {
            // table creation failed; close connection and fallback
            try { await conn.close(); } catch {}
            this.sqliteConn = null;
            this.mode = 'dexie';
            this.initDexie();
            return;
          }
          this.mode = 'sqlite';
          return;
        }
      } catch (e) {
        // dynamic import failed or runtime error — fallback to Dexie
        this.sqliteConn = null;
      }
    }

    // default to dexie
    this.mode = 'dexie';
    this.initDexie();
  }

  private initDexie() {
    this.dexie = new Dexie('vermillion_offline_db');
    this.dexie.version(1).stores({
      labours: '++id,clientId,updatedAt,createdAt',
      visitors: '++id,clientId,updatedAt,createdAt',
      attendances: '++id,clientId,updatedAt,createdAt',
      sync_queue: '++id,entityType,createdAt,clientId',
      audit_logs: '++id,eventType,createdAt',
      records: '++id,recordId,updatedAt,timestamp',
      meta: 'key'
    });
  }

  async add(table: string, value: any) {
    if (this.mode === 'dexie' && this.dexie) return (this.dexie.table(table) as any).add(value);
    if (this.mode === 'sqlite' && this.sqliteConn) {
      const json = JSON.stringify(value);
      const now = new Date().toISOString();
      try {
        // insert into a table that has data column
        const stmt = `INSERT INTO ${table} (data, createdAt, updatedAt) VALUES (?, ?, ?);`;
        if ((this.sqliteConn as any).run) {
          const res = await (this.sqliteConn as any).run(stmt, [json, now, now]);
          return res?.changes?.lastId || null;
        }
        // fallback attempt
        await (this.sqliteConn as any).execute?.(stmt.replace(/\?/, json));
        return null;
      } catch (e) {
        throw e;
      }
    }
    throw new Error('No DB available');
  }

  async put(table: string, value: any) {
    if (this.mode === 'dexie' && this.dexie) return (this.dexie.table(table) as any).put(value);
    if (this.mode === 'sqlite' && this.sqliteConn) {
      const json = JSON.stringify(value);
      const now = new Date().toISOString();
      try {
        if ((value as any).id) {
          const stmt = `UPDATE ${table} SET data = ?, updatedAt = ? WHERE id = ?;`;
          await (this.sqliteConn as any).run(stmt, [json, now, (value as any).id]);
          return (value as any).id;
        }
        const stmt = `INSERT INTO ${table} (data, createdAt, updatedAt) VALUES (?, ?, ?);`;
        const res = await (this.sqliteConn as any).run(stmt, [json, now, now]);
        return res?.changes?.lastId || null;
      } catch (e) {
        throw e;
      }
    }
    throw new Error('No DB available');
  }

  async getAll(table: string) {
    if (this.mode === 'dexie' && this.dexie) return (this.dexie.table(table) as any).toArray();
    if (this.mode === 'sqlite' && this.sqliteConn) {
      try {
        const q = await (this.sqliteConn as any).query(`SELECT id, data, createdAt, updatedAt FROM ${table} ORDER BY id ASC;`);
        const rows = q?.values || [];
        return rows.map((r: any) => ({ id: r.id, ...JSON.parse(r.data), createdAt: r.createdAt, updatedAt: r.updatedAt }));
      } catch (e) {
        throw e;
      }
    }
    throw new Error('No DB available');
  }

  async clear(table: string) {
    if (this.mode === 'dexie' && this.dexie) return (this.dexie.table(table) as any).clear();
    if (this.mode === 'sqlite' && this.sqliteConn) return await (this.sqliteConn as any).run(`DELETE FROM ${table};`);
    throw new Error('No DB available');
  }

  // Upsert record into `records` table using recordId as unique key
  async upsertRecord(recordId: string | number, data: any, updatedAt?: string) {
    const ts = updatedAt || new Date().toISOString();
    if (this.mode === 'dexie' && this.dexie) {
      const table = (this.dexie.table('records') as any);
      const existing = await table.where('recordId').equals(String(recordId)).first();
      const payload = { recordId: String(recordId), data, timestamp: ts, updatedAt: ts };
      if (existing) {
        await table.update(existing.id, payload);
      } else {
        await table.add(payload);
      }
      return;
    }
    if (this.mode === 'sqlite' && this.sqliteConn) {
      try {
        const q = await (this.sqliteConn as any).query(`SELECT id FROM records WHERE recordId = ?`, [String(recordId)]);
        const rows = q?.values || [];
        const json = JSON.stringify(data);
        if (rows.length > 0) {
          await (this.sqliteConn as any).run(`UPDATE records SET data = ?, updatedAt = ?, timestamp = ? WHERE id = ?`, [json, ts, ts, rows[0].id]);
        } else {
          await (this.sqliteConn as any).run(`INSERT INTO records (recordId, data, timestamp, updatedAt) VALUES (?, ?, ?, ?)`, [String(recordId), json, ts, ts]);
        }
        return;
      } catch (e) {
        throw e;
      }
    }
    throw new Error('No DB available');
  }

  // Runtime diagnostic for native sqlite — call from device WebView console:
  //   window.offlineDbTest().then(r=>console.log(r)).catch(e=>console.error(e))
  async testSqlite() {
    const result: any = { mode: this.mode, sqliteAvailable: false, actions: [] };
    try {
      // ensure detectMode completed
      if (!this.dexie && this.mode === 'dexie') this.initDexie();
      if (this.mode === 'sqlite' && !this.sqliteConn) {
        // try to detect again
        await this.detectMode();
      }

      if (this.mode === 'sqlite' && this.sqliteConn) {
        result.sqliteAvailable = true;
        try {
          // insert a test meta key
          const now = new Date().toISOString();
          const key = `diagnostic_${Date.now()}`;
          const json = JSON.stringify({ test: true, ts: now });
          // attempt insert
          if ((this.sqliteConn as any).run) {
            await (this.sqliteConn as any).run(`INSERT INTO meta (key, value) VALUES (?, ?);`, [key, json]);
            result.actions.push('inserted meta');
            const q = await (this.sqliteConn as any).query(`SELECT key, value FROM meta WHERE key = ?`, [key]);
            const rows = q?.values || [];
            result.actions.push({ read: rows });
            // cleanup
            await (this.sqliteConn as any).run(`DELETE FROM meta WHERE key = ?`, [key]);
            result.actions.push('deleted meta');
          } else if ((this.sqliteConn as any).execute) {
            await (this.sqliteConn as any).execute(`INSERT INTO meta (key, value) VALUES ('${key}', '${json}');`);
            result.actions.push('inserted meta via execute');
            const q = await (this.sqliteConn as any).query(`SELECT key, value FROM meta WHERE key = '${key}'`);
            result.actions.push({ read: q?.values || [] });
            await (this.sqliteConn as any).run?.(`DELETE FROM meta WHERE key = ?`, [key]);
          } else {
            result.actions.push('no runnable methods on sqliteConn');
          }
        } catch (e) {
          result.error = String(e);
        }
      } else {
        result.sqliteAvailable = false;
        result.actions.push('sqlite not active; using dexie');
      }
    } catch (e) {
      result.error = String(e);
    }
    console.log('OfflineDbService.testSqlite()', result);
    return result;
  }

  // Convenience helpers
  async enqueue(entityType: string, operation: 'create' | 'update' | 'delete', payload: any) {
    const entry = {
      entityType,
      operation,
      payload,
      clientId: payload?.clientId || null,
      createdAt: new Date().toISOString(),
    };
    return this.add('sync_queue', entry);
  }

  async audit(eventType: string, data: any) {
    const entry = { eventType, data, createdAt: new Date().toISOString() };
    return this.add('audit_logs', entry);
  }
}
