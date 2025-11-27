import type { VercelRequest, VercelResponse } from '@vercel/node';
import { kv } from '@vercel/kv';
import { z } from 'zod';
import DOMPurify from 'isomorphic-dompurify';

/**
 * Validation schema for gallery registration
 */
const RegisterRequestSchema = z.object({
  cid: z.string().min(1).max(100),
  author: z.string().max(50).optional(),
  cardCount: z.number().int().min(1).max(100),
  deckTypes: z.array(z.string()).min(1).max(10),
});

/**
 * Gallery Registration Endpoint
 *
 * Purpose: Register a new IPFS gallery in the Vercel KV registry
 * Called AFTER the client successfully uploads to IPFS
 *
 * Storage Pattern: Redis ZSET + HASH for O(log N) scalability
 *
 * Structure:
 * - gallery:timeline (ZSET): Sorted by timestamp, members are CIDs
 * - gallery:{cid} (HASH): Metadata for each gallery
 *
 * Why ZSET instead of Array:
 * - Array: Read entire JSON, modify, write back (O(N), race conditions)
 * - ZSET: Atomic operations, paginated reads (O(log N), no races)
 *
 * Example:
 * POST /api/register-gallery
 * Body: { cid: "bafybei...", author: "Alice", cardCount: 22, deckTypes: ["lordOfMysteries"] }
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Validate request body
    const parseResult = RegisterRequestSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: 'Invalid request data',
        details: parseResult.error.format(),
      });
    }

    const { cid, author, cardCount, deckTypes } = parseResult.data;
    const timestamp = Date.now();

    // Sanitize author name (XSS prevention)
    const sanitizedAuthor = author
      ? DOMPurify.sanitize(author.trim()).slice(0, 50)
      : undefined;

    console.log(`[Register] Registering gallery: ${cid} by ${sanitizedAuthor || 'Anonymous'}`);

    // Store gallery metadata in HASH
    // Key: gallery:{cid}
    // Fields: cid, author, cardCount, deckTypes (JSON), timestamp
    await kv.hset(`gallery:${cid}`, {
      cid,
      author: sanitizedAuthor || '',
      cardCount,
      deckTypes: JSON.stringify(deckTypes),
      timestamp,
    });

    // Add to timeline ZSET (sorted by timestamp, newest first)
    // Key: gallery:timeline
    // Score: timestamp (for sorting)
    // Member: cid (the value)
    await kv.zadd('gallery:timeline', {
      score: timestamp,
      member: cid,
    });

    console.log(`[Register] Success: ${cid} registered at ${timestamp}`);

    return res.status(200).json({
      success: true,
      cid,
      timestamp,
    });
  } catch (error) {
    console.error('[API] /api/register-gallery error:', error);

    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Registration failed',
    });
  }
}
