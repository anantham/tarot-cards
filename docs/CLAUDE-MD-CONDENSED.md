# Condensed Version: Critical Data Safety Rules

**Total Addition: ~60 lines** (vs 296 in full version)

---

## Insert After "ANTI-PATTERNS TO AVOID"

```markdown
## ANTI-PATTERNS TO AVOID

[... existing patterns ...]

- **Data Cowboy:** Destructive ops without backup-first
- **Migration Gambler:** Testing migrations only on empty DBs, not fixtures
- **Async Trap:** Using async (getAll, await) in sync contexts (IndexedDB onupgradeneeded)


## DATA SAFETY RULES

**User data is irreplaceable. Before ANY destructive operation:**

### 🔴 DESTRUCTIVE Operations (Auto Confidence < 0.5)

Triggers: `deleteObjectStore`, `DROP TABLE`, schema migrations, bulk deletes

**Mandatory Pre-Flight:**
```
[ ] Backup exists OR Reversibility = YES
[ ] Tested with fixtures (not just empty DB)
[ ] Stated: "Confidence: 0.X, requesting approval due to [data loss risk]"
```

**If ANY checkbox unchecked → STOP and request user guidance**

### IndexedDB Migration Rule (CRITICAL)

❌ **NEVER:** `getAll()` before `deleteObjectStore()` (async executes AFTER deletion)
✅ **ALWAYS:** `openCursor()` → collect in array → THEN delete/recreate

Pattern: `collect data → delete store → create store → re-insert data`
(All within same `onupgradeneeded` synchronous transaction)

### Required Statement

```
Classification: 🔴 DESTRUCTIVE
Confidence: [automatic < 0.5 if no backup]
Risk: Data Loss = HIGH/MED/LOW | Reversible = YES/NO
Backup: [strategy or NONE - if NONE, STOP]
Tests: [empty DB ✓ | fixtures ✓ | real copy ✓]
Approval: Requesting user approval before proceeding
```

### Dry Run Sequence

1. Empty DB test
2. Fixture test (MANDATORY - seeds real data)
3. Real data copy test (export prod → test on copy)

**If skipping any test, state why and get approval**


## CONFIDENCE CALIBRATION
```

---

## Update Existing Sections (Minimal Changes)

### CONFIDENCE CALIBRATION
```diff
  If confidence < 0.5: Stop and gather more evidence
+
+ For 🔴 DESTRUCTIVE ops: Confidence auto < 0.5 if no backup/fixtures/reversibility
```

### `/falsify` macro
```diff
- **Use when:** a test passes too easily, results look "too clean"...
+ **Use when:** a test passes too easily, results look "too clean", or BEFORE any 🔴 destructive operation
```

### Quick Reference
```diff
  * **/telos** — Explain the why...
+ * **🔴 = DESTRUCTIVE** — Backup first, test fixtures, confidence < 0.5, get approval
```

---

## Total Changes Summary

| Section | Lines Added |
|---------|-------------|
| ANTI-PATTERNS | +3 |
| NEW: DATA SAFETY RULES | ~40 |
| CONFIDENCE CALIBRATION | +2 |
| `/falsify` enhancement | +1 |
| Quick Reference | +1 |
| **TOTAL** | **~47 lines** |

**vs Full Version: 296 lines** → **84% reduction**

---

## What Was Cut (Still Effective)

**Removed from full version:**
- ❌ Detailed code examples (too verbose)
- ❌ Full reversibility framework (over-engineered)
- ❌ Extensive PR requirements (covered elsewhere)
- ❌ Long explanations (kept only triggers)
- ❌ Multiple pattern examples (just the rule)
- ❌ Separate sections for each rule (consolidated)

**What's KEPT (Essential):**
- ✅ Classification trigger (🔴 DESTRUCTIVE)
- ✅ Pre-flight checklist (3 items)
- ✅ IndexedDB async trap warning (the specific bug!)
- ✅ Auto confidence < 0.5 rule
- ✅ Fixture testing requirement
- ✅ Required approval statement

---

## Would This Have Prevented the Incident?

**YES.** The condensed version catches:

1. **Line 1:** "🔴 DESTRUCTIVE Operations (Auto Confidence < 0.5)"
   - Agent sees `deleteObjectStore` → triggers classification

2. **Line 2:** "Tested with fixtures (not just empty DB)"
   - Would have caught the async timing bug

3. **Line 3:** "Backup exists OR Reversibility = YES"
   - No backup → STOP

4. **IndexedDB Rule:** "NEVER getAll() before deleteObjectStore()"
   - Exactly the bug that happened!

**Condensed = Punchy Rules, Not Essays**

The full version explains WHY. The condensed version just says WHAT to check.

---

## Recommendation

**Use the condensed version** (~47 lines) because:
- ✅ Captures all critical safety triggers
- ✅ Keeps CLAUDE.md readable
- ✅ Easy to scan quickly
- ✅ Still prevents the incident
- ✅ No code examples (less clutter)
- ✅ References existing patterns

**If you want the reasoning later, it's in the incident report.**

Want me to apply the condensed version instead?
