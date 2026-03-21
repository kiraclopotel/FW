// FeelingWise - Author Intelligence Store
// Tracks per-author detection rates across sessions (Palantir's "Entity Ontology")

const DB_NAME = 'feelingwise-authors';
const DB_VERSION = 1;
const STORE_NAME = 'profiles';

export interface AuthorProfile {
  handle: string;
  platform: string;
  totalSeen: number;
  totalFlagged: number;
  techniques: Record<string, number>;
  firstSeen: string;
  lastSeen: string;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'handle' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function getAuthorProfile(handle: string): Promise<AuthorProfile | null> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const request = tx.objectStore(STORE_NAME).get(handle);
      request.onsuccess = () => { db.close(); resolve(request.result ?? null); };
      request.onerror = () => { db.close(); reject(request.error); };
    });
  } catch {
    return null;
  }
}

export async function updateAuthorProfile(
  handle: string,
  platform: string,
  flagged: boolean,
  techniques: string[],
): Promise<AuthorProfile> {
  const db = await openDB();
  const now = new Date().toISOString();

  // Get existing or create new
  const existing: AuthorProfile | undefined = await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const request = tx.objectStore(STORE_NAME).get(handle);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  const profile: AuthorProfile = existing ?? {
    handle,
    platform,
    totalSeen: 0,
    totalFlagged: 0,
    techniques: {},
    firstSeen: now,
    lastSeen: now,
  };

  profile.totalSeen++;
  if (flagged) {
    profile.totalFlagged++;
    for (const t of techniques) {
      profile.techniques[t] = (profile.techniques[t] || 0) + 1;
    }
  }
  profile.lastSeen = now;
  profile.platform = platform;

  // Put (upsert)
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(profile);
    tx.oncomplete = () => { db.close(); resolve(profile); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

export async function getAllAuthorProfiles(): Promise<AuthorProfile[]> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const request = tx.objectStore(STORE_NAME).getAll();
      request.onsuccess = () => { db.close(); resolve(request.result); };
      request.onerror = () => { db.close(); reject(request.error); };
    });
  } catch (err) {
    console.error('[FeelingWise] Failed to read author profiles:', err);
    return [];
  }
}

/** Returns suspicion boost for a known repeat offender */
export function getSuspicionBoost(profile: AuthorProfile | null): number {
  if (!profile) return 0;
  if (profile.totalSeen < 5) return 0;
  const flagRate = profile.totalFlagged / profile.totalSeen;
  return flagRate > 0.5 ? 0.15 : 0;
}
