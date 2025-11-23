
const DB_NAME = 'QudratDB';
const STORE_NAME = 'KeyValueStore';
const DB_VERSION = 1;

export const storageService = {
  dbPromise: null as Promise<IDBDatabase> | null,

  getDB: () => {
    if (!storageService.dbPromise) {
      storageService.dbPromise = new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = (event) => {
          const db = (event.target as IDBOpenDBRequest).result;
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            db.createObjectStore(STORE_NAME);
          }
        };
        request.onsuccess = (event) => resolve((event.target as IDBOpenDBRequest).result);
        request.onerror = (event) => reject((event.target as IDBOpenDBRequest).error);
      });
    }
    return storageService.dbPromise;
  },

  getItem: async <T>(key: string): Promise<T | null> => {
    try {
        const db = await storageService.getDB();
        return new Promise((resolve, reject) => {
          const transaction = db.transaction(STORE_NAME, 'readonly');
          const store = transaction.objectStore(STORE_NAME);
          const request = store.get(key);
          request.onsuccess = () => resolve(request.result as T || null);
          request.onerror = () => reject(request.error);
        });
    } catch (e) {
        console.error('IndexedDB getItem error:', e);
        return null;
    }
  },

  setItem: async (key: string, value: any): Promise<void> => {
    try {
        const db = await storageService.getDB();
        return new Promise((resolve, reject) => {
          const transaction = db.transaction(STORE_NAME, 'readwrite');
          const store = transaction.objectStore(STORE_NAME);
          const request = store.put(value, key);
          request.onsuccess = () => resolve();
          request.onerror = () => reject(request.error);
        });
    } catch (e) {
        console.error('IndexedDB setItem error:', e);
    }
  },

  removeItem: async (key: string): Promise<void> => {
    try {
        const db = await storageService.getDB();
        return new Promise((resolve, reject) => {
          const transaction = db.transaction(STORE_NAME, 'readwrite');
          const store = transaction.objectStore(STORE_NAME);
          const request = store.delete(key);
          request.onsuccess = () => resolve();
          request.onerror = () => reject(request.error);
        });
    } catch (e) {
        console.error('IndexedDB removeItem error:', e);
    }
  }
};
