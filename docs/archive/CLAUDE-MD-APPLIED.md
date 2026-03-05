# CLAUDE.md Changes Applied

**Date:** 2025-11-27
**Status:** ✅ Complete
**Lines Added:** 51 (317 → 368)
**Backup:** `~/.claude/CLAUDE.md.backup-20251127-164815`

---

## ✅ Changes Applied

### 1. ANTI-PATTERNS TO AVOID (Lines 39-41)
**Added 3 new patterns:**
- **Data Cowboy:** Destructive ops without backup-first
- **Migration Gambler:** Testing migrations only on empty DBs, not fixtures
- **Async Trap:** Using async (getAll, await) in sync contexts (IndexedDB onupgradeneeded)

### 2. DATA SAFETY RULES (Lines 44-87) - NEW SECTION
**Complete new section with:**
- 🔴 DESTRUCTIVE operation classification
- Mandatory pre-flight checklist (3 items)
- IndexedDB migration rule (the exact bug we hit!)
- Required statement template
- Dry run sequence (3 tests)

### 3. CONFIDENCE CALIBRATION (Line 99)
**Added:**
- Special rule: Confidence auto < 0.5 for 🔴 DESTRUCTIVE ops without backup/fixtures/reversibility

### 4. `/falsify` Macro (Line 215)
**Enhanced "Use when:" to include:**
- "or BEFORE any 🔴 destructive operation"

### 5. Quick Reference (Line 367)
**Added:**
- **🔴 = DESTRUCTIVE** — Backup first, test fixtures, confidence < 0.5, get approval

---

## How to Verify

**Check the changes:**
```bash
# View the new section
sed -n '44,87p' ~/.claude/CLAUDE.md

# Compare with backup
diff ~/.claude/CLAUDE.md.backup-20251127-164815 ~/.claude/CLAUDE.md
```

**Rollback if needed:**
```bash
cp ~/.claude/CLAUDE.md.backup-20251127-164815 ~/.claude/CLAUDE.md
```

---

## Test: Would This Prevent the Incident?

**Scenario:** Agent asked to implement IndexedDB schema migration

**Expected Behavior:**
1. Agent reads CLAUDE.md
2. Sees task involves `deleteObjectStore`
3. Classifies as 🔴 DESTRUCTIVE (line 50)
4. Checks pre-flight checklist (lines 53-57):
   - [ ] Backup exists OR Reversibility = YES → ❌ NO
   - STOPS
5. States required statement (lines 71-77):
   ```
   Classification: 🔴 DESTRUCTIVE
   Confidence: 0.3 (automatic < 0.5 - no backup strategy)
   Risk: Data Loss = HIGH | Reversible = NO
   Backup: NONE - STOPPING
   Approval: Cannot proceed - requesting user guidance for backup strategy
   ```
6. User: "Add backup first" or "Export data manually"
7. Data safe ✅

**Without these rules:** Agent proceeds → uses async getAll() → data lost ❌

---

## What Changed in Practice

**Before:**
- No data-specific guidelines
- No IndexedDB migration warnings
- Agent could proceed with destructive ops
- No required fixture testing
- No automatic confidence reduction

**After:**
- 🔴 Classification system
- Explicit IndexedDB async trap warning
- Mandatory pre-flight checklist
- Required fixture testing
- Auto confidence < 0.5 for destructive ops
- Must request approval

---

## Summary

**51 lines added** to prevent catastrophic data loss:
- 3 anti-patterns (data-specific)
- 1 new section (44 lines of critical rules)
- 3 enhancements (existing sections)
- 1 quick reference addition

**Result:** Concise, scannable, effective data safety protocol.

**The IndexedDB migration bug would have been caught at 3 different checkpoints:**
1. ❌ Async Trap anti-pattern (line 41)
2. ❌ IndexedDB Migration Rule (lines 61-67)
3. ❌ Pre-flight checklist - no backup (line 54)

---

**Status:** Ready to use
**Next Test:** Ask agent to implement a database migration and verify it follows the protocol
