# Proposed Addition to CLAUDE.md

**Purpose:** Prevent data loss incidents like the 2025-11-27 IndexedDB migration bug.

---

## DATA INTEGRITY PROTOCOLS (Insert after "ANTI-PATTERNS TO AVOID")

### User Data is Sacred

**Core Principle:** User-generated data (cards, images, videos, settings with API keys) has irreplaceable value. Any code that touches user data requires maximum scrutiny.

### Destructive Operation Detection

**Before implementing ANY change, classify it:**

**🔴 DESTRUCTIVE OPERATIONS (Highest Risk)**
- Database migrations that change schemas
- Deleting object stores or tables
- Changing keyPath or primary keys
- Bulk delete/update operations
- File system deletions
- Cache clearing that affects user data

**🟡 RISKY OPERATIONS (Medium Risk)**
- Writing to database without backup
- Async operations in sync contexts (IndexedDB transactions!)
- Error handling that swallows failures silently
- Operations on production data without testing

**🟢 SAFE OPERATIONS (Low Risk)**
- Read-only queries
- Adding new fields with defaults
- Creating new stores/tables
- Logging and monitoring

---

## MANDATORY PROTOCOL FOR DESTRUCTIVE OPERATIONS

**If you classify an operation as 🔴 DESTRUCTIVE, you MUST:**

### 1. Pre-Operation Checklist (MANDATORY)

Before writing ANY code:

```
[ ] Backup Strategy: How will existing data be preserved?
[ ] Dry Run Plan: How will this be tested without affecting real data?
[ ] Rollback Plan: How can this be undone if it fails?
[ ] Detection Plan: How will we know if data was lost?
[ ] User Notification: Will users be warned/prompted?
```

**If ANY checkbox is unchecked, STOP and request user guidance.**

### 2. Backup-First Implementation Pattern

**ALWAYS back up before destructive operations:**

```typescript
// REQUIRED PATTERN for destructive operations
async function destructiveOperation() {
  // STEP 1: Create backup FIRST
  const backup = await createBackup();
  localStorage.setItem('operation-backup', JSON.stringify(backup));
  console.log(`✅ Backed up ${backup.length} records before operation`);

  // STEP 2: Perform operation with error handling
  try {
    await performDestructiveOperation();
    console.log('✅ Operation succeeded');
  } catch (error) {
    // STEP 3: Restore from backup on failure
    console.error('❌ Operation failed, restoring backup...');
    await restoreFromBackup(backup);
    throw error;
  }

  // STEP 4: Verify data integrity
  const postCount = await countRecords();
  const preCount = backup.length;
  if (postCount < preCount) {
    throw new Error(`Data loss detected: ${preCount} → ${postCount}`);
  }
}
```

**This pattern is MANDATORY. No exceptions.**

---

## DRY RUN REQUIREMENTS

**Before ANY destructive operation runs on real data:**

### 1. Test with Empty Database

```typescript
// First test: empty database
it('should handle empty database gracefully', async () => {
  // Start with empty DB
  const result = await destructiveOperation();
  expect(result).toBeDefined();
});
```

### 2. Test with Fixture Data

```typescript
// Second test: seeded database with fixtures
it('should preserve data during operation', async () => {
  // Seed database with test data
  const fixtures = [/* test data */];
  await seedDatabase(fixtures);

  // Run operation
  await destructiveOperation();

  // Verify all data still present
  const after = await getAllRecords();
  expect(after).toHaveLength(fixtures.length);
  expect(after).toMatchObject(fixtures);
});
```

### 3. Test with Real Data (Copy)

```bash
# Third test: copy production data to test environment
# Test on COPY of real data, never on production directly

# Export production data
npm run export-data prod > prod-data-backup.json

# Import to test environment
npm run import-data test < prod-data-backup.json

# Run operation on test environment
npm run destructive-operation test --dry-run

# Verify data integrity
npm run verify-data test

# If successful, THEN run on production with backup
npm run destructive-operation prod --backup-first
```

**If you cannot test with real data, STATE THIS EXPLICITLY and request user to provide test data or approve risk.**

---

## DATABASE MIGRATION SPECIFIC RULES

**IndexedDB and SQL migrations are especially dangerous because:**
1. Transactions have strict timing requirements
2. Schema changes must complete synchronously
3. No undo/rollback after commit

### IndexedDB Migration Pattern (MANDATORY)

```typescript
request.onupgradeneeded = (event) => {
  const db = request.result;
  const oldVersion = event.oldVersion;
  const transaction = request.transaction;

  console.log(`[Migration] Starting v${oldVersion} → v${DB_VERSION}`);

  // STEP 1: Backup BEFORE any changes (if possible)
  if (oldVersion > 0 && transaction) {
    // Synchronously collect existing data using cursor
    // Store in memory for restoration if needed
  }

  // STEP 2: Perform migration within transaction
  try {
    if (oldVersion < 2) {
      // Migration logic here
      // Use SYNCHRONOUS cursor iteration, NOT async getAll()
    }

    console.log('[Migration] Success');
  } catch (error) {
    console.error('[Migration] FAILED:', error);
    // Attempt rollback (if backup exists)
    throw error;
  }
};
```

**CRITICAL IndexedDB Constraints:**
- ❌ **NEVER use `getAll()` before schema changes** - it's async, executes AFTER transaction commits
- ✅ **ALWAYS use `openCursor()` for iteration** - it's synchronous within the transaction
- ❌ **NEVER delete stores before reading data**
- ✅ **ALWAYS collect data → delete → recreate → re-insert (in that order)**

---

## CONFIDENCE CALIBRATION FOR DATA OPERATIONS

**Special confidence requirements for destructive operations:**

### Automatic Low Confidence Triggers

If your code contains ANY of these patterns, confidence < 0.5 (MUST request validation):

- `deleteObjectStore()` or `DROP TABLE`
- `db.delete()` or `DELETE FROM`
- Async operations in `onupgradeneeded` handler
- Schema changes without rollback plan
- No backup before destructive operation
- No tests with fixture data

### Required Statements

**Before implementing destructive operation, you MUST state:**

```
Confidence: 0.X (explanation)
Risk Assessment:
  - Data Loss Risk: [HIGH/MEDIUM/LOW]
  - Reversibility: [YES/NO]
  - Backup Strategy: [description]
  - Test Coverage: [empty DB / fixtures / real data copy]

Request: User approval required before proceeding due to [reason]
```

**If you proceed without stating this, you have failed the protocol.**

---

## REVERSIBILITY REQUIREMENTS

**From `/designspace` macro - expanded for data operations:**

### Reversibility Checklist

For EVERY destructive operation, document:

```
Reversibility Analysis:
1. Can this operation be undone? [YES/NO]
2. If YES, how? [rollback script / restore from backup / manual fix]
3. If NO, what's the backup strategy? [mandatory]
4. Time window to reverse: [immediate / 30 days / never]
5. Data loss if reversal needed: [none / partial / complete]
```

**If Reversibility = NO and Backup Strategy = NONE:**
- 🚨 **STOP IMMEDIATELY**
- 🚨 **DO NOT IMPLEMENT**
- 🚨 **REQUEST USER GUIDANCE**

---

## TESTING REQUIREMENTS FOR DATA OPERATIONS

### Minimum Test Coverage (MANDATORY)

**Before ANY destructive code can be committed:**

1. **Unit Test: Empty Database**
   - Operation succeeds on empty DB
   - No errors thrown
   - Schema created correctly

2. **Unit Test: With Fixtures**
   - Seed DB with 10+ test records
   - Run operation
   - Verify ALL records preserved
   - Verify schema correct

3. **Integration Test: Migration Path**
   - Test v1→v2, v2→v3, and v1→v3 (skip paths)
   - Each path with fixture data
   - Verify no data loss in any path

4. **Manual Test: Real Data Copy**
   - Export production data
   - Import to test environment
   - Run operation on test
   - Verify with user before production

**If tests don't exist, you MUST create them BEFORE implementing destructive operation.**

---

## COMMIT MESSAGE REQUIREMENTS FOR DATA OPERATIONS

**For commits with destructive operations, add to TESTING section:**

```
TESTING:
- [ ] Tested on empty database
- [ ] Tested with fixture data (N records)
- [ ] Tested migration paths: [list]
- [ ] Backup created before operation: [location]
- [ ] Rollback plan documented: [plan]
- [ ] Data integrity verified: [pre-count] → [post-count]
- [ ] Dry run completed on test environment: [date]

DATA SAFETY:
- Reversibility: [YES/NO]
- Backup Strategy: [description]
- Risk Level: [HIGH/MEDIUM/LOW]
- User Approval: [YES/PENDING]
```

---

## PR REQUIREMENTS FOR DATA OPERATIONS

**Destructive operations MUST go through PR review:**

**PR Title must include:** `[DATA] [BREAKING]` prefix

**PR Description must include:**

```markdown
## ⚠️ DATA OPERATION WARNING

This PR contains DESTRUCTIVE operations that modify user data.

### Risk Assessment
- **Operation Type:** Schema migration / Bulk delete / etc.
- **Data Loss Risk:** HIGH / MEDIUM / LOW
- **Reversibility:** YES / NO
- **Affected Users:** All / Subset / Test only

### Safety Measures
- [x] Pre-operation backup implemented
- [x] Rollback plan documented
- [x] Tested on empty database
- [x] Tested with fixtures (N records)
- [x] Tested on real data copy
- [x] Data integrity checks added
- [x] User notification added (if applicable)

### Rollback Plan
If this operation fails or causes data loss:
1. [Step-by-step rollback instructions]
2. [Backup restoration procedure]
3. [Data verification steps]

### Test Results
- Empty DB: ✅ Pass
- Fixtures (N): ✅ Pass (N records preserved)
- Migration paths: ✅ Pass (v1→v2, v2→v3, v1→v3)
- Dry run on test: ✅ Pass (Date: YYYY-MM-DD)

**Reviewer:** Please verify rollback plan and test coverage before approving.
```

**Do NOT merge until:**
1. All tests pass
2. Rollback plan verified
3. User has approved (if real data affected)

---

## ANTI-PATTERNS FOR DATA OPERATIONS (NEW)

Add to existing anti-patterns list:

- **Data Cowboy:** Implementing destructive operations without backup-first pattern
- **Migration Gambler:** Testing migrations only on empty databases, not with fixtures
- **Async Trap:** Using async operations (getAll, async/await) in synchronous contexts (IndexedDB onupgradeneeded)
- **Silent Destroyer:** Catching errors in destructive operations without rollback
- **Trust-Me Coder:** Skipping dry runs because "I'm confident it will work"
- **Production Tester:** First test on production data instead of copy

---

## WHEN TO USE MACROS FOR DATA OPERATIONS

**MANDATORY macro usage for destructive operations:**

### 1. `/falsify` - BEFORE Implementation

**Use `/falsify` to test your migration logic:**

```
Claim: "Migration from v1 to v3 preserves all user data"

Hypotheses:
H1: Migration succeeds with all data preserved
H2: Async timing causes data loss before deletion
H3: Cursor iteration fails on large datasets
H4: Schema mismatch causes add() failures

Falsification Tests:
T1: Seed v1 DB with 100 records, run migration, verify 100 records in v3
T2: Test with empty DB
T3: Test with 10,000 records (stress test)
T4: Test with malformed data (edge cases)

Pre-Snapshot:
{
  "record_count": 100,
  "schema_version": 1,
  "keyPath": "id"
}

Post-Snapshot Expected:
{
  "record_count": 100,  // MUST match pre-snapshot
  "schema_version": 3,
  "keyPath": "timestamp"
}

Disconfirmatory Threshold:
- If post_count < pre_count by even 1 record: FAIL
- If any test fails: Stop and redesign

Decision Gate:
- All tests pass → Proceed to dry run on test environment
- Any test fails → Redesign migration logic
```

### 2. `/designspace` - For Migration Approach

**Use `/designspace` to evaluate migration options:**

```
Options:

A) In-place migration (delete & recreate)
   Reversibility: NO
   Risk: HIGH - data loss if migration fails mid-operation
   ❌ Rejected: No rollback possible

B) Copy-on-write migration (create new, keep old)
   Reversibility: YES (old store kept as backup)
   Risk: LOW - old data preserved for 30 days
   ✅ Recommended

C) Two-phase migration (export, recreate, import)
   Reversibility: YES (export file is backup)
   Risk: MEDIUM - requires two operations
   ✅ Alternative if storage permits

Chosen: Option B (Copy-on-write)
Rollback: If migration fails, delete new store, keep using old store
```

### 3. `/telos` - To Document Invariants

**Use `/telos` to document data integrity invariants:**

```
Invariants:
1. Record count after migration MUST equal record count before
2. All cardNumber values MUST be preserved exactly
3. All imageDataUrl values MUST remain valid base64
4. Migration MUST be atomic (all-or-nothing)
5. Backup MUST exist before any deletion

Failure Modes:
- Partial migration (some records lost): Rollback required
- Schema mismatch: Add fails → Rollback required
- Async timing issue: Collect data before delete → Fixed by cursor
```

---

## REAL WORLD EXAMPLE: The 2025-11-27 Incident

**What SHOULD have happened (following this protocol):**

1. **Classification:** 🔴 DESTRUCTIVE (schema migration with store deletion)

2. **Pre-Operation Checklist:**
   ```
   [ ] Backup Strategy: Export to localStorage before migration
   [ ] Dry Run Plan: Test with fixtures (v1 schema seeded)
   [ ] Rollback Plan: Keep old store for 30 days, restore if needed
   [ ] Detection Plan: Compare pre/post record counts
   [ ] User Notification: Prompt user to export data before upgrade
   ```

3. **Confidence Statement:**
   ```
   Confidence: 0.45 (LOW)
   Risk Assessment:
     - Data Loss Risk: HIGH (deleting object store)
     - Reversibility: NO (once deleted, data gone)
     - Backup Strategy: NONE (current code has no backup)
     - Test Coverage: Empty DB only (no fixtures)

   🚨 Request: STOP - Cannot proceed without backup strategy
   ```

4. **User Interaction:**
   ```
   "I need to implement a database migration that will delete and
   recreate the object store. This is a DESTRUCTIVE operation with
   HIGH data loss risk.

   Current code has NO backup strategy. I need your approval to:

   Option A: Implement backup-first pattern (export to localStorage)
   Option B: Use copy-on-write pattern (keep old store as backup)
   Option C: Defer this migration until backup infrastructure exists

   I recommend Option B. Which would you prefer?"
   ```

5. **If Approved, Implementation:**
   ```typescript
   // With backup-first pattern
   if (oldVersion < 3) {
     // Collect data BEFORE any changes
     const backup = [];
     const cursor = oldStore.openCursor();
     cursor.onsuccess = () => {
       if (cursor) {
         backup.push(cursor.value);
         cursor.continue();
       } else {
         // All data collected, now migrate
         localStorage.setItem('idb-backup-v1', JSON.stringify(backup));
         // ... proceed with migration
       }
     };
   }
   ```

**What ACTUALLY happened:**
- ❌ No classification (didn't recognize as destructive)
- ❌ No pre-operation checklist
- ❌ No confidence statement
- ❌ No user approval requested
- ❌ No backup created
- ❌ Used async getAll() instead of sync cursor
- ❌ Deleted store before reading data
- ❌ No tests with fixture data
- ✅ Data lost permanently

---

## SUMMARY: NEW REQUIREMENTS

**Add these MANDATORY requirements to CLAUDE.md:**

1. **Classify ALL operations** as 🔴 Destructive / 🟡 Risky / 🟢 Safe
2. **Backup-first pattern** is MANDATORY for destructive operations
3. **Dry runs required** - empty DB, fixtures, real data copy
4. **Confidence < 0.5 automatic** for destructive operations without backup
5. **User approval required** before implementing destructive operations
6. **Test with fixtures** before implementing migrations
7. **Use macros:** `/falsify` before, `/designspace` for options, `/telos` for invariants
8. **PR requirements:** `[DATA] [BREAKING]` prefix, rollback plan, test results
9. **Anti-patterns:** Data Cowboy, Migration Gambler, Async Trap, etc.

---

## INTEGRATION WITH EXISTING MACROS

**Update existing macro descriptions:**

### `/falsify` Addition
Add to "Use when:" list:
> "**MANDATORY:** Before implementing any destructive data operation (migrations, bulk deletes, schema changes)"

### `/designspace` Addition
Add to "Deliverables:" list:
> "For destructive operations, Options table MUST include: Data Loss Risk, Reversibility Plan, Backup Strategy"

### `/telos` Addition
Add to "Deliverables:" list:
> "For data operations, MUST document: Data integrity invariants, Backup atomicity, Failure modes with data impact"

---

## QUICK REFERENCE ADDITIONS

Add to "Quick Reference (one-liners)":

```
* **/dry-run** — Test destructive operations: empty DB → fixtures → real data copy → production
* **/backup-first** — MANDATORY pattern: backup → operation → verify → rollback if needed
* **/data-risk** — Classify operation risk: 🔴 Destructive / 🟡 Risky / 🟢 Safe
```

---

**Would this have prevented the incident?**

✅ **YES.** Following ANY of these protocols would have caught the bug:
- Pre-operation checklist: No backup strategy → STOP
- Confidence < 0.5: Request user approval → User exports data first
- Dry run with fixtures: Test would fail → Redesign before production
- `/falsify` macro: Pre/post snapshot mismatch → Caught in testing
- Backup-first pattern: Data preserved even if migration fails

**The incident happened because:**
1. Agent didn't classify operation as destructive
2. No data-specific protocols existed in CLAUDE.md
3. No mandatory backup requirement
4. No test-with-fixtures requirement
5. Agent proceeded with high confidence (incorrectly)

---

**End of Proposed Addition**
