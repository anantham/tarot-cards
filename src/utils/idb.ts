// Lightweight IndexedDB helpers for storing generated cards
import type { GeneratedCard } from '../types';

const DB_NAME = 'tarot-cards-idb';
const STORE_NAME = 'generatedCards';
const DB_VERSION = 1;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) {
      reject(new Error('IndexedDB not supported'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
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
