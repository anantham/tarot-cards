# w3up Auth Debug Notes

## Current blocker
/api/auth/w3up returns 500 during client upload. Errors seen in API logs:
- `Unable to decode multibase string "...", base64pad decoder only supports inputs prefixed with M`
- `Expected Uint8Array with byteLength of 68 instead not 69`
- `Given bytes must be a multiformat with 4864 tag`

## Root cause
`WEB3_STORAGE_AGENT_KEY` was provided as `Ed25519PrivateKey:base58:...` but the payload is actually base64 and 69 bytes. `@ucanto/principal/ed25519.parse` expects a multibase-encoded key, typically base64pad (`m...`) with a 68-byte secret key.

## Local normalization
You can normalize the provided key once and set it in .env.local:
```bash
node scripts/normalize-agent-key.mjs "Ed25519PrivateKey:base58:<REDACTED_AGENT_KEY>"
# Output:
# MAJgoXoUkVhdSeJwHaZyReHlpLRw/pM+GF8Jy8izyKBJhb7QEtYhvPuiTLDIhq2kleRMikfj6lwwtL+5xpGA/9CzQ6CA=
```
Set `WEB3_STORAGE_AGENT_KEY` to that output (it is base64pad multibase, starts with `M`). Then restart API + frontend.

Script: `scripts/normalize-agent-key.mjs`
```js
import { base64pad } from 'multiformats/bases/base64'
import { base58btc } from 'multiformats/bases/base58'

const key = process.argv[2]
if (!key) {
  console.error('Usage: node scripts/normalize-agent-key.mjs <agent-key>')
  process.exit(1)
}

const trimmed = key.trim()

// Already multibase
if (/^[zm]/i.test(trimmed)) {
  console.log(trimmed)
  process.exit(0)
}

const payload = trimmed.startsWith('Ed25519PrivateKey:')
  ? trimmed.split(':').pop() || ''
  : trimmed

const tryBase64 = () => {
  let bytes = Buffer.from(payload, 'base64')
  if (bytes.length > 68) bytes = bytes.slice(bytes.length - 68)
  if (bytes.length !== 68) throw new Error(`Expected 68 bytes, got ${bytes.length}`)
  return base64pad.encode(bytes)
}

const tryBase58 = () => {
  const decoded = base58btc.decode(`z${payload}`)
  return `z${base58btc.encode(decoded)}`
}

try {
  const normalized = tryBase64()
  console.log(normalized)
  process.exit(0)
} catch (e) {}

try {
  const normalized = tryBase58()
  console.log(normalized)
  process.exit(0)
} catch (e) {
  console.error('Failed to normalize key as base64pad or base58btc')
  process.exit(1)
}
```

## Recommended fix
- Use an officially exported agent key from w3up (`w3` CLI) and set `WEB3_STORAGE_AGENT_KEY` to that multibase string directly (usually `m...`). No runtime normalization needed.
- Use the CAR proof as `WEB3_STORAGE_DELEGATION_PROOF` as exported.

## Run locally
- API: `vercel dev --listen 3000 --yes` (serves /api/*)
- Frontend: `API_PROXY_TARGET=http://localhost:3000 npm run dev` (keeps IndexedDB on 5173)
- Verify: `curl -i -X POST http://localhost:3000/api/auth/w3up -H "content-type: application/json" -d '{"clientDID":"did:key:test"}'` should return 200.
