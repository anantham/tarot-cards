/**
 * IDB schema migration tests
 *
 * These tests verify that the onupgradeneeded migration logic in idb.ts
 * correctly preserves all card data across schema version upgrades.
 *
 * Each test gets a completely fresh in-memory IDB instance (via IDBFactory)
 * so migrations cannot interfere with each other.
 *
 * Upgrade paths covered:
 *   v0 → v3  fresh install, no prior data
 *   v1 → v3  common upgrade: adds shared/source fields, skips keyPath rebuild
 *   v1 → v3  legacy upgrade: rebuilds store when old keyPath was 'id' not 'timestamp'
 *   v2 → v3  adds-nothing upgrade: keyPath already correct, records preserved
 */

import { IDBFactory } from 'fake-indexeddb';
import { beforeEach, describe, it, expect, vi } from 'vitest';
import type { GeneratedCard } from '../types';

// Must match the private constants inside idb.ts
const DB_NAME = 'tarot-cards-idb';
const STORE_NAME = 'generatedCards';

// Minimal valid card fixture — timestamp is the keyPath in v3
const makeCard = (overrides: Partial<GeneratedCard> & { id?: string } = {}): GeneratedCard => ({
  cardNumber: 0,
  deckType: 'traditional-rider-waite',
  timestamp: 1_700_000_000_000,
  frames: ['data:image/jpeg;base64,abc'],
  prompt: 'The Fool stands at the precipice',
  shared: false,
  source: 'local',
  ...overrides,
});

// ─── Raw IDB helpers ────────────────────────────────────────────────────────
// These bypass idb.ts entirely so we can seed "old version" databases.

function rawOpen(
  version: number,
  upgrade: (db: IDBDatabase, tx: IDBTransaction) => void,
): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, version);
    req.onupgradeneeded = () => upgrade(req.result, req.transaction!);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function rawPut(db: IDBDatabase, records: object[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    records.forEach((r) => store.put(r));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ─── Setup ──────────────────────────────────────────────────────────────────

beforeEach(() => {
  // Fresh in-memory IDB for every test — prevents version leakage between runs.
  // idb.ts reads `indexedDB` from the global at call time, so this takes effect
  // for all subsequent openDB() calls in the module under test.
  globalThis.indexedDB = new IDBFactory();

  // Suppress [IDB Migration] console noise in test output
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('idb migration: v0 → v3 (fresh install)', () => {
  it('creates a valid v3 store and allows read/write with no prior data', async () => {
    const { getAllGeneratedCards, putGeneratedCard } = await import('./idb');

    const initial = await getAllGeneratedCards();
    expect(initial).toEqual([]);

    const card = makeCard({ timestamp: 1_000 });
    await putGeneratedCard(card);

    const result = await getAllGeneratedCards();
    expect(result).toHaveLength(1);
    expect(result[0].cardNumber).toBe(0);
    expect(result[0].shared).toBe(false);
    expect(result[0].source).toBe('local');
  });
});

describe('idb migration: v1 → v3 (common upgrade, timestamp keyPath)', () => {
  it('preserves all cards and backfills shared/source on records that lacked them', async () => {
    // Seed a v1 database — schema matches the v1 branch in idb.ts
    const db = await rawOpen(1, (d) => {
      const store = d.createObjectStore(STORE_NAME, { keyPath: 'timestamp' });
      store.createIndex('by-card-deck', ['cardNumber', 'deckType'], { unique: false });
    });

    // Three cards without shared/source (as they would have been in v1)
    await rawPut(db, [
      { cardNumber: 0, deckType: 'lord-of-mysteries', timestamp: 1_000, frames: ['f0'], prompt: 'p0' },
      { cardNumber: 1, deckType: 'lord-of-mysteries', timestamp: 2_000, frames: ['f1'], prompt: 'p1' },
      { cardNumber: 2, deckType: 'lord-of-mysteries', timestamp: 3_000, frames: ['f2'], prompt: 'p2' },
    ]);
    db.close();

    // Trigger migration by opening at v3 via idb.ts
    const { getAllGeneratedCards } = await import('./idb');
    const cards = await getAllGeneratedCards();

    expect(cards).toHaveLength(3);

    // All records must have shared and source backfilled
    for (const card of cards) {
      expect(card.shared).toBe(false);
      expect(card.source).toBe('local');
    }

    // Original data must be intact
    const sorted = cards.sort((a, b) => a.timestamp - b.timestamp);
    expect(sorted[0].cardNumber).toBe(0);
    expect(sorted[1].cardNumber).toBe(1);
    expect(sorted[2].cardNumber).toBe(2);
  });

  it('does not duplicate records when shared/source already exist on some cards', async () => {
    const db = await rawOpen(1, (d) => {
      const store = d.createObjectStore(STORE_NAME, { keyPath: 'timestamp' });
      store.createIndex('by-card-deck', ['cardNumber', 'deckType'], { unique: false });
    });

    await rawPut(db, [
      // Card that already has the fields (partial migration scenario)
      { cardNumber: 0, deckType: 'traditional-rider-waite', timestamp: 1_000, frames: ['f0'], prompt: 'p', shared: true, source: 'community' },
      // Card that lacks them
      { cardNumber: 1, deckType: 'traditional-rider-waite', timestamp: 2_000, frames: ['f1'], prompt: 'p' },
    ]);
    db.close();

    const { getAllGeneratedCards } = await import('./idb');
    const cards = await getAllGeneratedCards();

    expect(cards).toHaveLength(2);

    const already = cards.find((c) => c.timestamp === 1_000)!;
    expect(already.shared).toBe(true);     // must not overwrite existing value
    expect(already.source).toBe('community');

    const backfilled = cards.find((c) => c.timestamp === 2_000)!;
    expect(backfilled.shared).toBe(false);
    expect(backfilled.source).toBe('local');
  });
});

describe('idb migration: v1 → v3 (legacy upgrade, id keyPath)', () => {
  it('rebuilds the store with timestamp keyPath and preserves all card data', async () => {
    // Seed a v1 DB that used 'id' as keyPath (old schema before current v1 branch)
    const db = await rawOpen(1, (d) => {
      d.createObjectStore(STORE_NAME, { keyPath: 'id' });
    });

    await rawPut(db, [
      { id: 'card-a', cardNumber: 3, deckType: 'egyptian-tarot', timestamp: 5_000, frames: ['f3'], prompt: 'p3' },
      { id: 'card-b', cardNumber: 4, deckType: 'egyptian-tarot', timestamp: 6_000, frames: ['f4'], prompt: 'p4' },
    ]);
    db.close();

    const { getAllGeneratedCards } = await import('./idb');
    const cards = await getAllGeneratedCards();

    expect(cards).toHaveLength(2);

    // The old 'id' field must be stripped
    for (const card of cards) {
      expect((card as GeneratedCard & { id?: string }).id).toBeUndefined();
    }

    // Core data must survive
    const sorted = cards.sort((a, b) => a.timestamp - b.timestamp);
    expect(sorted[0].cardNumber).toBe(3);
    expect(sorted[0].timestamp).toBe(5_000);
    expect(sorted[1].cardNumber).toBe(4);
    expect(sorted[1].timestamp).toBe(6_000);

    // shared/source must be backfilled
    for (const card of cards) {
      expect(card.shared).toBe(false);
      expect(card.source).toBe('local');
    }
  });

  it('handles an empty legacy store without crashing', async () => {
    const db = await rawOpen(1, (d) => {
      d.createObjectStore(STORE_NAME, { keyPath: 'id' });
    });
    db.close();

    const { getAllGeneratedCards } = await import('./idb');
    const cards = await getAllGeneratedCards();

    expect(cards).toEqual([]);
  });
});

describe('idb migration: v2 → v3 (timestamp keyPath already correct)', () => {
  it('preserves all records without modification when keyPath is already timestamp', async () => {
    // Seed a v2 DB — has shared/source indexes and fields already
    const db = await rawOpen(2, (d, tx) => {
      const store = d.createObjectStore(STORE_NAME, { keyPath: 'timestamp' });
      store.createIndex('by-card-deck', ['cardNumber', 'deckType'], { unique: false });
      store.createIndex('by-source', 'source', { unique: false });
      store.createIndex('by-shared', 'shared', { unique: false });
    });

    await rawPut(db, [
      makeCard({ cardNumber: 10, timestamp: 10_000, shared: true, source: 'community' }),
      makeCard({ cardNumber: 11, timestamp: 11_000, shared: false, source: 'local' }),
    ]);
    db.close();

    const { getAllGeneratedCards } = await import('./idb');
    const cards = await getAllGeneratedCards();

    expect(cards).toHaveLength(2);

    // Existing field values must be unchanged
    const c10 = cards.find((c) => c.cardNumber === 10)!;
    expect(c10.shared).toBe(true);
    expect(c10.source).toBe('community');

    const c11 = cards.find((c) => c.cardNumber === 11)!;
    expect(c11.shared).toBe(false);
    expect(c11.source).toBe('local');
  });
});

describe('idb read/write invariants after migration', () => {
  it('deleteGeneratedCardFromStore removes only the target card', async () => {
    const { getAllGeneratedCards, putGeneratedCard, deleteGeneratedCardFromStore } = await import('./idb');

    const a = makeCard({ cardNumber: 0, timestamp: 1_000 });
    const b = makeCard({ cardNumber: 1, timestamp: 2_000 });
    await putGeneratedCard(a);
    await putGeneratedCard(b);

    await deleteGeneratedCardFromStore(1_000);
    const remaining = await getAllGeneratedCards();

    expect(remaining).toHaveLength(1);
    expect(remaining[0].timestamp).toBe(2_000);
  });

  it('getUnsharedCards returns only cards where shared is false or undefined', async () => {
    const { putGeneratedCard, getUnsharedCards } = await import('./idb');

    await putGeneratedCard(makeCard({ timestamp: 1_000, shared: false }));
    await putGeneratedCard(makeCard({ timestamp: 2_000, shared: true }));
    await putGeneratedCard(makeCard({ timestamp: 3_000, shared: false }));

    const unshared = await getUnsharedCards();
    expect(unshared).toHaveLength(2);
    expect(unshared.every((c) => c.shared !== true)).toBe(true);
  });

  it('markCardsAsShared flips shared to true for specified timestamps', async () => {
    const { getAllGeneratedCards, putGeneratedCard, markCardsAsShared } = await import('./idb');

    await putGeneratedCard(makeCard({ timestamp: 1_000, shared: false }));
    await putGeneratedCard(makeCard({ timestamp: 2_000, shared: false }));
    await putGeneratedCard(makeCard({ timestamp: 3_000, shared: false }));

    await markCardsAsShared([1_000, 3_000]);
    const cards = await getAllGeneratedCards();

    const c1 = cards.find((c) => c.timestamp === 1_000)!;
    const c2 = cards.find((c) => c.timestamp === 2_000)!;
    const c3 = cards.find((c) => c.timestamp === 3_000)!;

    expect(c1.shared).toBe(true);
    expect(c2.shared).toBe(false); // untouched
    expect(c3.shared).toBe(true);
  });
});
