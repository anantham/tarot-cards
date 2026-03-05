# Project Conventions

<!--
Last verified: 2026-03-06
Code hash: 5286453
Verified by: agent
-->

Ground truth for naming, patterns, and style across the Tarot Cards codebase.
`doc-audit` uses this file as the baseline for convention checks.

---

## Naming

### TypeScript

| Domain | Convention | Example | Anti-example |
|--------|-----------|---------|-------------|
| Interfaces & types | PascalCase | `GeneratedCard`, `TarotCard` | `generatedCard`, `tarot_card` |
| React components | PascalCase | `CardDetailModal`, `BulkGenerationSection` | `cardDetailModal` |
| Custom hooks | `use` prefix + PascalCase | `useCardGeneration`, `useGallerySharing` | `cardGenerationHook` |
| Utility functions | camelCase | `getInterpretationForDeck`, `debugLog` | `GetInterpretation`, `debug_log` |
| Constants | UPPER_SNAKE_CASE | `DB_VERSION`, `MAX_CARDS_PER_BATCH` | `dbVersion`, `maxCardsPerBatch` |
| Data files | kebab-case | `tarot-decks.json`, `tarot-config.json` | `tarotDecks.json` |

### Gallery dual-path naming

Functions that operate on the IPFS gallery path are suffixed `*IPFSGallery`.
Functions that operate on the Supabase gallery path are suffixed `*SupabaseGallery`.

| Path | Upload | Download |
|------|--------|----------|
| Either (current: Supabase, future: IPFS) | `shareGallery` | `downloadGallery` |

This symmetry is intentional — see [Intentional Divergences](#intentional-divergences).

### API routes

Vercel API handlers live in `api/` and are named in `kebab-case`:
- `api/upload-supabase.ts`, `api/register-gallery.ts`, `api/keepalive.ts`
- Dynamic segments use bracket notation: `api/gallery/[cid].ts`

---

## File Organisation

### Size guideline (friction-based, not a hard rule)

The goal is to minimise **engineering friction**, not hit a LOC target.
Split a file when ANY of these friction signals appear:

| Signal | Indicator |
|--------|-----------|
| High surprise radius | Safely changing one thing requires reading the whole file |
| Bad locality of change | Unrelated code appears in every diff |
| Poor findability | "Where does X live?" always points here regardless of what X is |
| Weak testability | Cannot mock one part without loading all other parts |

As a rough prompt to investigate (not a rule):

| LOC | Action |
|-----|--------|
| ~500 | Usually fine. Apply the four signals if something feels off. |
| 500–1000 | Run all four signals. Split only if friction is confirmed. |
| >1000 | Friction likely — investigate and propose split. |

A 300 LOC file with three unrelated jobs is worse than a 900 LOC file with one job.

### Component split pattern

Large components are decomposed into an **orchestrator + submodule directory**:

```
components/
  CardDeck.tsx                  ← orchestrator (thin: wires hooks, renders children)
  card-deck/
    CardDeckCard.tsx            ← per-card component
    CardDeckCardVisual.tsx      ← rendering only
    useCardMotion.ts            ← per-card pointer/motion hook
    useDeckAnimationController.ts ← deck-level phase cycling
    motionUtils.ts              ← pure physics helpers
    curves.ts                   ← curve math
    initialization.ts           ← initial state factories
    types.ts                    ← shared domain types
    cardInfo.ts                 ← card title/keyword helpers
```

**Rules:**
- The orchestrator root file delegates — it does not contain logic
- Submodule files each have a single responsibility describable in one sentence
- Shared types for the submodule live in `module-name/types.ts`

### Test co-location

Tests live next to their source file:

```
src/utils/cardPhysics.ts
src/utils/cardPhysics.test.ts
src/utils/cardPhysics.integration.test.ts
src/components/CardFlipImageInner.tsx
src/components/CardFlipImageInner.test.tsx
```

Suffix `.test.ts` for unit tests, `.integration.test.ts` for multi-module tests.

### No orphaned root files

The project root contains only entry points and config files.
Scripts go in `scripts/`, debug tools go in `docs/archive/` or are deleted once resolved.

---

## Component Architecture

| Layer | Responsibility | Example |
|-------|---------------|---------|
| Orchestrator component | Wires state/hooks, renders children, no business logic | `CardDeck.tsx`, `Settings.tsx` |
| Submodule component | Renders a single focused concern | `CardDeckCardVisual.tsx`, `CommunitySharingSection.tsx` |
| Custom hook | Owns stateful logic and side effects | `useCardGeneration.ts`, `useGallerySharing.ts` |
| Utility function | Pure function or stateless helper | `cardPhysics.ts`, `deckInterpretation.ts` |
| Store | Global state (Zustand) + persistence bridge | `useStore.ts` |
| IDB layer | IndexedDB abstraction, isolated from components | `idb.ts` |

**Rule:** Components own rendering. Hooks own logic. Utils are pure. The store is the single source of truth.

---

## Error Handling

### IDB errors

Use the callback registration pattern — never throw from IndexedDB operations:

```typescript
// Register at app startup (App.tsx)
setDatabaseErrorCallback((message, error) => {
  showError(message);
  console.error(message, error);
});

// Inside idb.ts — notify, never throw
function notifyDatabaseError(message: string, error: unknown) {
  console.error(`[IDB] ${message}`, error);
  if (errorCallback) errorCallback(message, error);
}
```

### API route errors

All API routes return JSON error objects with an appropriate HTTP status:

```typescript
// Error
return res.status(400).json({ error: 'Descriptive message' });
// Success — typed response shape
return res.status(200).json({ success: true, uploaded: [...], failed: [...] });
```

Never return an error with HTTP 200.

### Client-side errors

Return structured result objects rather than throwing across async boundaries:

```typescript
// Utility functions return result objects
export interface VideoResponse {
  videoUrl?: string;
  error?: string;
}
```

Error messages must be descriptive and actionable — no silent failures, no generic "Something went wrong."

### Error handling by context

| Context | Pattern | Rationale |
|---------|---------|-----------|
| User-triggered operation (generate, share, delete) | `setError()` in hook → rendered by UI component | User needs to see and act on the failure |
| Background startup sync (store init, IDB load) | `console.error(...)` on failure — always visible | Failure is unexpected and may explain broken state; not user-actionable so no toast |
| Background prefetch/hydration progress | `debugLog(...)` for progress, `console.error(...)` on failure | Progress is noise; failure is signal |

---

## Logging

All debug logging goes through `src/utils/logger.ts`. Never use raw `console.log` in production code paths.

```typescript
import { debugLog } from '../utils/logger';

debugLog('[IDB Migration] Upgrading from version', oldVersion, 'to', DB_VERSION);
```

Logging is gated by either:
- `VITE_DEBUG_LOGS=true` environment variable (build-time)
- `localStorage.setItem('tarot:debugLogs', 'true')` (runtime, for debugging production)

`console.error` is acceptable for genuine errors that should always be visible.

---

## Imports

### Import style

Use relative paths. Absolute/alias imports are not configured.

```typescript
// ✅ Correct
import { useStore } from '../store/useStore';
import type { TarotCard, GeneratedCard } from '../types';
import { debugLog } from '../../utils/logger';

// ❌ Wrong
import { useStore } from '@/store/useStore';
```

### Type imports

Use `import type` for type-only imports to enable correct tree-shaking:

```typescript
import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { GeneratedCard } from '../types';
```

### JSON data

Import JSON directly — Vite handles the bundling:

```typescript
import tarotData from '../data/tarot-decks.json';
```

### Import grouping (order)

1. External packages (`react`, `three`, `@vercel/node`)
2. Internal utilities/hooks/store
3. Types (`import type`)
4. Data/assets (JSON, images)

---

## API Routes

### Input validation

All API routes validate inputs with Zod before any business logic:

```typescript
const QuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});
const parsed = QuerySchema.safeParse(req.query);
if (!parsed.success) return res.status(400).json({ error: 'Invalid query' });
```

### Authentication

Secret-gated endpoints check `Authorization: Bearer <SECRET>` before any other logic.
Rate limiting uses in-memory per-IP counters (not a database).

### Response shape

| Outcome | Shape |
|---------|-------|
| Success (single item) | `{ success: true, ...fields }` |
| Success (list) | Typed array directly, or `{ items: [...], total, hasMore }` |
| Error | `{ error: "Descriptive message" }` with correct HTTP status |

---

## IndexedDB (IDB)

### Never use async in `onupgradeneeded`

The `onupgradeneeded` handler is a synchronous transaction — async calls execute after the transaction closes.

```typescript
// ✅ Correct: collect data synchronously with openCursor, then migrate
request.onupgradeneeded = (event) => {
  // Use cursor-based iteration — sync within transaction
};

// ❌ Wrong: getAll() resolves after the transaction is already committed
request.onupgradeneeded = async () => {
  const records = await store.getAll(); // too late
};
```

Migration pattern: `collect data via cursor → delete store → create store → re-insert`.

### Schema versioning

`DB_VERSION` in `idb.ts` is the single source of truth. Increment for any schema change.
Each version bump must handle migration from all prior versions.

---

## Intentional Divergences

These are documented exceptions that `doc-audit` should not flag as violations.

| Divergence | Where | Why |
|------------|-------|-----|
| `*IPFSGallery` vs `*SupabaseGallery` suffixes | `useGallerySharing.ts` | Dual-path interim design; symmetry makes the future removal of Supabase path obvious. See [community gallery ADR](plans/2025-11-27-community-gallery-revised-plan.md). |
| `GalleryBundle` (IPFS/KV type) vs `CommunityDeckGroup` (Supabase type) | `src/types/index.ts` | Two separate data models for two separate backends; will converge when one path is deprecated. |
| `console.error` in `idb.ts` alongside `debugLog` | `src/utils/idb.ts` | IDB errors are always-visible failures, not debug noise. `console.error` is intentional. |
