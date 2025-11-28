# Community Gallery Auth Failure Report (Local Dev)

**Date:** 2025-11-27  
**Context:** Upload flow fails at `/api/auth/w3up` with multibase decode error. IndexedDB cards exist locally; frontend on 5173; API attempted on 3000/5173.

## Summary
- **Current blocker:** `POST /api/auth/w3up` returns 500 with `Unable to decode multibase string ... base64pad decoder only supports inputs prefixed with M`.
- **Env key:** `WEB3_STORAGE_AGENT_KEY=Ed25519PrivateKey:base58:MgCYKF6FJFYXUnicB2mckXh5aS0cP6TPhhfCcvIs8igSYW+0BLWIbz7okywyIatpJXkTIpH4+pcMLS/ucaRgP/Qs0Ogg=`
  - Payload decodes as base64 (69 bytes), not base58btc.
- **Tried:** Normalizing agent key to multibase base58btc (`z` prefix) and base64pad (`m` prefix). `Signer.parse` still fails.
- **Next ask:** Determine correct format for `@ucanto/principal/ed25519.parse` for this key. Likely needs explicit `m` base64 multibase or different wrapping.

## Repro Steps
1) `.env.local` set with the agent key above + other required keys (KV, delegation proof, Gemini).
2) Start API (fails without network to Vercel):
   - Intended: `vercel build --yes`
   - Then: `vercel dev --listen 3000 --yes` (serving `.vercel/output`)
3) Start Vite with proxy to API: `API_PROXY_TARGET=http://localhost:3000 npm run dev` (frontend stays on 5173).
4) In app: close Settings with auto-share on → upload starts → `/api/auth/w3up` 500s.
5) API log shows multibase decode error.

## Relevant Code

### api/auth/w3up.ts (current)
```ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import * as Client from '@web3-storage/w3up-client';
import * as Signer from '@ucanto/principal/ed25519';
import * as Delegation from '@ucanto/core/delegation';
import { CarReader } from '@ipld/car';
import { base58btc } from 'multiformats/bases/base58';

async function parseProof(data: string): Promise<Delegation.Delegation<any>> {
  const blocks = [];
  const reader = await CarReader.fromBytes(Buffer.from(data, 'base64'));
  for await (const block of reader.blocks()) blocks.push(block);
  return Delegation.importDAG(blocks as any) as Delegation.Delegation<any>;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const { clientDID } = req.body;
    if (!clientDID || typeof clientDID !== 'string') return res.status(400).json({ error: 'clientDID required (string)' });
    if (!clientDID.startsWith('did:key:')) return res.status(400).json({ error: 'Invalid DID format (must start with did:key:)' });

    const agentKeyRaw = process.env.WEB3_STORAGE_AGENT_KEY;
    const delegationProof = process.env.WEB3_STORAGE_DELEGATION_PROOF;
    if (!agentKeyRaw) throw new Error('WEB3_STORAGE_AGENT_KEY not configured');
    if (!delegationProof) throw new Error('WEB3_STORAGE_DELEGATION_PROOF not configured');

    const normalizeAgentKey = (key: string): string => {
      if (/^[zm]/i.test(key)) return key;
      if (key.startsWith('Ed25519PrivateKey:')) {
        const payload = key.split(':').pop() || '';
        try {
          const decoded = base58btc.decode(`z${payload}`);
          return `z${base58btc.encode(decoded)}`;
        } catch {
          try {
            const bytes = Buffer.from(payload, 'base64');
            const encoded = base58btc.encode(bytes);
            return `z${encoded}`;
          } catch {
            throw new Error('WEB3_STORAGE_AGENT_KEY payload is neither base58 nor base64');
          }
        }
      }
      try {
        const bytes = Buffer.from(key, 'base64');
        const encoded = base58btc.encode(bytes);
        return `z${encoded}`;
      } catch {
        return key;
      }
    };

    const agentKey = normalizeAgentKey(agentKeyRaw);
    const principal = Signer.parse(agentKey); // <-- throws on current key
    const client = await Client.create({ principal });

    const proof = await parseProof(delegationProof);
    const space = await client.addSpace(proof);
    await client.setCurrentSpace(space.did());

    const clientPrincipal = Signer.parse(clientDID);
    const delegation = await (client as any).createDelegation(clientPrincipal, ['store/add', 'upload/add']);
    const archive = await delegation.archive();
    const archiveBytes: Uint8Array =
      (archive as any)?.ok instanceof Uint8Array
        ? (archive as any).ok
        : (archive as any) instanceof Uint8Array
          ? (archive as any)
          : new Uint8Array(await (archive as any).arrayBuffer?.());
    const delegationBase64 = Buffer.from(archiveBytes).toString('base64');

    return res.status(200).json({ delegation: delegationBase64, spaceDID: space.did(), expiresAt: null });
  } catch (error) {
    console.error('[API] /api/auth/w3up error:', error);
    let errorMessage = 'Delegation failed';
    if (error instanceof Error) {
      if (error.message.includes('not configured')) errorMessage = 'Server credentials not configured. Check environment variables.';
      else if (error.message.includes('parse')) errorMessage = 'Invalid delegation proof format. Regenerate credentials.';
      else errorMessage = error.message;
    }
    return res.status(500).json({ error: errorMessage });
  }
}
```

### Frontend upload caller (excerpt, src/hooks/useGallerySharing.ts)
```ts
logProgress('Requesting authorization...');
const authResponse = await fetch('/api/auth/w3up', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ clientDID: client.agent.did() }),
});
if (!authResponse.ok) { ... }
const { delegation: delegationBase64, spaceDID } = await authResponse.json();
```

## Attempted Normalizations
- Prefix `Ed25519PrivateKey:base58:<payload>` with `z` (base58btc multibase): still fails.
- Prefix base64 payload with `m` (base64pad multibase): also fails.
- Current logic tries base58 decode, then base64→base58btc multibase.
- Direct `Signer.parse('z' + payload)` on this payload throws the same multibase error.

## Environment Notes
- `vercel.json` currently:
```json
{
  "functions": {
    "api/proxy.ts": { "maxDuration": 60 },
    "api/auth/w3up.ts": { "maxDuration": 10 }
  },
  "devCommand": ""
}
```
- API startup blocked in-sandbox due to lack of network to api.vercel.com; user runs `vercel dev --listen 3000 --yes` locally.
- Frontend on http://localhost:5173 with `/api` proxy to 3000 (keeps IndexedDB data).

## Ask for LLM
Given the agent key above (base64 payload), what exact string should be passed to `@ucanto/principal/ed25519.parse`? Should we wrap as `m<base64>` (multibase base64pad), `z<base58btc(payload)>`, or something else? Provide a working normalization for this key format.
