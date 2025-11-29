# Future IPFS/Delegation Roadmap

## Goal
Enable user‑scoped, server‑signed / client‑executed uploads to Web3.Storage/IPFS using w3up/UCAN, so the frontend can share generated tarot cards without exposing secrets.

## Why
- Keeps secrets server‑side (agent key, space proof).
- Lets the browser upload directly (no payload size limits).
- Capability-based access (per-client delegations instead of broad API tokens).
- Better alignment with decentralized storage vs. centralized pinning.

## Current Blocker
- `/api/auth/w3up` 500s due to malformed `WEB3_STORAGE_AGENT_KEY` (missing multicodec tag / format). Need canonical agent key + space proof.

## Near-Term Steps
- Export canonical agent key and space proof via w3 CLI and set in env.
- Make `/api/auth/w3up` accept only properly tagged multibase keys (no runtime guessing).
- Add explicit success/error logging and curl sanity checks for `/api/auth/w3up`.
- Confirm client flow: request delegation → add proof → upload frames/videos.

## Longer-Term IPFS Enhancements
- Multi-gateway download with retries and better error surfacing.
- Manifest format for cards (cardNumber, deckType, frames, video URLs, CID).
- Optional encryption (password-protected exports).
- Pagination/filtering for community gallery from KV/IPFS.
- CLI/script to re-pin existing CIDs to new providers (migration).
- Share prompt metadata alongside media so downloads can recreate local prompts.

## If Delegation Remains Blocked
- Use pinning service with server-side token as interim.
- Support “Export all cards” (zip) as local backup/import path.
- Keep manifest compatible with future IPFS upload (so re-pin later).
- Simplest hosted alternative: Supabase (free tier), with a public storage bucket for community assets and a Postgres table for metadata. Use a Vercel API route to issue signed uploads (secrets stay server-side) and insert metadata; clients read via public URLs.
