import type { VercelRequest, VercelResponse } from '@vercel/node';
import * as Client from '@web3-storage/w3up-client';
import * as Signer from '@ucanto/principal/ed25519';
import * as Delegation from '@ucanto/core/delegation';
import { CarReader } from '@ipld/car';
import { base58btc } from 'multiformats/bases/base58';

/**
 * Parse Base64-encoded CAR delegation proof
 */
async function parseProof(data: string): Promise<Delegation.Delegation<any>> {
  const blocks = [];
  const reader = await CarReader.fromBytes(Buffer.from(data, 'base64'));
  for await (const block of reader.blocks()) {
    blocks.push(block);
  }
  // Force-cast due to upstream typing differences
  return Delegation.importDAG(blocks as any) as Delegation.Delegation<any>;
}

/**
 * UCAN Delegation Endpoint
 *
 * Vends temporary, scoped delegations to browser clients, allowing them
 * to upload directly to Web3.Storage without exposing the master key.
 *
 * Flow:
 * 1. Client sends their DID (did:key:...)
 * 2. Server validates environment credentials
 * 3. Server creates scoped delegation (store/add, upload/add only)
 * 4. Client receives delegation proof to use for uploads
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { clientDID } = req.body;

    // Validate request
    if (!clientDID || typeof clientDID !== 'string') {
      return res.status(400).json({ error: 'clientDID required (string)' });
    }

    if (!clientDID.startsWith('did:key:')) {
      return res.status(400).json({ error: 'Invalid DID format (must start with did:key:)' });
    }

    // Normalize environment variables
    const agentKeyRaw = process.env.WEB3_STORAGE_AGENT_KEY;
    const delegationProof = process.env.WEB3_STORAGE_DELEGATION_PROOF;

    if (!agentKeyRaw) {
      throw new Error('WEB3_STORAGE_AGENT_KEY not configured');
    }

    if (!delegationProof) {
      throw new Error('WEB3_STORAGE_DELEGATION_PROOF not configured');
    }

    // Initialize server agent with master key
    const normalizeAgentKey = (key: string): string => {
      // Already valid multibase: z=base58btc, M=base64pad, m=base64
      if (/^[zmM]/.test(key)) return key;

      // Keys like Ed25519PrivateKey:<encoding>:<payload>
      if (key.startsWith('Ed25519PrivateKey:')) {
        const payload = key.split(':').pop() || '';

        // If payload is already a valid multibase string (M=base64pad, m=base64, z=base58btc)
        // This is the common case: w3 CLI outputs base64pad multibase strings starting with 'M'
        if (/^[Mmz]/.test(payload)) {
          return payload;
        }

        // Try base58btc payload (no multibase prefix)
        try {
          const decoded = base58btc.decode(`z${payload}`);
          return `z${base58btc.encode(decoded)}`;
        } catch {
          // If it looks like base64 (contains + / =), wrap as base64pad multibase
          if (/[+/=]/.test(payload)) {
            return `M${payload}`;
          }
          // Last fallback: treat as base64 anyway
          try {
            Buffer.from(payload, 'base64');
            return `M${payload}`;
          } catch {
            throw new Error('WEB3_STORAGE_AGENT_KEY payload is neither base58 nor base64');
          }
        }
      }

      // Fallback: plain base64 string -> base64pad multibase
      try {
        Buffer.from(key, 'base64');
        return `M${key}`;
      } catch {
        return key; // Last resort
      }
    };

    const agentKey = normalizeAgentKey(agentKeyRaw);
    const principal = Signer.parse(agentKey);
    const client = await Client.create({ principal });

    // Load space proof (proves server has authority over the space)
    const proof = await parseProof(delegationProof);
    const space = await client.addSpace(proof);
    await client.setCurrentSpace(space.did());

    // Create scoped delegation for client using explicit Delegation.delegate()
    // This pattern gives more control and avoids internal encoding issues
    const spaceDID = space.did();
    const delegation = await Delegation.delegate({
      issuer: principal,
      audience: { did: () => clientDID as `did:${string}` },
      capabilities: [
        { can: 'store/add', with: spaceDID },
        { can: 'upload/add', with: spaceDID },
      ],
      proofs: client.proofs([
        { can: 'store/add', with: spaceDID },
        { can: 'upload/add', with: spaceDID },
      ]),
      expiration: Math.floor(Date.now() / 1000) + (60 * 60 * 24), // 24 hours
    });

    // Serialize delegation as Base64 CAR for transport
    const archive = await delegation.archive();
    // archive may be Result-like; normalize to Uint8Array
    const archiveBytes: Uint8Array =
      (archive as any)?.ok instanceof Uint8Array
        ? (archive as any).ok
        : (archive as any) instanceof Uint8Array
          ? (archive as any)
          : new Uint8Array(await (archive as any).arrayBuffer?.());
    const delegationBase64 = Buffer.from(archiveBytes).toString('base64');

    return res.status(200).json({
      delegation: delegationBase64,
      spaceDID: spaceDID,
      expiresAt: null, // Delegations don't expire by default (session-scoped)
    });
  } catch (error) {
    console.error('[API] /api/auth/w3up error:', error);

    // Provide helpful error messages for common issues
    let errorMessage = 'Delegation failed';
    if (error instanceof Error) {
      if (error.message.includes('not configured')) {
        errorMessage = 'Server credentials not configured. Check environment variables.';
      } else if (error.message.includes('parse')) {
        errorMessage = 'Invalid delegation proof format. Regenerate credentials.';
      } else {
        errorMessage = error.message;
      }
    }

    return res.status(500).json({
      error: errorMessage,
    });
  }
}
