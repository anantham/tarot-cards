# Uncommitted Changes - Quick Summary

**Date:** 2025-11-29 (superseded by status update below)

---

## Status Update — 2025-11-30

Recent changes now on `main`:
- Auto-import: on first load (no local cards) we fetch `/api/community-supabase`, merge decks, pick the most recent complete (>=22 cards) deck, log per-card `[AutoImport] Added card X/Y: #N`, and import. Runs once per browser (localStorage flag).
- Supabase required in production for community endpoints/auto-import: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_BUCKET=tarotcards`, `SUPABASE_PUBLIC_BASE_URL=.../tarotcards`. KV still needed for legacy KV endpoints.
- Prompt edits: Card Detail has a prompt editor; edits save on blur and are reused for generation (images/videos) and sharing/upload payloads.
- Deck selector: dynamic “Community: <deckType>” entries appear for imported decks (non-base deck types). Deck uploads stay grouped via deckIdMap + merge-by-name/type/author.
- Sharing UI: shows “X ready to share” and “Y already shared”; auto-import and upload have clearer logs.
- UI defaults/assets: card numbers off and hover info off by default; header title removed; top-right glassy settings icon; new card back image and `public/tarot-icon.svg`.

Outdated/needs revision in this doc:
- File lists and “uncommitted” counts are stale (most items are now committed).
- Supabase fallback is no longer optional; it is the active path for community endpoints/auto-import.
- Vercel KV/env guidance is incomplete without the Supabase envs above.
- vercel.json and error-state notes in older reviews are superseded by current code.

---

## TL;DR

You have **12 uncommitted files** in 3 categories:

1. **✅ Production-Ready (6 files)** - Safe to commit now
2. **⚠️ Experimental (4 files)** - Supabase fallback (needs decision)
3. **❌ Credentials (2 files)** - Must gitignore, never commit

---

## ✅ Production-Ready Files (Safe to Commit)

### **1. api/auth/w3up.ts** - Auth Improvements
- **Status:** Much better than before
- **Changes:** Proper Ed25519 multicodec tagging, cleaner API usage
- **Impact:** Fixes key normalization issues

### **2. package.json + package-lock.json** - Dependencies
- **Added:** `@supabase/supabase-js`, `@ipld/dag-ucan`
- **Reason:** Supabase fallback + proper UCAN handling

### **3. src/data/tarot-decks.json** - Content Update
- **Changes:** Enhanced Lord of Mysteries prompts with pathway lineage
- **Example:** "The Fool" now includes Seer-path motifs
- **Impact:** Better AI generation quality

### **4. docs/w3up-auth-debug.md** - Debug Notes
- **Updated:** Documents `/falsify` debugging session
- **Useful:** Explains multibase prefix bug

### **5. docs/FUTURE-IPFS-ROADMAP.md** - Planning
- **Content:** Roadmap for IPFS improvements
- **Transparent:** Documents current blockers

### **6. docs/plans/2025-11-29-animation-phase-cycling-plan.md** - Feature Plan
- **Content:** 10-task implementation plan for animation phases
- **Well-structured:** Ready for future execution

---

## ⚠️ Experimental Files (Supabase Fallback)

### **Purpose:** Interim upload path while w3up auth issues persist

### **Files:**
1. **api/upload-supabase.ts** - Server-side upload endpoint
2. **src/utils/supabaseClient.ts** - Supabase client init
3. **src/hooks/useGallerySharing.ts** - Added `useSupabase` toggle (hardcoded `true`)

### **Issue:** Hardcoded to always use Supabase (bypasses IPFS)

### **Decision Needed:**
- **Option A:** Commit as interim solution (document clearly)
- **Option B:** Add Settings UI toggle first
- **Option C:** Keep local only (don't commit yet)

### **If Committing:**
- Add to `.env.example`:
  ```
  SUPABASE_URL=
  SUPABASE_SERVICE_ROLE_KEY=
  SUPABASE_BUCKET=
  SUPABASE_PUBLIC_BASE_URL=
  ```
- Document in commit message: "INTERIM fallback, remove when w3up works"

---

## ❌ Credentials Files (NEVER COMMIT)

### **1. agent.json**
- **Content:** Web3.Storage agent DID + private key
- **Action:** Add to .gitignore

### **2. delegation.car.b64**
- **Content:** Base64 delegation proof
- **Action:** Add to .gitignore

### **Gitignore Additions:**
```bash
echo "agent.json" >> .gitignore
echo "*.b64" >> .gitignore
```

---

## 🔧 Utility Script

### **scripts/normalize-agent-key.mjs** - Key Normalization Tool
- **Purpose:** CLI tool to normalize agent keys
- **Usage:** `node scripts/normalize-agent-key.mjs <key>`
- **Function:** Tries base64pad, then base58btc
- **Recommendation:** ✅ Commit (useful debugging tool)

---

## Recommended Commit Strategy

### **Step 1: Gitignore Credentials**
```bash
echo "agent.json" >> .gitignore
echo "*.b64" >> .gitignore
git add .gitignore
git commit -m "chore: add agent.json and *.b64 to gitignore"
```

### **Step 2: Auth Improvements**
```bash
git add api/auth/w3up.ts docs/w3up-auth-debug.md scripts/normalize-agent-key.mjs
git commit -m "fix(api): improve w3up auth with proper Ed25519 multicodec tagging

- Rewrite key normalization with multicodec 0x1300
- Use @web3-storage/w3up-client/proof API
- Add 64-byte validation
- Add normalize-agent-key.mjs CLI tool
- Update debug documentation

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

### **Step 3: Content & Planning Docs**
```bash
git add src/data/tarot-decks.json docs/FUTURE-IPFS-ROADMAP.md docs/plans/2025-11-29-animation-phase-cycling-plan.md
git commit -m "content: enhance tarot prompts and add planning docs

- Lord of Mysteries: Add pathway lineage to prompts
- Add IPFS/UCAN roadmap documentation
- Add animation phase cycling implementation plan

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

### **Step 4: Dependencies**
```bash
git add package.json package-lock.json
git commit -m "build: add Supabase and UCAN dependencies

- @supabase/supabase-js@2.86.0 (interim fallback)
- @ipld/dag-ucan@3.4.5 (proper UCAN handling)

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

### **Step 5: Supabase Fallback (OPTIONAL)**
```bash
git add api/upload-supabase.ts src/utils/supabaseClient.ts src/hooks/useGallerySharing.ts .env.example
git commit -m "feat(upload): add Supabase interim fallback path

MOTIVATION:
- w3up/UCAN delegation continues to have auth issues
- Need working upload while debugging IPFS path
- Supabase provides reliable interim solution

APPROACH:
- Toggle via useSupabase flag (hardcoded true for now)
- Server-side upload to Supabase Storage
- Metadata stored in gallery table
- TODO: Add Settings UI toggle when w3up works

CHANGES:
- api/upload-supabase.ts: Server-side upload endpoint
- src/utils/supabaseClient.ts: Supabase client init
- src/hooks/useGallerySharing.ts: Add Supabase path
- .env.example: Document Supabase env vars

IMPACT:
- Users can upload cards (works immediately)
- When w3up auth fixed, remove Supabase path
- This is INTERIM, not permanent architecture

TESTING:
- Requires Supabase project setup
- Requires env vars configured
- Manual testing pending

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Questions for You

1. **Commit Supabase fallback?**
   - YES → Provides working upload now
   - NO → Wait until w3up auth fixed

2. **Add Settings UI toggle for Supabase?**
   - Lets user choose IPFS vs Supabase
   - Or keep hidden (automatic fallback)?

3. **Ready to commit now, or make changes first?**

---

## File Count Summary

| Category | Count | Action |
|----------|-------|--------|
| ✅ Production-Ready | 7 | Commit now |
| ⚠️ Experimental | 3 | Decide first |
| ❌ Credentials | 2 | Gitignore |
| **TOTAL** | **12** | |

---

See `docs/UNCOMMITTED-CHANGES-REVIEW.md` for detailed analysis of each file.
