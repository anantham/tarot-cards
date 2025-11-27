import type { VercelRequest, VercelResponse } from '@vercel/node';
import * as Client from '@web3-storage/w3up-client';
import * as Signer from '@ucanto/principal/ed25519';
import * as Delegation from '@ucanto/core/delegation';
import { CarReader } from '@ipld/car';

/**
 * Parse Base64-encoded CAR delegation proof
 */
async function parseProof(data: string): Promise<Delegation.Delegation> {
  const blocks = [];
  const reader = await CarReader.fromBytes(Buffer.from(data, 'base64'));
  for await (const block of reader.blocks()) {
    blocks.push(block);
  }
  return Delegation.importDAG(blocks);
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

    // Check environment variables
    const agentKey = process.env.WEB3_STORAGE_AGENT_KEY;
    const delegationProof = process.env.WEB3_STORAGE_DELEGATION_PROOF;

    if (!agentKey) {
      throw new Error('WEB3_STORAGE_AGENT_KEY not configured');
    }

    if (!delegationProof) {
      throw new Error('WEB3_STORAGE_DELEGATION_PROOF not configured');
    }

    // Initialize server agent with master key
    const principal = Signer.parse(agentKey);
    const client = await Client.create({ principal });

    // Load space proof (proves server has authority over the space)
    const proof = await parseProof(delegationProof);
    const space = await client.addSpace(proof);
    await client.setCurrentSpace(space.did());

    // Create scoped delegation for client
    // Abilities: store/add (raw data), upload/add (CAR files)
    // Does NOT include: space/*, store/remove, upload/remove
    const delegation = await client.createDelegation(clientDID, {
      abilities: ['store/add', 'upload/add'],
    });

    // Serialize delegation as Base64 CAR for transport
    const archive = await delegation.archive();
    const delegationBytes = new Uint8Array(await archive.arrayBuffer());
    const delegationBase64 = Buffer.from(delegationBytes).toString('base64');

    return res.status(200).json({
      delegation: delegationBase64,
      spaceDID: space.did(),
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
