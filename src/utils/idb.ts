// Lightweight IndexedDB helpers for storing generated cards
import type { GeneratedCard } from '../types';

const DB_NAME = 'tarot-cards-idb';
const STORE_NAME = 'generatedCards';
const DB_VERSION = 2; // Increment from 1

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

      // Version 1: Create initial object store
      if (oldVersion < 1) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id' });
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
    const id = `${card.deckType}-${card.cardNumber}`;
    await withStore('readwrite', (store) => store.put({ ...card, id }));
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

    // Get all cards and mark the ones with matching timestamps
    const getAllRequest = store.getAll();

    await new Promise<void>((resolve, reject) => {
      getAllRequest.onsuccess = () => {
        const cards = getAllRequest.result || [];
        const timestampSet = new Set(timestamps);

        // Update each matching card
        cards.forEach((card: GeneratedCard & { id: string }) => {
          if (timestampSet.has(card.timestamp)) {
            card.shared = true;
            store.put(card);
          }
        });

        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error ?? new Error('Failed to mark cards as shared'));
      };

      getAllRequest.onerror = () => reject(getAllRequest.error ?? new Error('Failed to get cards'));
    });
  } catch (error) {
    console.error('[IDB] markCardsAsShared failed', error);
    throw error;
  }
}
