# useGallerySharing — Community Gallery Upload/Download

<!--
Last verified: 2026-03-05
Code hash: 29ff4e3
Verified by: agent
-->

## Purpose

Manages the full lifecycle of community gallery sharing: uploading a user's
generated cards so others can download them, and downloading bundles that
others have shared. This is the only hook that talks to the community gallery
API endpoints.

## Design Rationale

### The dual-path upload architecture

The hook contains two upload implementations within `uploadIPFSGallery`,
controlled by the `useSupabase` flag (line 19, currently hardcoded `true`):

```
uploadIPFSGallery(displayName)
  ├── if useSupabase === true  → Supabase path (ACTIVE)
  │     POST /api/upload-supabase  (batch, 1 card at a time)
  │     markCardsAsShared() in IDB
  │
  └── if useSupabase === false → IPFS path (BUILT, NOT ACTIVE)
        UCAN delegation from /api/auth/w3up
        Video download via /api/proxy
        WebP conversion
        uploadDirectory() to Web3.Storage
        CID registration at /api/register-gallery
        markCardsAsShared() in IDB
```

**Why this structure?** The IPFS path was the architectural target (see ADR),
but hit UCAN key-management issues before launch. Rather than ship nothing,
the Supabase path was added as a fast interim route inside the same function.
The flag makes the switch a one-line change when IPFS is ready.

**Why `useSupabase` is a constant, not a setting:** The two paths have
different backend requirements (UCAN keys vs Supabase creds). Exposing the
flag to users would create support surface. When IPFS is ready, the Supabase
branch will be deleted, not toggled.

### Why Vercel 4.5 MB batching?

Vercel's request body limit is ~4.5 MB. A single generated card (4 frames +
video URL) can exceed this. The Supabase path uploads one card per batch with
a pre-flight size estimate to catch oversized payloads before the request.

### Why WebP conversion on the client?

PNG frames from the image generator are 2–5 MB each. WebP at 80% quality is
~90% smaller with imperceptible loss. Converting in the browser using Canvas
avoids streaming large payloads through the server and keeps the Vercel
payload limit manageable. The Canvas API is hardware-accelerated in all
modern browsers — no library needed.

### Why a gateway race for IPFS download?

IPFS gateways have variable availability. `w3s.link` is the primary Web3.Storage
gateway, `dweb.link` and `cloudflare-ipfs.com` are fallbacks. The current
implementation tries them sequentially (first success wins) rather than racing
in parallel — simpler, acceptable latency for a one-time download.

### Key decisions

| Decision | Chosen | Alternatives considered | Why |
|----------|--------|------------------------|-----|
| Dual-path structure | Flag inside one function | Two separate exported functions | One-line switch when IPFS ready; avoids caller-side changes |
| Batch size | 1 card per Supabase request | Larger batches | Stays comfortably under 4.5 MB Vercel limit |
| Image format for IPFS | WebP via Canvas | PNG (no conversion), server-side conversion | ~90% size reduction; no server cost |
| Gemini video fetch | Via `/api/proxy` | Direct browser fetch | CORS block; keeps API key server-side |
| Deck ID persistence | Stored in `settings.deckIdMap` | Server-assigned, ephemeral | Multiple uploads must stay in same deck row |
| Download target | `addGeneratedCard()` in Zustand store | Direct IDB write | Store handles IDB sync; consistent with local generation flow |

### ADR references

- [Community Gallery Revised Plan](../plans/2025-11-27-community-gallery-revised-plan.md)
  — full architectural rationale + Status Amendment documenting Supabase-primary reality

## Public API

### `uploadIPFSGallery(displayName?): Promise<boolean>`

**Current behaviour (useSupabase = true):** Uploads all unshared cards to
Supabase Storage via `/api/upload-supabase`, one card per request. Marks
cards as shared in IDB on success. Returns `true` on success, `false` on error.

**Future behaviour (useSupabase = false):** Full IPFS flow — UCAN delegation,
WebP conversion, video download, directory upload, CID registration.

Called automatically from `Settings.tsx` on close when `autoShareEnabled` is set.

---

### `downloadIPFSGallery(cid: string): Promise<number>`

Downloads a gallery bundle from IPFS by CID. Tries three gateways
sequentially. On success, adds all cards to the Zustand store (which syncs to
IDB). Returns the number of cards loaded, or `0` on error.

---

### State (returned alongside functions)

| Field | Type | Meaning |
|-------|------|---------|
| `uploading` | `boolean` | Upload in progress — use to disable the share button |
| `error` | `string \| null` | Last error message, cleared on next upload attempt |
| `progress` | `string` | Human-readable progress step (e.g. "Uploading batch 2/5...") |

## Internal Architecture

```
useGallerySharing()
  │
  ├── state: uploading, error, progress
  ├── store: addGeneratedCard, settings, updateSettings
  │
  ├── convertToWebP(dataUrl)        ← Canvas PNG→WebP (IPFS path only)
  ├── downloadVideo(geminiUrl)      ← /api/proxy fetch (IPFS path only)
  │
  ├── uploadIPFSGallery(displayName)
  │     ├── [useSupabase=true]  Supabase batch upload loop
  │     │     → /api/upload-supabase (POST, 1 card)
  │     │     → markCardsAsShared(timestamps)
  │     │
  │     └── [useSupabase=false] IPFS flow
  │           → /api/auth/w3up  (UCAN delegation)
  │           → convertToWebP() per card
  │           → downloadVideo() per card with video
  │           → client.uploadDirectory(files)
  │           → /api/register-gallery (CID registration)
  │           → markCardsAsShared(timestamps)
  │
  └── downloadIPFSGallery(cid)
        → /api/gallery/[cid]          (metadata + validate exists)
        → gateway race (w3s, dweb, cloudflare)
        → addGeneratedCard() per card in manifest
```

## Dependencies

| Depends on | Why | Import path |
|------------|-----|-------------|
| `useStore` | Card add, settings read/write | `../store/useStore` |
| `getUnsharedCards` | Cards to upload | `../utils/idb` |
| `markCardsAsShared` | Post-upload IDB update | `../utils/idb` |
| `@web3-storage/w3up-client` | IPFS directory upload (IPFS path) | npm |
| `@web3-storage/w3up-client/proof` | UCAN delegation parsing (IPFS path) | npm |
| `/api/upload-supabase` | Supabase card upload | API route |
| `/api/auth/w3up` | UCAN delegation vending | API route |
| `/api/proxy` | Gemini video CORS bypass | API route |
| `/api/register-gallery` | IPFS CID registry | API route |
| `/api/gallery/[cid]` | Gallery metadata fetch | API route |

## Known Limitations

- **Sequential gateway attempts:** `downloadIPFSGallery` tries gateways one
  at a time. A parallel `Promise.race` would be faster but more complex.
- **No upload resume:** If a batch upload fails partway through, successfully
  uploaded batches are marked as shared but remaining cards are not retried
  automatically. The user must re-trigger sharing.
- **Hardcoded model string:** The IPFS path hardcodes `model: 'gemini-2.0-flash-exp'`
  in the manifest metadata (line 281) rather than reading from `settings.model`.
- **`useSupabase` is not exported:** Cannot be toggled without a code change.
  This is intentional (see rationale above).

## Tech Debt

- **`useSupabase` cleanup:** When IPFS is ready, delete the Supabase branch
  inside `uploadIPFSGallery` and the `useSupabase` constant. The Supabase
  upload API route (`/api/upload-supabase`) can also be removed.
- **Size estimation is approximate:** `estimateCardSize` counts base64 bytes
  from data URLs but misses cases where `frames` contain remote URLs (not
  data URLs). Actual payload size could differ.
- **`logProgress` uses `console.log` directly** rather than `debugLog` from
  `logger.ts`. Should be gated behind the debug flag to reduce production noise.

## Migration Plan (IPFS activation)

When the IPFS path is ready to go live:

1. Resolve UCAN key-management issues in `/api/auth/w3up`
2. Test `uploadIPFSGallery` end-to-end in staging with `useSupabase = false`
3. Change line 19: `const useSupabase = false;`
4. Verify CID registration and gateway download in production
5. Delete the Supabase branch (lines 112–186) and `estimateCardSize` helper
6. Update this doc and the ADR status to `Implemented`
