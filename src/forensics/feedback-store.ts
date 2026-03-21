// FeelingWise - User feedback store
// Stores user verdicts (confirmed/disputed) for calibration tracking

const DB_NAME = 'feelingwise-feedback';
const DB_VERSION = 1;
const STORE_NAME = 'verdicts';

export interface UserVerdict {
  postId: string;
  verdict: 'confirmed' | 'disputed';
  mode: 'child' | 'teen' | 'adult';
  timestamp: string;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { autoIncrement: true });
        store.createIndex('postId', 'postId', { unique: false });
        store.createIndex('timestamp', 'timestamp', { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function addVerdict(verdict: UserVerdict): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).add(verdict);
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => { db.close(); reject(tx.error); };
    });
  } catch (err) {
    console.error('[FeelingWise] Failed to store verdict:', err);
  }
}

export async function getVerdicts(): Promise<UserVerdict[]> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const request = tx.objectStore(STORE_NAME).getAll();
      request.onsuccess = () => { db.close(); resolve(request.result); };
      request.onerror = () => { db.close(); reject(request.error); };
    });
  } catch (err) {
    console.error('[FeelingWise] Failed to read verdicts:', err);
    return [];
  }
}
