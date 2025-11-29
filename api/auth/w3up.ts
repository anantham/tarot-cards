import type { VercelRequest, VercelResponse } from '@vercel/node';
import { create } from '@web3-storage/w3up-client';
import { Signer } from '@web3-storage/w3up-client/principal/ed25519';
import * as Proof from '@web3-storage/w3up-client/proof';
import * as DID from '@ipld/dag-ucan/did';
import { base58btc } from 'multiformats/bases/base58';

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

    // Load credentials from environment
    const agentKeyRaw = process.env.WEB3_STORAGE_AGENT_KEY;
    const delegationProofBase64 = process.env.WEB3_STORAGE_DELEGATION_PROOF;

    if (!agentKeyRaw) {
      throw new Error('WEB3_STORAGE_AGENT_KEY not configured');
    }

    if (!delegationProofBase64) {
      throw new Error('WEB3_STORAGE_DELEGATION_PROOF not configured');
    }

    // Normalize agent key into a properly tagged multibase ed25519 private key
    const normalizeAgentKey = (key: string): string => {
      const trimmed = key.trim();
      if (/^[zm]/i.test(trimmed)) return trimmed; // already multibase

      // Accept raw base64 payload (from w3 key create --json "key" field)
      let bytes = Buffer.from(trimmed, 'base64');
      // Some exports include an extra leading byte; keep the last 64 bytes
      if (bytes.length > 64) {
        bytes = bytes.slice(bytes.length - 64);
      }
      if (bytes.length !== 64) {
        throw new Error(`Agent key must be 64 bytes before tagging, got ${bytes.length}`);
      }
      // Prepend multicodec 0x1300 for ed25519-priv (varint: 0x80 0x26)
      const prefixed = Buffer.concat([Buffer.from([0x80, 0x26]), bytes]);
      // Encode as base58btc multibase
      return base58btc.encode(prefixed);
    };

    const agentKey = normalizeAgentKey(agentKeyRaw);
    // Initialize server agent with Ed25519 key
    const principal = Signer.parse(agentKey);
    const serviceClient = await create({ principal });

    // Parse the space delegation proof and add it to the client
    const delegationProof = await Proof.parse(delegationProofBase64);
    const space = await serviceClient.addSpace(delegationProof);
    await serviceClient.setCurrentSpace(space.did());

    // Parse the client's DID using the official DID parser
    const audience = DID.parse(clientDID);

    // Create a UCAN delegation for the browser client with upload capabilities
    const abilities = ['store/add', 'upload/add'] as ('store/add' | 'upload/add')[];
    const delegation = await serviceClient.createDelegation(audience, abilities);

    // Serialize the delegation to CAR bytes
    const archiveResult = await delegation.archive();
    if (!archiveResult.ok) {
      throw new Error('Failed to archive delegation');
    }

    // Encode as base64 for JSON transport
    const delegationBase64 = Buffer.from(archiveResult.ok).toString('base64');

    return res.status(200).json({
      delegation: delegationBase64,
      spaceDID: space.did(),
    });
  } catch (error) {
    console.error('[API] /api/auth/w3up error:', error);

    let errorMessage = 'Delegation failed';
    if (error instanceof Error) {
      if (error.message.includes('not configured')) {
        errorMessage = 'Server credentials not configured. Check environment variables.';
      } else {
        errorMessage = error.message;
      }
    }

    return res.status(500).json({
      error: errorMessage,
    });
  }
}
