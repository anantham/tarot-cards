# idb — IndexedDB Abstraction Layer

<!--
Last verified: 2026-03-05
Code hash: eb3205c
Verified by: agent
-->

## Purpose

Provides the persistent storage layer for generated tarot cards. All card data
that needs to survive page refreshes lives here. The rest of the app talks to
this module; nothing else touches `indexedDB` directly.

## Design Rationale

### Why IndexedDB over localStorage?

Generated cards carry base64-encoded image frames and video URLs — payloads of
5–50 MB per deck. localStorage has a hard 5–10 MB limit and blocks the main
thread on read/write. IndexedDB is async, has no practical size limit, and
supports structured data natively.

### Why a thin abstraction instead of a library (Dexie, idb)?

The card schema is stable and simple (one object store, three indexes). A thin
hand-rolled wrapper keeps the bundle small, makes migration logic explicit and
auditable, and avoids a dependency whose upgrade cycle we'd have to track.
Trade-off: more boilerplate per query.

### Why `timestamp` as the keyPath?

Each card generation is identified by its creation timestamp. Timestamps are
universally unique in practice (generation is not parallelised), are already
part of `GeneratedCard`, and make deletion by timestamp a direct key lookup
(`store.delete(timestamp)`) rather than a cursor scan.

### Why the error callback pattern instead of throwing?

IDB operations happen outside React's render cycle. Throwing from an async
IDB handler has nowhere useful to propagate — it would be swallowed silently.
The `setDatabaseErrorCallback` pattern lets `App.tsx` wire the IDB error path
to the global `showError` toast at startup, so failures are always visible to
the user without coupling this module to the UI layer.

### Key decisions

| Decision | Chosen | Alternatives considered | Why |
|----------|--------|------------------------|-----|
| Storage engine | IndexedDB | localStorage, sessionStorage | Size limits; async |
| Library | Hand-rolled | Dexie, idb (npm) | Bundle size; explicit migrations |
| Key design | `timestamp` (number) | Auto-increment, UUID | Already on the model; direct deletes |
| Error surfacing | Callback registration | throw, return Result | IDB is async; errors need a UI sink |
| Migration pattern | Synchronous cursor in `onupgradeneeded` | Async getAll | IDB transaction closes before async resolves |

## Schema History

| Version | Changes |
|---------|---------|
| v1 | Created `generatedCards` store with `keyPath: 'timestamp'`, `by-card-deck` compound index |
| v2 | Added `by-source` and `by-shared` indexes; backfilled `shared: false`, `source: 'local'` on existing records |
| v3 | Guards against old deployments that used `keyPath: 'id'`; if detected, rebuilds store with `keyPath: 'timestamp'` and re-inserts all data |

Current version: **3** (`DB_VERSION` constant in `idb.ts`).

## Public API

### `setDatabaseErrorCallback(callback)`

**Purpose:** Register the app-level error handler for IDB failures.
Called once at startup in `App.tsx`.

```typescript
setDatabaseErrorCallback((message, error) => {
  showError(message);
  console.error(message, error);
});
```

**Invariant:** Must be called before any read/write operations if you want
errors surfaced to the user. Safe to omit in tests (errors go to `console.error`).

---

### `getAllGeneratedCards(): Promise<GeneratedCard[]>`

Returns all cards in the store. Returns `[]` on error (never rejects).

---

### `putGeneratedCard(card: GeneratedCard): Promise<void>`

Upserts a card by `timestamp` key. Rejects on failure (caller must handle).

---

### `deleteGeneratedCardFromStore(timestamp: number): Promise<void>`

Deletes a single card by timestamp key. Rejects on failure.

---

### `clearGeneratedCardsStore(): Promise<void>`

Deletes all cards. Rejects on failure.

---

### `getUnsharedCards(): Promise<GeneratedCard[]>`

Returns cards where `shared === false || shared === undefined`.
Uses `getAll()` + in-memory filter (not the `by-shared` index) because
`shared` may be `undefined` on unmigrated records — index queries on
`undefined` are unreliable across browsers.

---

### `markCardsAsShared(timestamps: number[]): Promise<void>`

Flips `shared = true` on the given timestamps within a single transaction.
Uses per-key `get` + `put` rather than a cursor scan for predictable
per-card error isolation.

---

### `getSharedCards(): Promise<GeneratedCard[]>`

Returns cards where `shared === true`.

## Internal Architecture

```
openDB()                      ← single entry point for all operations
  └── indexedDB.open(v3)
        └── onupgradeneeded
              ├── oldVersion < 1  → create store + by-card-deck index
              ├── oldVersion 1→2  → add by-source, by-shared indexes
              │                     cursor-backfill shared/source fields
              └── oldVersion 1→3  → if keyPath === 'id': rebuild store
                                     collect via cursor → delete → recreate
                                     → re-insert all data

withStore(mode, fn)           ← thin helper: opens DB, runs fn(store), returns promise
  └── used by: getAllGeneratedCards, putGeneratedCard,
               deleteGeneratedCardFromStore, clearGeneratedCardsStore
```

`getUnsharedCards` and `markCardsAsShared` open the DB directly (via `openDB()`)
because they need multi-step transaction control that `withStore` doesn't provide.

## Migration Invariant

> **All cards present before a schema upgrade must be present and readable
> after the upgrade, with `shared` and `source` fields set.**

This invariant is tested in `src/utils/idb.migration.test.ts` across all
upgrade paths: v0→v3, v1→v3 (timestamp keyPath), v1→v3 (id keyPath), v2→v3.

## Dependencies

| Depends on | Why | Import path |
|------------|-----|-------------|
| `GeneratedCard` type | Shape of stored objects | `../types` |
| `debugLog` | Migration step logging | `./logger` |

Nothing in the application imports from `indexedDB` directly except this file.

## Known Limitations

- **No connection pooling:** Each public function calls `openDB()`, which
  opens a new connection. Acceptable for current usage patterns (not
  high-frequency concurrent writes).
- **In-memory filter for `getUnsharedCards`:** Fetches all records to filter
  in JS. Acceptable while card counts stay below ~100; revisit if users
  accumulate thousands of generations.
- **No retry logic:** Transient IDB errors (e.g. storage quota exceeded)
  surface to the user immediately. A retry with backoff could improve
  resilience on low-storage devices.

## Tech Debt

- `getUnsharedCards` and `markCardsAsShared` have bespoke transaction
  management duplicating what `withStore` does. Could be unified with a
  `withStoreMulti` helper if more multi-step operations are added.
- `by-shared` index exists but is not used for queries (see `getUnsharedCards`
  rationale above). Could be removed in a future schema version once all
  records are guaranteed to have `shared` defined.
