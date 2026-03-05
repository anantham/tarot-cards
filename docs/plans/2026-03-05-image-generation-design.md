# Image Generation Design — Multi-Provider Routing

<!--
Last verified: 2026-03-05
Code hash: 4801537
Verified by: agent
-->

## Status

Implemented — `src/utils/imageGeneration.ts`, `src/utils/geminiImageGeneration.ts`

## Context

Each tarot card needs a generated illustration. Two image generation APIs are
supported: Gemini (Google) and OpenRouter (aggregator for many models). The user
selects their preferred provider in Settings and supplies their own API key.

Card illustrations are composed from a prompt built from deck lore, card narrative,
traditional symbolism, and the card's number — assembled by `generateCardFrames`
and then passed to the provider-specific generator.

## Decision: User-Supplied API Keys

**Chosen:** Users provide their own API keys for Gemini and OpenRouter.

**Rationale:** This is a personal app. Bundling a server-side API key would expose
that key to all users and create a shared quota. User-supplied keys mean each user
has their own quota and the server never holds AI generation credentials.

**Security model:** These keys are entered in Settings and stored in `localStorage`
via Zustand persist. They are sent directly from the browser to the provider API —
the server never sees them. This is an intentional trust boundary; the app is
single-user and users are the owner of their keys.

## Provider Routing

```
settings.apiProvider === 'gemini'  →  generateImageWithGemini()
                                       ↳ Google Generative AI SDK
                                       ↳ Supports reference images (multi-image)
                                       ↳ Returns base64 data URL

settings.apiProvider !== 'gemini'  →  generateImageWithOpenRouter()
                                       ↳ Fetch to configurable endpoint
                                       ↳ Text-to-image only (no reference images)
                                       ↳ Returns image URL from response
```

**Why two separate functions?** The APIs have fundamentally different call shapes:
Gemini uses a typed SDK with inline image parts; OpenRouter uses a REST endpoint
with a chat-completion-style body. Combining them into one function would be more
complex than two focused implementations.

## Reference Image System

Gemini supports sending reference images alongside the text prompt. The app uses
this for two purposes:

| Use case | Field | Description |
|----------|-------|-------------|
| **Photo likeness** | `settings.referenceImages` | User's photos, tagged with instruction (e.g. "use this face") |
| **Legacy** | `settings.userPhoto` | Single photo, used before multi-image system |

**Why multi-image over single photo?**
The multi-image system (added later) allows users to provide multiple reference
photos with per-image instructions, enabling richer likeness guidance. The legacy
single-photo path is kept for backward compatibility with existing settings.

**Priority:** If `referenceImages` is non-empty, it's used. If not but `userPhoto`
exists, the legacy path runs. If `usePhoto === false`, neither is sent.

## Custom API Endpoint

OpenRouter users can override `settings.apiEndpoint`. This enables:
- Using a self-hosted OpenAI-compatible proxy
- Using a different OpenRouter region
- Testing against a local model server during development

**Security model:** This is user-supplied, not operator-supplied. The user is the
only person with access to this app and their settings. The endpoint is used as-is
(with a scheme normalisation if missing). There is no server-side SSRF risk because
the request goes directly from the user's browser, not through the server.

If this ever became a shared/multi-user app, the custom endpoint would need to be
removed or validated server-side.

## Prompt Composition

Card prompts are assembled in `generateCardFrames` from layered components:

| Layer | Source | Optional? |
|-------|--------|-----------|
| Deck interpretation | `deckInterpretation.ts` + `tarot-config.json` | Required |
| Card narrative | `card.narrative` from deck JSON | Optional |
| Traditional symbolism | `traditional-symbols.json` (Rider-Waite only) | Optional |
| LOTM lore | `lotm-lore.json` (LoTM decks only) | Optional |
| Deck-specific lore | `deck-lore.json` (Egyptian/Celtic/Shinto) | Optional |
| Buddhist lore | `buddhist-lore.json` (Buddhist deck) | Optional |
| Card number instruction | Inline (Roman numeral integration) | Required |
| Framing instructions | `tarot-config.json` promptComposition | Required |

Composition order is configurable via `tarot-config.json`'s `compositionOrder` array,
defaulting to `['deckPrompt', 'lore', 'tradition', 'framing']`.

## Error Handling

Both generators catch exceptions and return `{ imageUrl: '', error: 'message' }`.
They never throw. The caller (`generateCardFrames`) checks `result.error` and
throws if non-empty — this converts the result pattern into an exception at the
orchestration layer (`useCardGeneration.ts`) which catches it and updates UI state.

**Why result objects at the generator level?** Makes it easy to add retry logic or
fallback providers in future without restructuring control flow.

## Key Decisions

| Decision | Chosen | Alternatives considered | Why |
|----------|--------|------------------------|-----|
| Provider selection | User-selects in Settings | Server-side routing | Users own their quotas and keys |
| Custom endpoints | Allowed (OpenRouter only) | Fixed endpoints | Power users, proxies, local dev |
| Reference images | Inline base64 parts (Gemini SDK) | Upload to storage first | No round-trip, simpler auth |
| Error surface | Result objects at generator level | Throw everywhere | Easier retry and fallback |
| Prompt composition | Config-driven order | Hardcoded | Allows per-deck tuning without code changes |

## Known Limitations

- **OpenRouter: no reference images.** The OpenRouter chat-completion API doesn't
  support inline image parts for generation (only for vision). Photo-based generation
  requires Gemini.
- **`any` types for lore access.** `(card as any).narrative`, `(lotmLore as any).cards`
  — these casts exist because the lore JSON files don't have TypeScript type definitions.
  Adding type definitions for each lore format would resolve this.
- **Single frame only.** `generateCardFrames` generates one image and returns it in a
  single-item array (the `_frameCount` parameter is ignored). The video generation step
  uses this single image as a reference. The multi-frame name is a historical artifact.

## Tech Debt

- **`(card as any).narrative` and similar casts** in `imageGeneration.ts` — lore JSON
  files need typed interfaces.
- **`requestPayload: any`** in `geminiImageGeneration.ts` — Gemini SDK types can be
  used directly once the request shape is confirmed stable.
- **`_frameCount` parameter** in `generateCardFrames` — dead parameter kept for call
  site compatibility. Should be removed once callers are updated.
