# Uncommitted Changes Review - 2025-11-29

**Date:** 2025-11-29
**Status:** Mixed - Some production-ready, some experimental

---

## Summary

After committing the Community Gallery work, additional changes were made:

1. **Supabase fallback path** (interim solution while w3up auth issues persist)
2. **w3up auth improvements** (rewritten with better key handling)
3. **Animation phase cycling plan** (new feature planning doc)
4. **Tarot deck prompt enhancements** (improved Lord of Mysteries prompts)
5. **Debug documentation updates**

---

## File-by-File Analysis

### **1. api/auth/w3up.ts** - ✅ PRODUCTION-READY (Improved)

**Status:** Modified
**Changes:** Complete rewrite with better architecture

**What Changed:**
- Replaced manual key normalization with proper multicodec tagging
- Uses `@web3-storage/w3up-client/proof` for delegation parsing (cleaner API)
- Added 64-byte validation before Ed25519 key tagging
- Proper multicodec prefix (0x1300 varint: 0x80 0x26)
- Better error messages

**Code Quality:** ⭐⭐⭐⭐⭐
- Much cleaner than previous version
- Proper Ed25519 key handling with multicodec
- Uses official w3up-client APIs instead of manual CAR parsing

**Recommendation:** ✅ **COMMIT THIS**
- Significant improvement over previous version
- Fixes key normalization issues properly

---

### **2. src/hooks/useGallerySharing.ts** - ⚠️ EXPERIMENTAL (Supabase Toggle)

**Status:** Modified
**Changes:** Added Supabase fallback path with toggle

**What Changed:**
```typescript
const [useSupabase, setUseSupabase] = useState(true); // toggle for interim path

if (useSupabase) {
  // Upload via Supabase (bypasses w3up completely)
  const resp = await fetch('/api/upload-supabase', { ... });
}
```

**Analysis:**
- **Good:** Provides working upload while w3up auth issues persist
- **Bad:** Hardcoded `useSupabase = true` (always bypasses IPFS)
- **Bad:** No UI toggle (user can't choose)
- **Risk:** Supabase and IPFS paths may diverge

**Recommendation:** ⚠️ **NEEDS WORK BEFORE COMMIT**

**Suggested Changes:**
1. Move toggle to Settings UI (let user choose)
2. Add env var `VITE_ENABLE_SUPABASE_FALLBACK`
3. Show which path is active in Settings
4. Document that this is interim (remove when w3up works)

---

### **3. api/upload-supabase.ts** - ⚠️ NEW FILE (Supabase Backend)

**Status:** Untracked (new file)
**Purpose:** Server-side Supabase upload endpoint

**What It Does:**
- Receives card payload from client
- Uploads frames/GIF/video to Supabase Storage
- Inserts metadata into `gallery` table
- Returns public URLs

**Dependencies:**
- Requires `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- Requires `SUPABASE_BUCKET`, `SUPABASE_PUBLIC_BASE_URL`
- Requires Supabase bucket + `gallery` table setup

**Code Quality:** ⭐⭐⭐⭐
- Clean implementation
- Good error handling
- Properly handles data URLs and remote URLs

**Recommendation:** ⚠️ **CONDITIONAL COMMIT**
- Only commit if we're officially supporting Supabase as fallback
- Document in README that this is interim path
- Add `.env.example` entries for Supabase vars

---

### **4. src/utils/supabaseClient.ts** - ⚠️ NEW FILE

**Status:** Untracked
**Purpose:** Supabase client initialization

**Code:**
```typescript
export const supabase = createClient(supabaseUrl, supabaseKey);
```

**Recommendation:** ⚠️ **COMMIT WITH upload-supabase.ts**
- Simple, clean, necessary for Supabase path

---

### **5. package.json** - ✅ PRODUCTION-READY

**Status:** Modified
**Changes:** Added dependencies

**New Dependencies:**
- `@supabase/supabase-js`: ^2.86.0
- `@ipld/dag-ucan`: ^3.4.5

**Recommendation:** ✅ **COMMIT**
- Both dependencies are legitimate
- `@supabase/supabase-js` needed for fallback path
- `@ipld/dag-ucan` needed for proper w3up delegation handling

---

### **6. docs/FUTURE-IPFS-ROADMAP.md** - ✅ DOCUMENTATION

**Status:** Untracked (new file)
**Purpose:** Planning doc for IPFS improvements

**Content:**
- Documents current w3up auth blocker
- Lists near-term steps (fix delegation)
- Long-term enhancements (multi-gateway, encryption, pagination)
- Acknowledges Supabase as interim fallback

**Recommendation:** ✅ **COMMIT**
- Good documentation of current state
- Transparent about blockers
- Helps future development

---

### **7. docs/plans/2025-11-29-animation-phase-cycling-plan.md** - ✅ PLANNING DOC

**Status:** Untracked (new file)
**Purpose:** Implementation plan for new animation feature

**Content:**
- 10 tasks for implementing phase-based speed cycling
- 20s cycles: 10s fast → 10s slow
- Velocity injections every 60s to prevent settling
- Very detailed task breakdown

**Recommendation:** ✅ **COMMIT**
- Well-structured implementation plan
- Follows planning template
- Ready for future execution

---

### **8. src/data/tarot-decks.json** - ✅ CONTENT UPDATE

**Status:** Modified
**Changes:** Enhanced prompts for Lord of Mysteries cards

**Examples:**
- **Card 0 (The Fool):** Added "echoes of earlier Seer-path roles" with detailed motifs
- **Card 20 (Paragon):** Added lineage (savant, archaeologist, appraiser, etc.)
- **Card 21 (Hidden Sage):** Added Reader lineage details

**Analysis:**
- **Good:** Richer prompts for better AI generation
- **Good:** More lore-accurate (pathway progression)
- **Risk:** Longer prompts may exceed token limits for some models

**Recommendation:** ✅ **COMMIT**
- Improves card generation quality
- Stays true to Lord of Mysteries lore

---

### **9. docs/w3up-auth-debug.md** - ✅ DEBUG NOTES

**Status:** Modified
**Changes:** Updated with findings from `/falsify` session

**Content:**
- Documents the multibase double-prefix bug
- Explains why `z + M...` fails
- Notes that payload is base64pad, not base58

**Recommendation:** ✅ **COMMIT**
- Useful debugging history
- Documents the `/falsify` process

---

### **10. agent.json** - ⚠️ CREDENTIALS (SHOULD GITIGNORE)

**Status:** Untracked
**Content:** Web3.Storage agent DID + key

```json
{
  "did": "did:key:z6Mkfj...",
  "key": "MgCb+/ZiN..."
}
```

**Recommendation:** ❌ **DO NOT COMMIT** + **ADD TO GITIGNORE**
- Contains sensitive credentials
- Should stay local only

---

### **11. delegation.car.b64** - ⚠️ CREDENTIALS (SHOULD GITIGNORE)

**Status:** Untracked
**Purpose:** Base64-encoded delegation proof

**Recommendation:** ❌ **DO NOT COMMIT** + **ADD TO GITIGNORE**
- Contains delegation credentials
- Already have `delegation.car` in gitignore
- Add `*.b64` pattern too

---

### **12. scripts/normalize-agent-key.mjs** - ❓ UTILITY SCRIPT

**Status:** Untracked
**Purpose:** Unknown (not reviewed yet)

**Recommendation:** ⏸️ **REVIEW FIRST**
- Need to read file to understand purpose
- Likely related to key normalization debugging

---

## Recommended Actions

### **Immediate (Before Commit)**

1. **Add to .gitignore:**
   ```bash
   echo "agent.json" >> .gitignore
   echo "*.b64" >> .gitignore
   ```

2. **Review scripts/normalize-agent-key.mjs:**
   ```bash
   cat scripts/normalize-agent-key.mjs
   ```

3. **Update .env.example with Supabase vars:**
   ```
   # Supabase (Interim Fallback)
   SUPABASE_URL=
   SUPABASE_SERVICE_ROLE_KEY=
   SUPABASE_BUCKET=
   SUPABASE_PUBLIC_BASE_URL=
   ```

### **Commit Strategy**

#### **Commit 1: w3up Auth Improvements** ✅
```bash
git add api/auth/w3up.ts docs/w3up-auth-debug.md
git commit -m "fix(api): improve w3up auth with proper Ed25519 multicodec tagging"
```

Files:
- api/auth/w3up.ts (rewritten with better key handling)
- docs/w3up-auth-debug.md (updated debug notes)

#### **Commit 2: Supabase Fallback Path** ⚠️ (CONDITIONAL)
```bash
git add api/upload-supabase.ts src/utils/supabaseClient.ts src/hooks/useGallerySharing.ts .env.example package.json package-lock.json
git commit -m "feat(upload): add Supabase interim fallback while w3up auth issues persist"
```

**Only if:** You want to officially support Supabase as a fallback

**Include in commit message:**
- Note that this is interim (remove when w3up works)
- Document required env vars
- Explain toggle mechanism

#### **Commit 3: Content Updates** ✅
```bash
git add src/data/tarot-decks.json
git commit -m "content: enhance Lord of Mysteries prompts with pathway lineage"
```

#### **Commit 4: Planning Docs** ✅
```bash
git add docs/FUTURE-IPFS-ROADMAP.md docs/plans/2025-11-29-animation-phase-cycling-plan.md
git commit -m "docs: add IPFS roadmap and animation phase cycling plan"
```

#### **Commit 5: Gitignore** ✅
```bash
git add .gitignore
git commit -m "chore: add agent.json and *.b64 to gitignore (credentials)"
```

---

## Decision Matrix

| File | Commit? | Reason |
|------|---------|--------|
| api/auth/w3up.ts | ✅ YES | Improved implementation |
| src/hooks/useGallerySharing.ts | ⚠️ MAYBE | Needs Settings UI toggle first |
| api/upload-supabase.ts | ⚠️ MAYBE | Only if supporting Supabase fallback |
| src/utils/supabaseClient.ts | ⚠️ MAYBE | Goes with upload-supabase.ts |
| package.json | ✅ YES | Legitimate dependencies |
| docs/FUTURE-IPFS-ROADMAP.md | ✅ YES | Good planning doc |
| docs/plans/2025-11-29-animation-phase-cycling-plan.md | ✅ YES | Detailed implementation plan |
| src/data/tarot-decks.json | ✅ YES | Better prompts |
| docs/w3up-auth-debug.md | ✅ YES | Useful debug history |
| agent.json | ❌ NO | Credentials - gitignore |
| delegation.car.b64 | ❌ NO | Credentials - gitignore |
| scripts/normalize-agent-key.mjs | ⏸️ REVIEW | Unknown purpose |

---

## Questions for User

1. **Do you want to officially support Supabase as a fallback?**
   - If YES → Commit Supabase files + update docs
   - If NO → Keep local only, don't commit

2. **Should the Supabase toggle be user-configurable?**
   - Add to Settings UI?
   - Or keep as env var?

3. **What is `scripts/normalize-agent-key.mjs` for?**
   - Debugging tool?
   - Production script?

4. **Ready to commit now, or want to make changes first?**
   - Can commit in batches (auth fixes first, Supabase later)

---

## Summary

**Production-Ready:** 5 files (auth, deps, docs, content)
**Experimental:** 3 files (Supabase fallback)
**Credentials:** 2 files (must gitignore)
**Unknown:** 1 file (need review)

**Recommendation:** Commit in phases - start with auth improvements and docs, decide on Supabase separately.
