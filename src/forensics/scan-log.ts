// FeelingWise - Lightweight scan event log
// Records every post processed by the pipeline (pass, neutralize, or flag).
// This is the DENOMINATOR for all dashboard metrics — without it, we only see
// the numerator (neutralized posts) and can't compute real rates.
//
// Stored in a separate IndexedDB database to keep forensic records (heavy,
// append-only, integrity-hashed) separate from scan events (lightweight,
// purgeable, no hashing needed).

import { Platform, FeedSource } from '../types/post';

const DB_NAME = 'feelingwise-scans';
const DB_VERSION = 1;
const STORE_NAME = 'events';

export interface ScanEvent {
  timestamp: string;
  platform: Platform;
  feedSource: FeedSource;
  author: string;
  postId: string;
  action: 'pass' | 'neutralize' | 'flag' | 'comments-hidden' | 'comments-educational' | 'comments-rewritten';
  // Lightweight: no original text, no hash, no integrity chain
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { autoIncrement: true });
        store.createIndex('timestamp', 'timestamp', { unique: false });
        store.createIndex('platform', 'platform', { unique: false });
        store.createIndex('author', 'author', { unique: false });
        store.createIndex('action', 'action', { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function logScanEvent(event: ScanEvent): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).add(event);
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => { db.close(); reject(tx.error); };
    });
  } catch (err) {
    // Non-critical: scan logging failure should never block the pipeline
    console.warn('[FeelingWise] Scan log write failed:', err);
  }
}

export async function getScanEvents(since?: string): Promise<ScanEvent[]> {
  try {
    const db = await openDB();
    const events: ScanEvent[] = await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const request = tx.objectStore(STORE_NAME).getAll();
      request.onsuccess = () => { db.close(); resolve(request.result); };
      request.onerror = () => { db.close(); reject(request.error); };
    });
    if (!since) return events;
    return events.filter(e => e.timestamp >= since);
  } catch (err) {
    console.warn('[FeelingWise] Scan log read failed:', err);
    return [];
  }
}

export interface ScanStats {
  totalScanned: number;
  totalNeutralized: number;
  totalFlagged: number;
  totalPassed: number;
  byPlatform: Record<string, { scanned: number; flagged: number }>;
  byFeedSource: Record<string, { scanned: number; flagged: number }>;
  byAuthor: Record<string, { scanned: number; flagged: number }>;
  byHour: number[];  // 24 elements, index = hour
  flaggedByHour: number[];  // 24 elements
}

export async function computeScanStats(since?: string): Promise<ScanStats> {
  const events = await getScanEvents(since);

  const stats: ScanStats = {
    totalScanned: events.length,
    totalNeutralized: 0,
    totalFlagged: 0,
    totalPassed: 0,
    byPlatform: {},
    byFeedSource: {},
    byAuthor: {},
    byHour: new Array(24).fill(0),
    flaggedByHour: new Array(24).fill(0),
  };

  for (const e of events) {
    // Action counts
    if (e.action === 'neutralize' || e.action === 'comments-hidden' || e.action === 'comments-educational' || e.action === 'comments-rewritten') stats.totalNeutralized++;
    else if (e.action === 'flag') stats.totalFlagged++;
    else stats.totalPassed++;

    const isFlagged = e.action !== 'pass';

    // By platform
    if (!stats.byPlatform[e.platform]) stats.byPlatform[e.platform] = { scanned: 0, flagged: 0 };
    stats.byPlatform[e.platform].scanned++;
    if (isFlagged) stats.byPlatform[e.platform].flagged++;

    // By feed source
    const fs = e.feedSource || 'unknown';
    if (!stats.byFeedSource[fs]) stats.byFeedSource[fs] = { scanned: 0, flagged: 0 };
    stats.byFeedSource[fs].scanned++;
    if (isFlagged) stats.byFeedSource[fs].flagged++;

    // By author
    if (e.author && e.author !== 'unknown') {
      if (!stats.byAuthor[e.author]) stats.byAuthor[e.author] = { scanned: 0, flagged: 0 };
      stats.byAuthor[e.author].scanned++;
      if (isFlagged) stats.byAuthor[e.author].flagged++;
    }

    // By hour
    const hour = new Date(e.timestamp).getHours();
    stats.byHour[hour]++;
    if (isFlagged) stats.flaggedByHour[hour]++;
  }

  return stats;
}

/**
 * Purge scan events older than the given number of days.
 * Call periodically to prevent unbounded growth.
 */
export async function purgeScanEvents(olderThanDays: number): Promise<number> {
  try {
    const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000).toISOString();
    const db = await openDB();

    const allEvents: ScanEvent[] = await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const request = tx.objectStore(STORE_NAME).getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    // Get keys of old events
    const allKeys: IDBValidKey[] = await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const request = tx.objectStore(STORE_NAME).getAllKeys();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    let purged = 0;
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);

    for (let i = 0; i < allEvents.length; i++) {
      if (allEvents[i].timestamp < cutoff) {
        store.delete(allKeys[i]);
        purged++;
      }
    }

    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => { db.close(); reject(tx.error); };
    });

    if (purged > 0) {
      console.log(`[FeelingWise] Purged ${purged} scan events older than ${olderThanDays} days`);
    }

    return purged;
  } catch (err) {
    console.warn('[FeelingWise] Scan purge failed:', err);
    return 0;
  }
}
