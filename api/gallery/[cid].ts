import type { VercelRequest, VercelResponse } from '@vercel/node';
import { kv } from '@vercel/kv';

/**
 * Individual Gallery Endpoint
 *
 * Purpose: Fetch metadata and IPFS URL for a specific gallery
 * Uses HASH lookup for O(1) performance
 *
 * Route: GET /api/gallery/{cid}
 * Example: GET /api/gallery/bafybeiabc123...
 *
 * Response:
 * {
 *   cid: "bafybeiabc123...",
 *   ipfsUrl: "https://w3s.link/ipfs/bafybeiabc123...",
 *   metadata: {
 *     author: "Alice",
 *     cardCount: 22,
 *     deckTypes: ["lordOfMysteries"],
 *     timestamp: 1732534800000
 *   }
 * }
 *
 * Client then:
 * 1. Fetches manifest.json from ipfsUrl
 * 2. Loads card images/videos from IPFS
 * 3. Populates IndexedDB
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { cid } = req.query;

    // Validate CID parameter
    if (!cid || typeof cid !== 'string') {
      return res.status(400).json({ error: 'Invalid CID parameter' });
    }

    if (cid.length > 100) {
      return res.status(400).json({ error: 'CID too long (max 100 chars)' });
    }

    // Fetch gallery metadata from HASH
    // Key: gallery:{cid}
    const bundle = await kv.hgetall(`gallery:${cid}`);

    // Check if gallery exists
    if (!bundle || !bundle.cid) {
      return res.status(404).json({ error: 'Gallery not found' });
    }

    // Construct IPFS gateway URL
    // Using w3s.link (Web3.Storage's official gateway)
    // Client will implement gateway race for redundancy
    const ipfsUrl = `https://w3s.link/ipfs/${bundle.cid}`;

    // Return metadata + IPFS URL
    return res.status(200).json({
      cid: bundle.cid,
      ipfsUrl,
      metadata: {
        author: bundle.author || undefined,
        cardCount: parseInt(bundle.cardCount as string, 10),
        deckTypes: JSON.parse(bundle.deckTypes as string),
        timestamp: parseInt(bundle.timestamp as string, 10),
      },
    });
  } catch (error) {
    console.error('[API] /api/gallery/[cid] error:', error);

    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Fetch failed',
    });
  }
}
