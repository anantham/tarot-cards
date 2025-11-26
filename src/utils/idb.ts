// Lightweight IndexedDB helpers for storing generated cards
import type { GeneratedCard } from '../types';

const DB_NAME = 'tarot-cards-idb';
const STORE_NAME = 'generatedCards';
const DB_VERSION = 3; // Increment to handle keyPath change

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) {
      reject(new Error('IndexedDB not supported'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = request.result;
      const oldVersion = event.oldVersion;

      // Version 1: Create initial object store with timestamp as keyPath
      if (oldVersion < 1) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'timestamp' });
          // Add index to query by card and deck combination
          store.createIndex('by-card-deck', ['cardNumber', 'deckType'], { unique: false });
        }
      }

      // Version 2: Add indexes and migrate existing records
      if (oldVersion < 2) {
        const transaction = request.transaction;
        if (transaction) {
          const store = transaction.objectStore(STORE_NAME);

          // Add new indexes
          if (!store.indexNames.contains('by-source')) {
            store.createIndex('by-source', 'source', { unique: false });
          }
          if (!store.indexNames.contains('by-shared')) {
            store.createIndex('by-shared', 'shared', { unique: false });
          }

          // Migrate existing records to add shared and source fields
          const cursorRequest = store.openCursor();
          cursorRequest.onsuccess = (cursorEvent) => {
            const cursor = (cursorEvent.target as IDBRequest<IDBCursorWithValue | null>).result;
            if (cursor) {
              const card = cursor.value as GeneratedCard & { id: string };
              if (card.shared === undefined) {
                card.shared = false;
                card.source = 'local';
                cursor.update(card);
              }
              cursor.continue();
            }
          };
        }
      }

      // Version 3: Migrate from 'id' keyPath to 'timestamp' keyPath
      if (oldVersion < 3 && oldVersion >= 1) {
        const transaction = request.transaction;
        if (transaction) {
          // Read all existing records from old store
          const oldStore = transaction.objectStore(STORE_NAME);
          const getAllRequest = oldStore.getAll();

          getAllRequest.onsuccess = () => {
            const existingCards = getAllRequest.result || [];

            // Delete the old store
            db.deleteObjectStore(STORE_NAME);

            // Create new store with timestamp as keyPath
            const newStore = db.createObjectStore(STORE_NAME, { keyPath: 'timestamp' });

            // Recreate all indexes
            newStore.createIndex('by-source', 'source', { unique: false });
            newStore.createIndex('by-shared', 'shared', { unique: false });
            newStore.createIndex('by-card-deck', ['cardNumber', 'deckType'], { unique: false });

            // Re-insert all records (remove 'id' field if present)
            existingCards.forEach((card: GeneratedCard & { id?: string }) => {
              // Remove the old 'id' field
              const { id, ...cleanCard } = card as GeneratedCard & { id?: string };
              newStore.add(cleanCard);
            });
          };
        }
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Failed to open IndexedDB'));
  });
}

function withStore<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest
): Promise<T> {
  return openDB().then((db) => {
    return new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, mode);
      const store = tx.objectStore(STORE_NAME);
      const request = fn(store);

      request.onsuccess = () => resolve(request.result as T);
      request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'));
      tx.onabort = () => reject(tx.error ?? new Error('IndexedDB transaction aborted'));
    });
  });
}

export async function getAllGeneratedCards(): Promise<GeneratedCard[]> {
  try {
    const result = await withStore<GeneratedCard[]>('readonly', (store) => store.getAll());
    return result || [];
  } catch (error) {
    console.warn('[IDB] getAllGeneratedCards failed, falling back to empty list', error);
    return [];
  }
}

export async function putGeneratedCard(card: GeneratedCard): Promise<void> {
  try {
    await withStore('readwrite', (store) => store.put(card));
  } catch (error) {
    console.warn('[IDB] putGeneratedCard failed', error);
  }
}

export async function clearGeneratedCardsStore(): Promise<void> {
  try {
    await withStore('readwrite', (store) => store.clear());
  } catch (error) {
    console.warn('[IDB] clearGeneratedCardsStore failed', error);
  }
}

export async function getUnsharedCards(): Promise<GeneratedCard[]> {
  try {
    const db = await openDB();
    return new Promise<GeneratedCard[]>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);

      // Use the by-shared index to get all unshared cards
      if (store.indexNames.contains('by-shared')) {
        const index = store.index('by-shared');
        const range = IDBKeyRange.only(false);
        const request = index.getAll(range); // Get all with shared=false

        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error ?? new Error('Failed to get unshared cards'));
      } else {
        // Fallback if index doesn't exist yet
        const request = store.getAll();
        request.onsuccess = () => {
          const all = request.result || [];
          const unshared = all.filter((card: GeneratedCard) => card.shared === false);
          resolve(unshared);
        };
        request.onerror = () => reject(request.error ?? new Error('Failed to get unshared cards'));
      }
    });
  } catch (error) {
    console.warn('[IDB] getUnsharedCards failed', error);
    return [];
  }
}

export async function markCardsAsShared(timestamps: number[]): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);

    await new Promise<void>((resolve, reject) => {
      // Use direct key access with timestamp as keyPath
      let completed = 0;
      const total = timestamps.length;

      if (total === 0) {
        resolve();
        return;
      }

      timestamps.forEach((timestamp) => {
        const getRequest = store.get(timestamp);

        getRequest.onsuccess = () => {
          const card = getRequest.result as GeneratedCard | undefined;
          if (card) {
            card.shared = true;
            store.put(card);
          }

          completed++;
          if (completed === total) {
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error ?? new Error('Failed to mark cards as shared'));
          }
        };

        getRequest.onerror = () => reject(getRequest.error ?? new Error(`Failed to get card with timestamp ${timestamp}`));
      });
    });
  } catch (error) {
    console.error('[IDB] markCardsAsShared failed', error);
    throw error;
  }
}
