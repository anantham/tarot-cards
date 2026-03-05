# Module Documentation Index

<!--
Last updated: 2026-03-05
Code hash: 5286453
-->

Module docs are written when a module has complex invariants, non-obvious
design rationale, or is a common source of confusion. Self-documenting
modules with clear naming don't need a doc here.

See [CONVENTIONS.md](../CONVENTIONS.md) for project-wide naming, patterns, and style rules.

---

## Modules

| Module | Doc | Status | Notes |
|--------|-----|--------|-------|
| `src/utils/idb.ts` | [idb](idb.md) | current | Migration invariants covered by idb.migration.test.ts |
| `src/hooks/useGallerySharing.ts` | [useGallerySharing](useGallerySharing.md) | current | Dual-path design + IPFS activation migration plan documented |
| `src/components/card-deck/` | — | undocumented | P3 — self-documenting post Phase-10 decomposition |
| `src/components/card-detail/` | — | undocumented | P3 — self-documenting post Phase-6 decomposition |
| `src/components/settings/` | — | undocumented | P3 — self-documenting post Phase-9 decomposition |
| `server/upload/` | — | undocumented | P3 — security guards documented inline |
| `src/utils/cardPhysics.ts` | — | undocumented | P3 — covered by integration tests |

## Active ASSERTIONs

None yet. Use `doc-prover` to add formal assertions for complex invariants.

Candidates from doc audit:
- IDB v1→v3 migration preserves all card data (no test coverage today)
- Card physics velocity clamping keeps all cards within boundary after N frames

## ADRs

| ADR | Status | Topic |
|-----|--------|-------|
| [community-gallery-revised-plan](../plans/2025-11-27-community-gallery-revised-plan.md) | Partial — Supabase primary, IPFS stalled | Community gallery upload/download architecture |
| [animation-phase-cycling-design](../plans/2025-11-29-animation-phase-cycling-design.md) | Implemented (2026-02-22) | Deck animation phase cycling + velocity injection |
| [community-gallery-implementation](../plans/2025-11-26-community-gallery-implementation.md) | Superseded by revised plan | Original community gallery plan |
| [community-gallery-ipfs-design](../plans/2025-11-26-community-gallery-ipfs-design.md) | Superseded | Original IPFS design |
| [animation-phase-cycling-plan](../plans/2025-11-29-animation-phase-cycling-plan.md) | Implemented | Implementation task breakdown for phase cycling |
