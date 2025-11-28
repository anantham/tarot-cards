# W3UP Auth Debugging Investigation

## The Error
```
Unable to decode multibase string "zMgCYKF6FJFYXUnicB2mckXh5aS0cP6TPhhfCcvIs8igSYW+0BLWIbz7okywyIatpJXkTIpH4+pcMLS/ucaRgP/Qs0Ogg=", 
base64pad decoder only supports inputs prefixed with M
```

## The Key
```
Ed25519PrivateKey:base58:MgCYKF6FJFYXUnicB2mckXh5aS0cP6TPhhfCcvIs8igSYW+0BLWIbz7okywyIatpJXkTIpH4+pcMLS/ucaRgP/Qs0Ogg=
```

## Key Observation

The payload `MgCYKF6...=` contains:
- `+` character (at position ~35 and ~56)
- `/` character (at position ~54)  
- `=` character (trailing padding)

These characters **are NOT** in the base58btc alphabet. Base58btc explicitly excludes `+`, `/`, `0`, `O`, `I`, `l`.

But wait - the payload **starts with `M`**, which is the multibase prefix for **base64pad**!

## What's Actually Happening

### Multibase Primer
- `z` prefix = base58btc encoding
- `M` prefix = base64pad encoding (standard base64)
- `m` prefix = base64 (no padding)

### The Bug

1. The env key claims format `base58:` but the payload is clearly base64pad (contains +/=, starts with M)

2. The `normalizeAgentKey` function does:
   ```js
   const payload = key.split(':').pop() || '';  
   // payload = "MgCYKF6..."
   
   // First try: decode as base58btc
   const decoded = base58btc.decode(`z${payload}`);
   // This SHOULD throw - invalid chars for base58btc
   ```

3. BUT the string `zMgCYKF6...` somehow reaches `Signer.parse`

4. `Signer.parse` sees the `z` prefix, tries base58btc decode, fails, then tries to interpret the decoded garbage as another multibase string...

## Root Cause Hypothesis (high confidence: ~85%)

The payload `MgCYKF6...=` **is already a valid multibase string** (base64pad with M prefix).

The `@ucanto/principal/ed25519` Signer.parse likely accepts multibase strings directly. We're mangling it by:
1. Treating it as raw base64 
2. Converting to base58btc
3. Prepending `z`

Result: `Signer.parse("zMgCYKF6...")` - a `z` prefix wrapping what's actually a base64pad string.

## Proposed Fix

```typescript
const normalizeAgentKey = (key: string): string => {
  // Already valid multibase (z=base58btc, M=base64pad, m=base64)
  if (/^[zMm]/.test(key)) return key;

  // Ed25519PrivateKey:<encoding>:<payload>
  if (key.startsWith('Ed25519PrivateKey:')) {
    const payload = key.split(':').pop() || '';
    
    // If payload is already multibase-prefixed, use directly
    if (/^[zMm]/.test(payload)) return payload;
    
    // ... rest of conversion logic
  }
  // ...
};
```

## Alternative Hypothesis (~15%)

The key generation tool produced an incorrect format. The `base58:` label is wrong - should be `base64:` or just provide the raw multibase string `MgCYKF6...`.

## Resolution

The key `MgCYKF6...` from `server_identity.key` is already a valid multibase string:
- `M` prefix = base64pad encoding
- Rest = base64-encoded Ed25519 key material

The bug was in the normalizer adding a prefix to an already-prefixed string:
```js
// BEFORE (wrong):
return `m${payload}`;  // "mMgCYKF6..." - double prefixed!

// AFTER (fixed):
if (/^[Mmz]/.test(payload)) return payload;  // "MgCYKF6..." - as-is
```

### Changes Made to `api/auth/w3up.ts`:

1. Added early check: if payload already starts with multibase prefix, return directly
2. Changed fallback prefix from `m` (base64) to `M` (base64pad) for consistency

### Root Cause

1. `w3 key create` outputs base64pad multibase strings (M prefix)
2. `.env.example` incorrectly suggested `Ed25519PrivateKey:base58:...` format
3. Normalizer didn't check if payload was already a valid multibase string
4. Code prepended another prefix, creating invalid double-prefixed string

## Test Command

```bash
curl -X POST http://localhost:3000/api/auth/w3up \
  -H "Content-Type: application/json" \
  -d '{"clientDID": "did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK"}'
```

---
*Resolved*

---

## Bug #2: Wrong parser for client DID

### Error
```
Unable to decode multibase string "did:key:z4MXj1wBzi9j...", 
base64pad decoder only supports inputs prefixed with M
```

### Root Cause

The code was using `Signer.parse(clientDID)` but:
- `Signer.parse` expects a **private key** in multibase format
- `clientDID` is a **public DID identifier** (did:key:...)

You can't parse a public DID as a signer because there's no private key material.

### Fix

Use `Absentee` from `@ucanto/principal` instead:

```typescript
// BEFORE (wrong):
const clientPrincipal = Signer.parse(clientDID);

// AFTER (correct):
import { Absentee } from '@ucanto/principal';
const clientPrincipal = Absentee.from({ id: clientDID as `did:${string}` });
```

`Absentee` creates a principal from just a DID identifier - it represents "someone we know by their DID but don't have their key material". This is exactly what's needed for creating delegations TO someone.

### Additional Note

The client's DID `did:key:z4MXj1w...` starts with `z4` which indicates a **P-256** key (not Ed25519). The Ed25519 signer parser couldn't handle it anyway, even if it were a private key.

---
*Both bugs resolved*
