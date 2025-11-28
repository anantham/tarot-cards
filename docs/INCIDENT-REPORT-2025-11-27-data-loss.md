# Incident Report: IndexedDB Data Loss
**Date:** 2025-11-27
**Severity:** Critical
**Impact:** Permanent loss of user-generated tarot card data
**Status:** Root cause identified, mitigation pending

---

## Executive Summary

A critical bug in the IndexedDB schema migration code (`src/utils/idb.ts`) resulted in permanent deletion of all user-generated tarot cards. The bug was introduced in commit `30e6c4a` on November 26, 2025, and triggered when the user opened the application after the deployment of schema version 3.

**Root Cause:** Asynchronous database read operation executed after synchronous store deletion, causing data to be destroyed before it could be backed up and migrated.

**Data Lost:** All user-generated tarot card images, videos, and associated metadata stored in IndexedDB.

---

## Timeline of Events

### November 23, 2025
- **Initial Implementation** (Commit `3bff975`)
  - IndexedDB v1 schema created with `keyPath: 'id'`
  - Store name: `generatedCards`
  - Users began generating and storing tarot cards
  - Data accumulated in production use

### November 26, 2025 - 19:47 IST
- **Schema v2 Released** (Commit `6ec9372`)
  - Added `shared` and `source` fields
  - Added indexes: `by-source`, `by-shared`
  - Migration logic added to upgrade existing records

- **Schema v3 Released** (Commit `30e6c4a`)
  - Changed `keyPath` from `'id'` to `'timestamp'`
  - **Critical Bug Introduced:** Destructive migration logic with async timing issue
  - Migration attempted to:
    1. Read all existing cards (async operation)
    2. Delete old store (sync operation)
    3. Create new store (sync operation)
    4. Re-insert cards (would execute after upgrade window closed)

### November 27, 2025
- **Incident Detected**
  - User reported cards not loading in application
  - Diagnostic investigation revealed:
    - Database exists at version 1
    - `generatedCards` store does not exist
    - No data present in database
  - Root cause analysis performed via git history and code review

---

## Root Cause Analysis

### The Vulnerable Code

**File:** `src/utils/idb.ts:61-92`

```javascript
// Version 3: Migrate from 'id' keyPath to 'timestamp' keyPath
if (oldVersion < 3 && oldVersion >= 1) {
  const transaction = request.transaction;
  if (transaction) {
    // Read all existing records from old store
    const oldStore = transaction.objectStore(STORE_NAME);
    const getAllRequest = oldStore.getAll();  // ⚠️ ASYNC OPERATION

    getAllRequest.onsuccess = () => {          // ⚠️ CALLBACK EXECUTES LATER
      const existingCards = getAllRequest.result || [];

      // Delete the old store
      db.deleteObjectStore(STORE_NAME);        // ❌ EXECUTES IMMEDIATELY

      // Create new store with timestamp as keyPath
      const newStore = db.createObjectStore(STORE_NAME, { keyPath: 'timestamp' });

      // Recreate all indexes
      newStore.createIndex('by-source', 'source', { unique: false });
      newStore.createIndex('by-shared', 'shared', { unique: false });
      newStore.createIndex('by-card-deck', ['cardNumber', 'deckType'], { unique: false });

      // Re-insert all records (remove 'id' field if present)
      existingCards.forEach((card) => {
        const { id, ...cleanCard } = card;
        newStore.add(cleanCard);               // ❌ NEVER EXECUTES IN UPGRADE CONTEXT
      });
    };
  }
}
```

### The Fatal Flaw

**Problem:** IndexedDB's `onupgradeneeded` event requires all schema modifications to happen **synchronously** during the upgrade transaction. The code violated this constraint by:

1. **Initiating an async read** (`getAll()` on line 67)
2. **Deleting the store synchronously** (line 73)
3. **Attempting to restore data in async callback** (lines 84-88)

**What Actually Happened:**

```
┌─────────────────────────────────────────────────────────────┐
│ onupgradeneeded Event (Synchronous Execution Context)       │
├─────────────────────────────────────────────────────────────┤
│ 1. oldVersion = 1, newVersion = 3                           │
│ 2. Start async getAllRequest.getAll()  ← Request queued     │
│ 3. db.deleteObjectStore(STORE_NAME)    ← STORE DELETED!     │
│ 4. db.createObjectStore(...)           ← New empty store    │
│ 5. Upgrade transaction COMMITS                              │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ After Upgrade Completes (Async Callback Context)            │
├─────────────────────────────────────────────────────────────┤
│ 6. getAllRequest.onsuccess fires                            │
│ 7. existingCards = [] (store was deleted, no data read)     │
│ 8. Attempts to re-insert cards into wrong transaction       │
│ 9. Code fails silently or errors out                        │
│                                                              │
│ RESULT: Data permanently lost                               │
└─────────────────────────────────────────────────────────────┘
```

### Why This Is Catastrophic

1. **No Backup Strategy:** Cards were stored exclusively in IndexedDB
2. **No localStorage Fallback:** Despite Zustand persist middleware, only settings were persisted to localStorage
3. **Silent Failure:** The migration error was not surfaced to the user
4. **No Recovery Path:** Once deleted, IndexedDB data cannot be recovered
5. **Single Point of Failure:** Migration logic ran on first app load after upgrade

---

## Technical Deep Dive

### IndexedDB Upgrade Transaction Constraints

According to the [IndexedDB specification](https://w3c.github.io/IndexedDB/#database-api):

> Schema changes (creating/deleting stores and indexes) can only be performed in a `versionchange` transaction, which is opened automatically during the `onupgradeneeded` event.

**Critical Constraint:** This transaction must complete synchronously. Once the `onupgradeneeded` handler returns, the transaction commits and can no longer be modified.

### The Correct Migration Pattern

**Correct Approach for KeyPath Changes:**

```javascript
if (oldVersion < 3 && oldVersion >= 1) {
  const transaction = request.transaction;
  if (transaction) {
    // Step 1: Get ALL data synchronously using cursor (not getAll)
    const oldStore = transaction.objectStore(STORE_NAME);
    const dataToMigrate = [];

    // Use openCursor() which operates within the transaction
    const cursorRequest = oldStore.openCursor();

    cursorRequest.onsuccess = (event) => {
      const cursor = event.target.result;
      if (cursor) {
        dataToMigrate.push(cursor.value);
        cursor.continue();
      } else {
        // All data collected, now perform migration

        // Step 2: Delete old store
        db.deleteObjectStore(STORE_NAME);

        // Step 3: Create new store with new keyPath
        const newStore = db.createObjectStore(STORE_NAME, { keyPath: 'timestamp' });
        newStore.createIndex('by-source', 'source', { unique: false });
        newStore.createIndex('by-shared', 'shared', { unique: false });
        newStore.createIndex('by-card-deck', ['cardNumber', 'deckType'], { unique: false });

        // Step 4: Re-insert data into new store (still in upgrade transaction)
        dataToMigrate.forEach((card) => {
          const { id, ...cleanCard } = card;
          newStore.add(cleanCard);
        });
      }
    };
  }
}
```

**Key Differences:**
- Uses `openCursor()` instead of `getAll()` to iterate synchronously
- Collects data in array during cursor iteration
- Performs all schema changes AFTER data is collected but WITHIN same transaction
- All operations complete before `onupgradeneeded` returns

---

## Impact Assessment

### Data Loss Scope

**Confirmed Lost:**
- All generated tarot card images (base64 encoded PNGs)
- All generated tarot card videos (URLs or base64 encoded data)
- Card generation timestamps
- Card metadata (deck type, card number)
- Sharing status flags
- Source attribution

**Potentially Affected Users:**
- Primary user (Aditya) who generated cards between Nov 23-26
- Any other users who may have tested the application during this period

**Not Affected:**
- Application settings (stored in localStorage via Zustand persist)
- API keys and configuration
- Tarot deck definitions and lore (stored in `src/data/`)
- Application code and assets

### Business Impact

- **User Trust:** Critical incident requiring transparent communication
- **Development Time:** Hours lost debugging + time to regenerate cards
- **Data Recovery:** Impossible without external backups
- **User Experience:** Complete loss of personalized content

---

## Contributing Factors

### 1. Insufficient Testing

**Missing Test Coverage:**
- No unit tests for migration logic
- No integration tests simulating v1→v3 upgrade path
- No staging environment to test migrations before production

**Recommendation:**
```javascript
// Example test that would have caught this:
describe('IndexedDB Migration v1 to v3', () => {
  it('should preserve all card data when migrating keyPath', async () => {
    // Setup: Create v1 database with test data
    const testCards = [/* mock cards */];
    await seedV1Database(testCards);

    // Execute: Trigger v3 migration
    await openDB(); // This triggers upgrade

    // Assert: All cards still present
    const migratedCards = await getAllGeneratedCards();
    expect(migratedCards).toHaveLength(testCards.length);
    expect(migratedCards).toMatchObject(testCards);
  });
});
```

### 2. Lack of Backup Strategy

**No Redundancy:**
- IndexedDB was single source of truth
- No automatic backups to localStorage
- No export feature for manual backups
- No cloud sync or remote backup

**Code Evidence:**
```typescript
// src/store/useStore.ts:116-120
partialize: (state) => ({
  // Keep only lightweight settings in localStorage;
  // generated cards live in IndexedDB ← SINGLE POINT OF FAILURE
  settings: state.settings,
}),
```

### 3. Silent Error Handling

**Failures Not Surfaced:**
```typescript
// src/utils/idb.ts:116-123
export async function getAllGeneratedCards(): Promise<GeneratedCard[]> {
  try {
    const result = await withStore<GeneratedCard[]>('readonly', (store) => store.getAll());
    return result || [];
  } catch (error) {
    console.warn('[IDB] getAllGeneratedCards failed, falling back to empty list', error);
    return [];  // ← Silent failure, user never notified
  }
}
```

**Issue:** Migration errors were logged to console but not displayed to user, making debugging harder.

### 4. Complex Migration Logic

**High Cognitive Load:**
- Migration spanned 3 version jumps in single transaction
- Conditional logic for v1, v2, v3 paths
- Nested async operations within sync context
- Mixed concerns (schema changes + data transformation)

**Better Approach:** Incremental migrations (v1→v2, then v2→v3) with explicit testing at each step.

### 5. Insufficient Code Review

**Warning Signs Missed:**
- Async operation (`getAll()`) inside `onupgradeneeded`
- Synchronous store deletion before data read completes
- No error handling for migration failure
- No rollback mechanism

---

## Port Migration Issue

### Secondary Discovery

During debugging, we discovered the database port had changed:
- **Original:** `http://localhost:5173` (Vite default)
- **Current:** `http://localhost:3000` (custom config)

**Impact:** IndexedDB is origin-specific (protocol + host + port). Data at one port is invisible to another.

**However:** Investigation confirmed the database at port 5173 also had no store, indicating the migration bug occurred before or during the port change, or the data was never at 5173 in the first place.

---

## Prevention Measures

### Immediate Actions Required

1. **Fix Migration Bug**
   - Rewrite migration to use synchronous cursor iteration
   - Add comprehensive error handling
   - Log migration success/failure explicitly

2. **Add Data Backup**
   - Implement automatic localStorage backup of card metadata
   - Add periodic backup reminder UI
   - Create export/import JSON feature

3. **Add Monitoring**
   - Track migration success/failure metrics
   - Alert on empty database post-migration
   - User-visible error messages for data issues

4. **Testing**
   - Unit tests for all migration paths
   - Integration tests with real IndexedDB instances
   - Manual QA checklist for schema changes

### Long-Term Improvements

#### 1. Defense in Depth - Data Redundancy

```typescript
// Dual storage strategy
export async function addGeneratedCard(card: GeneratedCard) {
  // Primary: IndexedDB
  await putGeneratedCard(card);

  // Backup: localStorage (metadata only)
  const backup = getBackupFromLocalStorage();
  backup.push({
    timestamp: card.timestamp,
    cardNumber: card.cardNumber,
    deckType: card.deckType,
    hasImage: !!card.imageDataUrl,
    hasVideo: !!card.videoUrl,
  });
  localStorage.setItem('tarot-cards-backup', JSON.stringify(backup));

  // Remote: Optional cloud sync
  if (userEnabled('cloudSync')) {
    await uploadToIPFS(card);
  }
}
```

#### 2. Migration Safety Net

```typescript
// Pre-migration backup
request.onupgradeneeded = async (event) => {
  const db = request.result;
  const oldVersion = event.oldVersion;

  // STEP 1: Create safety backup BEFORE any changes
  if (oldVersion > 0) {
    await createMigrationBackup(db, oldVersion);
  }

  // STEP 2: Perform migration
  try {
    await performMigration(db, oldVersion);
  } catch (error) {
    // STEP 3: Restore from backup on failure
    console.error('Migration failed, restoring backup:', error);
    await restoreFromBackup(db);
    throw error;
  }
};
```

#### 3. User-Facing Export/Import

```typescript
// Features to implement:
- "Export All Cards" → Download JSON with full data
- "Import Cards" → Upload JSON to restore
- "Backup to Cloud" → IPFS/Web3.Storage integration
- "Backup Reminder" → Prompt after generating N cards
- "Migration Mode" → User confirmation before destructive changes
```

#### 4. Schema Versioning Best Practices

```typescript
// Explicit migration functions
const migrations = {
  1: (db) => {
    const store = db.createObjectStore('generatedCards', { keyPath: 'id' });
    return store;
  },
  2: (db, transaction) => {
    const store = transaction.objectStore('generatedCards');
    store.createIndex('by-source', 'source', { unique: false });
    store.createIndex('by-shared', 'shared', { unique: false });
  },
  3: (db, transaction) => {
    // Correct migration with cursor
    return migrateKeyPath(db, transaction, 'id', 'timestamp');
  },
};

// Run migrations incrementally
for (let v = oldVersion + 1; v <= DB_VERSION; v++) {
  await migrations[v](db, transaction);
}
```

#### 5. Testing Strategy

```javascript
// Test matrix:
describe('IndexedDB Migrations', () => {
  // Test all upgrade paths
  it('should migrate v1 → v2', ...);
  it('should migrate v2 → v3', ...);
  it('should migrate v1 → v3 (skip v2)', ...);

  // Test with data
  it('should preserve cards during v1 → v3', ...);

  // Test error cases
  it('should rollback on migration failure', ...);
  it('should handle corrupted data gracefully', ...);

  // Test edge cases
  it('should handle empty database', ...);
  it('should handle very large datasets (1000+ cards)', ...);
});
```

---

## Lessons Learned

### 1. Async/Await is NOT a Silver Bullet

**Lesson:** IndexedDB's event-based API has strict timing requirements that `async/await` can obscure. Critical operations must respect transaction boundaries.

### 2. Backups Are Not Optional

**Lesson:** Any data the user creates has value. A single source of truth without backup is a single point of failure. Always implement redundancy for user-generated content.

### 3. Migrations Are High-Risk Operations

**Lesson:** Schema migrations are among the most dangerous code paths. They require:
- Exhaustive testing across all version combinations
- Explicit backup before execution
- Rollback mechanisms for failures
- User notification and consent

### 4. Silent Failures Are Unacceptable

**Lesson:** Errors that affect user data must be surfaced prominently. Console logs are not sufficient for critical failures.

### 5. Code Review for Data Operations

**Lesson:** Any code that modifies or migrates user data requires:
- Multiple reviewers
- Explicit testing plan
- Staging environment validation
- Gradual rollout strategy

---

## Remediation Plan

### Phase 1: Stop the Bleeding (Immediate)

- [x] Identify root cause
- [x] Document incident
- [ ] Fix migration bug in `src/utils/idb.ts`
- [ ] Add error boundaries for database operations
- [ ] Display user-visible error messages

### Phase 2: Add Safety Nets (This Week)

- [ ] Implement localStorage backup system
- [ ] Add "Export All Cards" feature
- [ ] Add "Import Cards" feature
- [ ] Create pre-migration backup logic
- [ ] Add migration rollback capability

### Phase 3: Comprehensive Testing (Next Sprint)

- [ ] Write unit tests for all IDB operations
- [ ] Write integration tests for migrations
- [ ] Create test fixtures for v1, v2, v3 databases
- [ ] Set up automated migration testing in CI/CD
- [ ] Manual QA on multiple browsers

### Phase 4: Long-Term Resilience (Future)

- [ ] Implement optional cloud sync (IPFS/Web3.Storage)
- [ ] Add periodic automatic backups
- [ ] Create backup reminder UI
- [ ] Add "Restore from backup" UI
- [ ] Monitor database health metrics
- [ ] Set up error tracking (Sentry, etc.)

---

## Conclusion

This incident represents a critical failure in data management that resulted in permanent user data loss. The root cause was a fundamental misunderstanding of IndexedDB's transactional model, combined with insufficient testing and lack of backup infrastructure.

**Key Takeaway:** User data is sacred. Any system that stores user-generated content must treat data durability as a primary concern, not an afterthought.

**Commitment:** This project will implement comprehensive backup strategies, rigorous migration testing, and user-facing data export tools to ensure this never happens again.

---

## Appendix A: Affected Code

### File: `src/utils/idb.ts`

**Problematic Code Block (Lines 61-92):**
```javascript
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
      db.deleteObjectStore(STORE_NAME);  // BUG: Executes before getAll completes

      // Create new store with timestamp as keyPath
      const newStore = db.createObjectStore(STORE_NAME, { keyPath: 'timestamp' });

      // Recreate all indexes
      newStore.createIndex('by-source', 'source', { unique: false });
      newStore.createIndex('by-shared', 'shared', { unique: false });
      newStore.createIndex('by-card-deck', ['cardNumber', 'deckType'], { unique: false });

      // Re-insert all records (remove 'id' field if present)
      existingCards.forEach((card) => {
        // Remove the old 'id' field
        const { id, ...cleanCard } = card;
        newStore.add(cleanCard);  // BUG: Executes outside upgrade transaction
      });
    };
  }
}
```

### Git History

**Commit Chain:**
```
3bff975 - Nov 23 - Feat: Add core utilities for Physics, Storage, and Video (v1)
6ec9372 - Nov 26 - feat(idb): add schema v2 with sharing fields and migration (v2)
30e6c4a - Nov 26 - fix(idb): change keyPath to timestamp for multiple card generations (v3 - BUG INTRODUCED)
```

---

## Appendix B: Diagnostic Evidence

### Database State at Time of Investigation

```
Database Name: tarot-cards-idb
Version: 1
Object Stores: NONE
Status: Store "generatedCards" does not exist
Data Present: NO
```

### User Report

> "none of the cards are loading"

### Console Error

```
idb.ts:152 Uncaught (in promise) DataError: Failed to execute 'only' on 'IDBKeyRange':
The parameter is not a valid key.
    at idb.ts:152:35
```

This error occurred in the fixed `getUnsharedCards()` function when trying to query an index that didn't exist because the store itself didn't exist.

---

## Appendix C: Recovery Attempts

### Attempted Recovery Methods

1. **Check v1 database:** Store did not exist
2. **Check alternate ports:** No data found at 3000, 5173, 5174, 8080
3. **Check localStorage:** Only settings present, no card data
4. **Check git history:** No backup commits
5. **Check IPFS uploads:** No cards uploaded before data loss

### Conclusion: Data Unrecoverable

All recovery attempts failed. Data is permanently lost.

---

## Sign-off

**Report Prepared By:** Claude (AI Assistant)
**Date:** 2025-11-27
**Review Status:** Pending user review
**Next Steps:** Implement remediation plan phases 1-2

---

**Document Version:** 1.0
**Last Updated:** 2025-11-27 15:30 IST
