const DB_NAME = 'critterra-admin-tools';
const DB_VERSION = 1;
const STORE_NAME = 'kv';

interface KeyValueRecord {
  key: string;
  value: unknown;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'key' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Unable to open IndexedDB.'));
  });
}

export async function getAdminDbValue<T>(key: string): Promise<T | null> {
  const db = await openDb();

  return new Promise<T | null>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(key);

    request.onsuccess = () => {
      const record = request.result as KeyValueRecord | undefined;
      resolve((record?.value as T | undefined) ?? null);
    };
    request.onerror = () => reject(request.error ?? new Error(`Unable to read key "${key}" from IndexedDB.`));

    transaction.oncomplete = () => db.close();
    transaction.onerror = () => reject(transaction.error ?? new Error('IndexedDB read transaction failed.'));
  });
}

export async function setAdminDbValue(key: string, value: unknown): Promise<void> {
  const db = await openDb();

  return new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    store.put({ key, value });

    transaction.oncomplete = () => {
      db.close();
      resolve();
    };
    transaction.onerror = () => reject(transaction.error ?? new Error('IndexedDB write transaction failed.'));
  });
}
