# Dry Run: Proposed Changes to ~/.claude/CLAUDE.md

**Date:** 2025-11-27
**Purpose:** Show exact before/after for each section that would be modified

---

## Summary of Changes

| Section | Change Type | Lines Added | Lines Removed | Risk |
|---------|-------------|-------------|---------------|------|
| ANTI-PATTERNS TO AVOID | Addition | +6 | 0 | Low |
| New: DATA INTEGRITY PROTOCOLS | New Section | +280 | 0 | None (new) |
| CONFIDENCE CALIBRATION | Enhancement | +4 | 0 | Low |
| `/falsify` macro | Enhancement | +1 | 0 | Low |
| `/designspace` macro | Enhancement | +1 | 0 | Low |
| `/telos` macro | Enhancement | +1 | 0 | Low |
| Quick Reference | Addition | +3 | 0 | Low |
| **TOTAL** | | **~296** | **0** | **Low** |

**No existing content will be removed or modified** - only additions.

---

## Change 1: ANTI-PATTERNS TO AVOID (Line 30-38)

### BEFORE
```markdown
## ANTI-PATTERNS TO AVOID

- **Context Hog:** Loading entire repo without a plan (wastes tokens)
- **Yes-Bot:** Agreeing without validating understanding via tests
- **Bulldozer:** Full file rewrites when targeted edits suffice
- **Test Bypasser:** Commenting out or skipping failing tests
- **Silent Failure:** Catching errors without logging details
- **Scope Creeper:** Expanding beyond approved task boundaries
- **Assumption Engine:** Skipping hypothesis validation with evidence
```

### AFTER
```markdown
## ANTI-PATTERNS TO AVOID

- **Context Hog:** Loading entire repo without a plan (wastes tokens)
- **Yes-Bot:** Agreeing without validating understanding via tests
- **Bulldozer:** Full file rewrites when targeted edits suffice
- **Test Bypasser:** Commenting out or skipping failing tests
- **Silent Failure:** Catching errors without logging details
- **Scope Creeper:** Expanding beyond approved task boundaries
- **Assumption Engine:** Skipping hypothesis validation with evidence
- **Data Cowboy:** Implementing destructive operations without backup-first pattern
- **Migration Gambler:** Testing migrations only on empty databases, not with fixtures
- **Async Trap:** Using async operations (getAll, async/await) in synchronous contexts (IndexedDB onupgradeneeded)
- **Silent Destroyer:** Catching errors in destructive operations without rollback
- **Trust-Me Coder:** Skipping dry runs because "I'm confident it will work"
- **Production Tester:** First test on production data instead of copy
```

**Why:** Adds data-specific anti-patterns that would have caught the IndexedDB migration bug.

---

## Change 2: NEW SECTION - DATA INTEGRITY PROTOCOLS (Insert after line 39)

### BEFORE
```markdown
## ANTI-PATTERNS TO AVOID
[... existing content ...]


## CONFIDENCE CALIBRATION
```

### AFTER
```markdown
## ANTI-PATTERNS TO AVOID
[... existing content ...]


## DATA INTEGRITY PROTOCOLS

### User Data is Sacred

**Core Principle:** User-generated data has irreplaceable value. Any code that touches user data requires maximum scrutiny.

### Operation Classification

Before implementing ANY change, classify it:

**🔴 DESTRUCTIVE OPERATIONS (Highest Risk)**
- Database migrations that change schemas
- Deleting object stores or tables
- Changing keyPath or primary keys
- Bulk delete/update operations
- File system deletions

**🟡 RISKY OPERATIONS (Medium Risk)**
- Writing to database without backup
- Async operations in sync contexts (IndexedDB transactions!)
- Error handling that swallows failures silently

**🟢 SAFE OPERATIONS (Low Risk)**
- Read-only queries
- Adding new fields with defaults
- Creating new stores/tables

### Mandatory Protocol for 🔴 DESTRUCTIVE Operations

**Before writing ANY code, complete this checklist:**

```
[ ] Backup Strategy: How will existing data be preserved?
[ ] Dry Run Plan: How will this be tested without affecting real data?
[ ] Rollback Plan: How can this be undone if it fails?
[ ] Detection Plan: How will we know if data was lost?
[ ] User Notification: Will users be warned/prompted?
```

**If ANY checkbox is unchecked, STOP and request user guidance.**

### Backup-First Implementation Pattern (MANDATORY)

```typescript
async function destructiveOperation() {
  // STEP 1: Create backup FIRST
  const backup = await createBackup();
  localStorage.setItem('operation-backup', JSON.stringify(backup));
  console.log(`✅ Backed up ${backup.length} records`);

  // STEP 2: Perform operation with error handling
  try {
    await performDestructiveOperation();
  } catch (error) {
    // STEP 3: Restore from backup on failure
    console.error('❌ Failed, restoring backup...');
    await restoreFromBackup(backup);
    throw error;
  }

  // STEP 4: Verify data integrity
  const postCount = await countRecords();
  if (postCount < backup.length) {
    throw new Error(`Data loss detected: ${backup.length} → ${postCount}`);
  }
}
```

### Dry Run Requirements

**Test sequence (all three required):**

1. **Empty Database Test**
   ```typescript
   it('should handle empty database gracefully', async () => {
     const result = await destructiveOperation();
     expect(result).toBeDefined();
   });
   ```

2. **Fixture Data Test (MANDATORY)**
   ```typescript
   it('should preserve data during operation', async () => {
     const fixtures = [/* test data */];
     await seedDatabase(fixtures);
     await destructiveOperation();
     const after = await getAllRecords();
     expect(after).toHaveLength(fixtures.length);
   });
   ```

3. **Real Data Copy Test**
   - Export production data
   - Import to test environment
   - Run operation on test copy
   - Verify integrity before production run

**If you cannot complete all three tests, STATE THIS and request user guidance.**

### IndexedDB Migration Rules (CRITICAL)

**NEVER do this:**
```typescript
// ❌ WRONG - async before deletion
const getAllRequest = oldStore.getAll();
getAllRequest.onsuccess = () => {
  db.deleteObjectStore(STORE_NAME); // Data deleted before getAll completes!
};
```

**ALWAYS do this:**
```typescript
// ✅ CORRECT - synchronous cursor iteration
const dataToMigrate = [];
const cursorRequest = oldStore.openCursor();
cursorRequest.onsuccess = (event) => {
  const cursor = event.target.result;
  if (cursor) {
    dataToMigrate.push(cursor.value);
    cursor.continue();
  } else {
    // All data collected, NOW delete and recreate
    db.deleteObjectStore(STORE_NAME);
    const newStore = db.createObjectStore(STORE_NAME, { keyPath: 'newKey' });
    dataToMigrate.forEach(item => newStore.add(item));
  }
};
```

**IndexedDB Constraints:**
- ❌ Never use `getAll()` before schema changes (it's async!)
- ✅ Always use `openCursor()` for iteration (synchronous within transaction)
- ❌ Never delete stores before reading data
- ✅ Always: collect → delete → recreate → re-insert

### Automatic Confidence Reduction

**If your code contains ANY of these patterns, confidence automatically < 0.5:**

- `deleteObjectStore()` or `DROP TABLE`
- `db.delete()` or `DELETE FROM`
- Async operations in `onupgradeneeded` handler
- Schema changes without rollback plan
- No backup before destructive operation
- No tests with fixture data

**You MUST request user approval before proceeding.**

### Required Statements Before Destructive Operations

```
Classification: 🔴 DESTRUCTIVE
Confidence: 0.X (automatic < 0.5 due to [reason])
Risk Assessment:
  - Data Loss Risk: HIGH/MEDIUM/LOW
  - Reversibility: YES/NO
  - Backup Strategy: [description or NONE]
  - Test Coverage: [empty DB / fixtures / real data copy]

Pre-Operation Checklist:
  [ ] Backup Strategy defined
  [ ] Dry run plan created
  [ ] Rollback plan documented
  [ ] Fixtures test exists
  [ ] User approval requested

Request: User approval required due to [HIGH data loss risk / NO reversibility / etc.]
```

### Reversibility Requirements

For EVERY destructive operation, document:

```
Reversibility Analysis:
1. Can this be undone? [YES/NO]
2. If YES, how? [rollback script / restore from backup]
3. If NO, what's the backup strategy? [MANDATORY if NO]
4. Time window to reverse: [immediate / 30 days / never]
5. Data loss if reversal needed: [none / partial / complete]
```

**If Reversibility = NO and Backup Strategy = NONE:**
- 🚨 STOP IMMEDIATELY
- 🚨 DO NOT IMPLEMENT
- 🚨 REQUEST USER GUIDANCE


## CONFIDENCE CALIBRATION
```

**Why:** This entire new section would have prevented the incident by requiring:
- Classification as 🔴 DESTRUCTIVE
- Pre-operation checklist (no backup strategy = STOP)
- Fixture testing (would have caught the async timing bug)
- Automatic confidence < 0.5 (requiring user approval)

**Line Count:** ~280 new lines

---

## Change 3: CONFIDENCE CALIBRATION (Line 41-49)

### BEFORE
```markdown
## CONFIDENCE CALIBRATION

State confidence (0.0-1.0) for:
- Root cause identification: "70% confident this is the issue"
- Solution proposals: "85% confident this fixes without side effects"
- Refactoring safety: "95% confident existing tests will pass"

If confidence < 0.7: Explicitly request human validation
If confidence < 0.5: Stop and gather more evidence
```

### AFTER
```markdown
## CONFIDENCE CALIBRATION

State confidence (0.0-1.0) for:
- Root cause identification: "70% confident this is the issue"
- Solution proposals: "85% confident this fixes without side effects"
- Refactoring safety: "95% confident existing tests will pass"
- Destructive operations: "Must be < 0.5 if no backup strategy exists"

If confidence < 0.7: Explicitly request human validation
If confidence < 0.5: Stop and gather more evidence

**Special Rule for Destructive Operations:**
If implementing a 🔴 DESTRUCTIVE operation (see DATA INTEGRITY PROTOCOLS):
- Confidence is automatically < 0.5 if ANY of these are true:
  - No backup strategy exists
  - No fixture tests exist
  - Reversibility = NO
  - Using async in sync context (IndexedDB)
- You MUST request user approval before proceeding
```

**Why:** Adds specific confidence rules for destructive operations.

**Lines Added:** 4

---

## Change 4: `/falsify` macro (Line 161-207)

### BEFORE
```markdown
## `/falsify`  *(aliases: `/hack`, `/redteam`, `/null`)*

**Intent:** Catch and correct p‑hacking/Goodharting. Make beliefs pay rent. Be happy when a well‑designed test fails.

**Use when:** a test passes too easily, results look "too clean," or you're about to patch without evidence.

**Deliverables (all required):**
[... existing content ...]
```

### AFTER
```markdown
## `/falsify`  *(aliases: `/hack`, `/redteam`, `/null`)*

**Intent:** Catch and correct p‑hacking/Goodharting. Make beliefs pay rent. Be happy when a well‑designed test fails.

**Use when:** a test passes too easily, results look "too clean," or you're about to patch without evidence.

**MANDATORY for:** Any 🔴 DESTRUCTIVE operation (database migrations, bulk deletes, schema changes) - MUST run `/falsify` before implementation to create pre/post snapshots and test with fixtures.

**Deliverables (all required):**
[... existing content ...]
```

**Why:** Makes `/falsify` mandatory for destructive operations.

**Lines Added:** 1

---

## Change 5: `/designspace` macro (Line 211-235)

### BEFORE
```markdown
## `/designspace`  *(aliases: `/analyse-solutions`, `/options`, `/arch`)*

**Intent:** Map the landscape before touching code. Separate *understanding* from *intervening*.

**Deliverables (all required):**

* **Constraints & Non‑Goals.** Include performance/error budgets and policy constraints.
* **Definition of Done.** Observable acceptance criteria.
* **Options A…N (table):**

  * *Name · Scope (files/functions) · Blast Radius · Complexity · Effort · Reversibility · Risks · Rule‑alignment (1–6) · Edge Cases Covered · Test Gate*
* **Top recommendation(s) (≤2) with why**; explicitly rebut why others are not chosen.
* **Minimal Plan of Action** for chosen option: exact insertion points, ordered steps, tests to add/modify, rollback plan.
```

### AFTER
```markdown
## `/designspace`  *(aliases: `/analyse-solutions`, `/options`, `/arch`)*

**Intent:** Map the landscape before touching code. Separate *understanding* from *intervening*.

**Deliverables (all required):**

* **Constraints & Non‑Goals.** Include performance/error budgets and policy constraints.
* **Definition of Done.** Observable acceptance criteria.
* **Options A…N (table):**

  * *Name · Scope (files/functions) · Blast Radius · Complexity · Effort · Reversibility · Risks · Rule‑alignment (1–6) · Edge Cases Covered · Test Gate*
  * **For 🔴 DESTRUCTIVE operations, table MUST also include:** Data Loss Risk · Backup Strategy · Rollback Plan
* **Top recommendation(s) (≤2) with why**; explicitly rebut why others are not chosen.
* **Minimal Plan of Action** for chosen option: exact insertion points, ordered steps, tests to add/modify, rollback plan.
```

**Why:** Requires data-specific analysis columns for destructive operations.

**Lines Added:** 1

---

## Change 6: `/telos` macro (Line 239-261)

### BEFORE
```markdown
## `/telos`  *(aliases: `/why`, `/intent`)*

**Intent:** Surface the *why*: motivation, invariants, and coherence of the design/test/schema. Useful for code review and integrity checks.

**Deliverables (choose all that apply; default to all when context exists):**

* **Problem narrative & user behaviors** the system assumes.
* **Invariants & non‑negotiables** (safety properties, contracts, idempotency, monotonicity where relevant).
* **Threat model & adversarial inputs.**
* **Data & control flow** (text diagram OK) and where errors propagate.
* **Schema/API rationale** (why this shape? tradeoffs considered).
* **Edge cases & failure modes** and planned handling.
[... rest of deliverables ...]
```

### AFTER
```markdown
## `/telos`  *(aliases: `/why`, `/intent`)*

**Intent:** Surface the *why*: motivation, invariants, and coherence of the design/test/schema. Useful for code review and integrity checks.

**Deliverables (choose all that apply; default to all when context exists):**

* **Problem narrative & user behaviors** the system assumes.
* **Invariants & non‑negotiables** (safety properties, contracts, idempotency, monotonicity where relevant).
* **For data operations, MUST document:** Data integrity invariants · Backup atomicity · Failure modes with data impact
* **Threat model & adversarial inputs.**
* **Data & control flow** (text diagram OK) and where errors propagate.
* **Schema/API rationale** (why this shape? tradeoffs considered).
* **Edge cases & failure modes** and planned handling.
[... rest of deliverables ...]
```

**Why:** Adds requirement to document data integrity invariants.

**Lines Added:** 1

---

## Change 7: Quick Reference (Line 312-317)

### BEFORE
```markdown
## Quick Reference (one‑liners)

* **/falsify** — Evidence‑first debugging: hypotheses, tests, snapshots, priors, gates.
* **/designspace** — Options with tradeoffs: constraints, DoD, table, pick & plan.
* **/telos** — Explain the why: invariants, flows, schema rationale, edge cases, rationale.

- whenever you fix any bug make sure there is unit test coverage existing or make sure to add the tests and try them out
```

### AFTER
```markdown
## Quick Reference (one‑liners)

* **/falsify** — Evidence‑first debugging: hypotheses, tests, snapshots, priors, gates. MANDATORY for 🔴 destructive ops.
* **/designspace** — Options with tradeoffs: constraints, DoD, table, pick & plan. Add Data Loss Risk for 🔴 ops.
* **/telos** — Explain the why: invariants, flows, schema rationale, edge cases, rationale. Document data integrity.
* **🔴 DESTRUCTIVE ops** — Must classify, backup first, test with fixtures, get approval. See DATA INTEGRITY PROTOCOLS.
* **Dry Run Sequence** — Empty DB → Fixtures → Real data copy → Production (with backup)
* **Backup-First Pattern** — backup → operate → verify → rollback if failed (MANDATORY for 🔴 ops)

- whenever you fix any bug make sure there is unit test coverage existing or make sure to add the tests and try them out
```

**Why:** Adds quick reference for data safety protocols.

**Lines Added:** 3

---

## Final File Structure

```markdown
## Problem-Solving Approach
[... unchanged ...]

## ANTI-PATTERNS TO AVOID
[... existing 7 patterns ...]
[+ 6 new data-specific patterns]

## DATA INTEGRITY PROTOCOLS                    ← NEW SECTION (~280 lines)
### User Data is Sacred
### Operation Classification
### Mandatory Protocol for 🔴 DESTRUCTIVE Operations
### Backup-First Implementation Pattern
### Dry Run Requirements
### IndexedDB Migration Rules
### Automatic Confidence Reduction
### Required Statements Before Destructive Operations
### Reversibility Requirements

## CONFIDENCE CALIBRATION
[... existing content ...]
[+ Special rule for destructive operations]

## GIT COMMIT REQUIREMENTS
[... unchanged ...]

## PULL REQUEST WORKFLOW REQUIREMENTS
[... unchanged ...]

## REFACTORING METRICS
[... unchanged ...]

# Command Macros Addendum
[... unchanged ...]

## `/falsify`
[... existing content ...]
[+ MANDATORY for destructive ops]

## `/designspace`
[... existing content ...]
[+ Data-specific columns for table]

## `/telos`
[... existing content ...]
[+ Data integrity documentation requirement]

## Commit Protocol Integration
[... unchanged ...]

## Usage Examples (minimal)
[... unchanged ...]

## Macro Chaining Recipe
[... unchanged ...]

## Notes on Tone & Epistemics
[... unchanged ...]

## Quick Reference (one‑liners)
[... existing 3 items ...]
[+ 3 new data safety items]
```

---

## Validation Checklist

Before applying these changes, verify:

- [ ] No existing content is removed
- [ ] No existing content is modified (only additions)
- [ ] New section is inserted in logical location (after ANTI-PATTERNS)
- [ ] Enhancements to macros are additive only
- [ ] Code examples use correct syntax
- [ ] All patterns reference existing concepts
- [ ] Total addition is ~296 lines
- [ ] File remains valid Markdown
- [ ] No breaking changes to existing workflows

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Breaks existing workflows | Very Low | Medium | No existing content changed |
| Agent ignores new section | Low | High | Macros updated to reference it |
| Too verbose, agent confused | Low | Medium | Quick reference added for clarity |
| Conflicts with other rules | Very Low | Low | Builds on existing patterns |
| **Overall Risk** | **Very Low** | | Additive changes only |

---

## Testing the Changes

After applying, test by asking the agent to:

1. **Implement a database migration**
   - Should automatically classify as 🔴 DESTRUCTIVE
   - Should run through the checklist
   - Should request user approval
   - Should state confidence < 0.5

2. **Read a database without changes**
   - Should classify as 🟢 SAFE
   - Should NOT trigger protocols
   - Normal confidence levels apply

3. **Add a new field to database**
   - Should classify as 🟢 SAFE (non-destructive)
   - No special protocols needed

---

## How This Would Have Prevented the Incident

**The 2025-11-27 IndexedDB Bug:**

### What Actually Happened
```
1. Agent saw database migration task
2. No classification system → didn't recognize as destructive
3. No checklist → didn't create backup
4. No mandatory fixture testing → tested only on empty DB
5. High confidence → didn't request approval
6. Used async getAll() → data lost before deletion
7. Implemented directly → no dry run
Result: Data lost permanently
```

### What Would Happen With New Rules
```
1. Agent sees database migration task
2. Classifies as 🔴 DESTRUCTIVE (deleteObjectStore detected)
3. Runs pre-operation checklist:
   [ ] Backup Strategy: NONE ❌
   → STOP - Cannot proceed
4. Agent states:
   "Classification: 🔴 DESTRUCTIVE
    Confidence: 0.3 (automatic < 0.5 - no backup strategy)
    Request: Need user approval to implement backup-first pattern"
5. User: "Yes, add backup first"
6. Agent implements backup → collect data → delete → recreate → restore
7. Tests with fixtures → catches async bug
8. Dry run on test environment → validates before production
Result: Data preserved, bug caught, user informed
```

---

## Recommendation

**Apply these changes?**

**Pros:**
- ✅ Would have prevented the 2025-11-27 incident
- ✅ Adds critical data safety protocols
- ✅ No breaking changes (additive only)
- ✅ Builds on existing patterns (macros, confidence, etc.)
- ✅ Covers IndexedDB-specific pitfalls
- ✅ Requires backup-first for all destructive ops

**Cons:**
- ⚠️ Adds ~296 lines (file becomes longer)
- ⚠️ Agent must read/understand new section
- ⚠️ Slightly more friction for destructive operations (intentional!)

**Verdict:** **STRONGLY RECOMMEND APPLYING**

The slight added friction for destructive operations is a feature, not a bug. It forces deliberate consideration before potentially catastrophic operations.

---

## Next Steps

If you approve these changes:

1. **I will apply them to your `~/.claude/CLAUDE.md`**
2. **I will create a backup** of the current file first
3. **I will test** by asking you to give me a destructive task
4. **You can revert** anytime by restoring the backup

**Do you want me to proceed with applying these changes?**
