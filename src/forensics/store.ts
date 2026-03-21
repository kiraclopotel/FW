// FeelingWise - IndexedDB forensic store
// Append-only database. Records cannot be modified through the app.

import { ForensicRecord } from '../types/forensic';

const DB_NAME = 'feelingwise-forensics';
const DB_VERSION = 1;
const STORE_NAME = 'records';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { autoIncrement: true });
        store.createIndex('timestamp', 'timestamp', { unique: false });
        store.createIndex('platform', 'platform', { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export interface RecordFilters {
  startDate?: string;
  endDate?: string;
  platform?: string;
  technique?: string;
}

export async function addRecord(record: ForensicRecord): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).add(record);
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => { db.close(); reject(tx.error); };
    });
  } catch (err) {
    console.error('[FeelingWise] Failed to store forensic record:', err);
  }
}

export async function getRecords(filters?: RecordFilters): Promise<ForensicRecord[]> {
  try {
    const db = await openDB();
    const records: ForensicRecord[] = await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const request = tx.objectStore(STORE_NAME).getAll();
      request.onsuccess = () => { db.close(); resolve(request.result); };
      request.onerror = () => { db.close(); reject(request.error); };
    });

    if (!filters) return records;

    return records.filter(r => {
      if (filters.startDate && r.timestamp < filters.startDate) return false;
      if (filters.endDate && r.timestamp > filters.endDate) return false;
      if (filters.platform && r.platform !== filters.platform) return false;
      if (filters.technique && !r.techniques.some(t => t.name === filters.technique)) return false;
      return true;
    });
  } catch (err) {
    console.error('[FeelingWise] Failed to read forensic records:', err);
    return [];
  }
}

export interface ForensicStats {
  total: number;
  byTechnique: Record<string, number>;
  byPlatform: Record<string, number>;
  today: number;
  thisWeek: number;
  thisMonth: number;
}

export async function getStats(): Promise<ForensicStats> {
  const records = await getRecords();
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay()).toISOString();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const stats: ForensicStats = {
    total: records.length,
    byTechnique: {},
    byPlatform: {},
    today: 0,
    thisWeek: 0,
    thisMonth: 0,
  };

  for (const r of records) {
    // Count by platform
    stats.byPlatform[r.platform] = (stats.byPlatform[r.platform] || 0) + 1;

    // Count by technique
    for (const t of r.techniques) {
      stats.byTechnique[t.name] = (stats.byTechnique[t.name] || 0) + 1;
    }

    // Time-based counts
    if (r.timestamp >= startOfDay) stats.today++;
    if (r.timestamp >= startOfWeek) stats.thisWeek++;
    if (r.timestamp >= startOfMonth) stats.thisMonth++;
  }

  return stats;
}
