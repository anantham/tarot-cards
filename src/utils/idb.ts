// Lightweight IndexedDB helpers for storing generated cards
import type { GeneratedCard } from '../types';
import { debugLog } from './logger';

const DB_NAME = 'tarot-cards-idb';
const STORE_NAME = 'generatedCards';
const DB_VERSION = 3; // Increment to handle keyPath change

// Error notification system
let errorCallback: ((message: string, error: unknown) => void) | null = null;

export function setDatabaseErrorCallback(callback: (message: string, error: unknown) => void) {
  errorCallback = callback;
}

function notifyDatabaseError(message: string, error: unknown) {
  console.error(`[IDB] ${message}`, error);
  if (errorCallback) {
    errorCallback(message, error);
  }
}

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
      const transaction = request.transaction;

      debugLog(`[IDB Migration] Upgrading from version ${oldVersion} to ${DB_VERSION}`);

      try {
        // Version 1: Create initial object store with timestamp as keyPath
        if (oldVersion < 1) {
          debugLog('[IDB Migration] Creating v1 schema...');
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            const store = db.createObjectStore(STORE_NAME, { keyPath: 'timestamp' });
            store.createIndex('by-card-deck', ['cardNumber', 'deckType'], { unique: false });
            debugLog('[IDB Migration] v1 schema created successfully');
          }
        }

        // Version 2: Add indexes for sharing features
        if (oldVersion < 2 && oldVersion >= 1) {
          debugLog('[IDB Migration] Upgrading to v2...');
          if (transaction && db.objectStoreNames.contains(STORE_NAME)) {
            const store = transaction.objectStore(STORE_NAME);

            // Add new indexes
            if (!store.indexNames.contains('by-source')) {
              store.createIndex('by-source', 'source', { unique: false });
            }
            if (!store.indexNames.contains('by-shared')) {
              store.createIndex('by-shared', 'shared', { unique: false });
            }

            debugLog('[IDB Migration] v2 indexes created, migrating records...');

            // Migrate existing records to add shared and source fields
            // This must complete synchronously within the upgrade transaction
            const cursorRequest = store.openCursor();

            cursorRequest.onsuccess = (cursorEvent) => {
              const cursor = (cursorEvent.target as IDBRequest<IDBCursorWithValue | null>).result;
              if (cursor) {
                const card = cursor.value as GeneratedCard;
                if (card.shared === undefined || card.source === undefined) {
                  const updatedCard = {
                    ...card,
                    shared: card.shared ?? false,
                    source: card.source ?? 'local',
                  };
                  cursor.update(updatedCard);
                }
                cursor.continue();
              } else {
                debugLog('[IDB Migration] v2 record migration complete');
              }
            };

            cursorRequest.onerror = () => {
              console.error('[IDB Migration] v2 migration cursor error:', cursorRequest.error);
            };
          }
        }

        // Version 3: Migrate from 'id' keyPath to 'timestamp' keyPath
        // This handles the case where db was created with old v1 schema (keyPath: 'id')
        if (oldVersion < 3 && oldVersion >= 1) {
          debugLog('[IDB Migration] Upgrading to v3 (keyPath migration)...');

          if (transaction && db.objectStoreNames.contains(STORE_NAME)) {
            const oldStore = transaction.objectStore(STORE_NAME);

            // Check if we actually need to migrate (if keyPath is already 'timestamp', skip)
            if (oldStore.keyPath === 'timestamp') {
              debugLog('[IDB Migration] KeyPath already correct, skipping v3 migration');
            } else {
              debugLog('[IDB Migration] Migrating keyPath from "id" to "timestamp"...');

              // Collect all data synchronously using cursor
              const dataToMigrate: GeneratedCard[] = [];
              const cursorRequest = oldStore.openCursor();

              cursorRequest.onsuccess = (cursorEvent) => {
                const cursor = (cursorEvent.target as IDBRequest<IDBCursorWithValue | null>).result;

                if (cursor) {
                  const card = cursor.value as GeneratedCard & { id?: string };
                  // Remove old 'id' field and ensure required fields exist
                  const { id, ...cleanCard } = card;
                  dataToMigrate.push({
                    ...cleanCard,
                    shared: cleanCard.shared ?? false,
                    source: cleanCard.source ?? 'local',
                  } as GeneratedCard);
                  cursor.continue();
                } else {
                  // All data collected, now perform migration
                  debugLog(`[IDB Migration] Collected ${dataToMigrate.length} cards for migration`);

                  try {
                    // Delete old store
                    db.deleteObjectStore(STORE_NAME);
                    debugLog('[IDB Migration] Old store deleted');

                    // Create new store with correct keyPath
                    const newStore = db.createObjectStore(STORE_NAME, { keyPath: 'timestamp' });
                    newStore.createIndex('by-source', 'source', { unique: false });
                    newStore.createIndex('by-shared', 'shared', { unique: false });
                    newStore.createIndex('by-card-deck', ['cardNumber', 'deckType'], { unique: false });
                    debugLog('[IDB Migration] New store created with timestamp keyPath');

                    // Re-insert all data into new store
                    dataToMigrate.forEach((card, index) => {
                      try {
                        newStore.add(card);
                      } catch (addError) {
                        console.error(`[IDB Migration] Failed to add card ${index}:`, addError, card);
                      }
                    });

                    debugLog(`[IDB Migration] Successfully migrated ${dataToMigrate.length} cards to v3`);
                  } catch (storeError) {
                    console.error('[IDB Migration] CRITICAL: Failed to recreate store:', storeError);
                    throw storeError;
                  }
                }
              };

              cursorRequest.onerror = () => {
                console.error('[IDB Migration] CRITICAL: Cursor read failed during v3 migration:', cursorRequest.error);
                throw cursorRequest.error;
              };
            }
          }
        }

        debugLog(`[IDB Migration] Migration to version ${DB_VERSION} completed successfully`);
      } catch (migrationError) {
        console.error('[IDB Migration] CRITICAL ERROR during migration:', migrationError);
        // Allow error to propagate to request.onerror
        throw migrationError;
      }
    };

    request.onsuccess = () => {
      debugLog(`[IDB] Database opened successfully at version ${request.result.version}`);
      resolve(request.result);
    };

    request.onerror = () => {
      const error = request.error ?? new Error('Failed to open IndexedDB');
      console.error('[IDB] Failed to open database:', error);
      reject(error);
    };

    request.onblocked = () => {
      console.warn('[IDB] Database upgrade blocked. Please close other tabs with this app open.');
    };
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
    debugLog(`[IDB] Successfully retrieved ${result?.length || 0} cards`);
    return result || [];
  } catch (error) {
    console.error('[IDB] getAllGeneratedCards failed:', error);
    // Return empty array but surface error to user
    notifyDatabaseError('Failed to load generated cards from storage', error);
    return [];
  }
}

export async function putGeneratedCard(card: GeneratedCard): Promise<void> {
  try {
    await withStore('readwrite', (store) => store.put(card));
    debugLog(`[IDB] Successfully saved card ${card.cardNumber} (${card.deckType})`);
  } catch (error) {
    console.error('[IDB] putGeneratedCard failed', error);
    notifyDatabaseError('Failed to save generated card to storage', error);
    throw error; // Re-throw so caller knows it failed
  }
}

export async function clearGeneratedCardsStore(): Promise<void> {
  try {
    await withStore('readwrite', (store) => store.clear());
    debugLog('[IDB] Successfully cleared all generated cards');
  } catch (error) {
    console.error('[IDB] clearGeneratedCardsStore failed', error);
    notifyDatabaseError('Failed to clear generated cards from storage', error);
    throw error;
  }
}

export async function deleteGeneratedCardFromStore(timestamp: number): Promise<void> {
  try {
    await withStore('readwrite', (store) => store.delete(timestamp));
    debugLog(`[IDB] Successfully deleted card with timestamp ${timestamp}`);
  } catch (error) {
    console.error('[IDB] deleteGeneratedCardFromStore failed', error);
    notifyDatabaseError('Failed to delete generated card from storage', error);
    throw error;
  }
}

export async function getUnsharedCards(): Promise<GeneratedCard[]> {
  try {
    const db = await openDB();
    return new Promise<GeneratedCard[]>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);

      // Always use getAll and filter in memory to avoid index query issues
      // This is more robust when 'shared' field might be undefined during migration
      const request = store.getAll();

      request.onsuccess = () => {
        const all = request.result || [];
        // Filter for cards where shared is explicitly false OR undefined (not migrated yet)
        // We treat undefined as "not shared" since it's a locally generated card
        const unshared = all.filter((card: GeneratedCard) =>
          card.shared === false || card.shared === undefined
        );
        debugLog(`[IDB] Retrieved ${unshared.length} unshared cards out of ${all.length} total`);
        resolve(unshared);
      };

      request.onerror = () => {
        const error = request.error ?? new Error('Failed to get unshared cards');
        console.error('[IDB] getUnsharedCards request failed:', error);
        reject(error);
      };
    });
  } catch (error) {
    console.error('[IDB] getUnsharedCards failed', error);
    notifyDatabaseError('Failed to load unshared cards', error);
    return [];
  }
}

export async function markCardsAsShared(timestamps: number[]): Promise<void> {
  try {
    debugLog(`[IDB] Marking ${timestamps.length} cards as shared...`);
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);

    await new Promise<void>((resolve, reject) => {
      // Use direct key access with timestamp as keyPath
      let completed = 0;
      const total = timestamps.length;

      if (total === 0) {
        debugLog('[IDB] No cards to mark as shared');
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
          } else {
            console.warn(`[IDB] Card with timestamp ${timestamp} not found`);
          }

          completed++;
          if (completed === total) {
            tx.oncomplete = () => {
              debugLog(`[IDB] Successfully marked ${total} cards as shared`);
              resolve();
            };
            tx.onerror = () => {
              const error = tx.error ?? new Error('Failed to mark cards as shared');
              console.error('[IDB] Transaction error:', error);
              reject(error);
            };
          }
        };

        getRequest.onerror = () => {
          const error = getRequest.error ?? new Error(`Failed to get card with timestamp ${timestamp}`);
          console.error('[IDB] Get request error:', error);
          reject(error);
        };
      });
    });
  } catch (error) {
    console.error('[IDB] markCardsAsShared failed', error);
    notifyDatabaseError('Failed to mark cards as shared', error);
    throw error;
  }
}
