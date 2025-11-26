import type { VercelRequest, VercelResponse } from '@vercel/node';
import { create } from '@web3-storage/w3up-client';
import * as Signer from '@ucanto/principal/ed25519';
import { importDAG } from '@ucanto/core/delegation';
import { CarReader } from '@ipld/car';
import { kv } from '@vercel/kv';
import { z } from 'zod';
import DOMPurify from 'isomorphic-dompurify';
import type { GeneratedCard, GalleryBundle, IPFSCardPackage } from '../src/types';

// Zod schema for runtime validation
const GeneratedCardSchema = z.object({
  cardNumber: z.number().int().min(0).max(21),
  deckType: z.string().min(1),
  frames: z.array(z.string()).min(1),
  timestamp: z.number(),
  shared: z.boolean(),
  source: z.enum(['local', 'community']),
  videoUrl: z.string().optional(),
  gifUrl: z.string().optional(),
  bundleCID: z.string().optional(),
});

const UploadRequestSchema = z.object({
  cards: z.array(GeneratedCardSchema).min(1).max(100),
  author: z.string().max(50).optional(),
});

interface UploadRequest {
  cards: GeneratedCard[];
  author?: string;
}

/**
 * Parse delegation proof from base64-encoded CAR file
 */
async function parseProof(data: string) {
  const blocks = [];
  const reader = await CarReader.fromBytes(Buffer.from(data, 'base64'));
  for await (const block of reader.blocks()) {
    blocks.push(block);
  }
  return importDAG(blocks);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Runtime validation with Zod
    const validationResult = UploadRequestSchema.safeParse(req.body);

    if (!validationResult.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: validationResult.error.format(),
      });
    }

    const { cards, author } = validationResult.data;

    // Sanitize author field to prevent XSS
    const sanitizedAuthor = author
      ? DOMPurify.sanitize(author.trim()).slice(0, 50)
      : undefined;

    // Create Web3.Storage client with delegation-based auth
    const agentKey = process.env.WEB3_STORAGE_AGENT_KEY;
    const delegationProof = process.env.WEB3_STORAGE_DELEGATION_PROOF;

    if (!agentKey || !delegationProof) {
      throw new Error('WEB3_STORAGE_AGENT_KEY and WEB3_STORAGE_DELEGATION_PROOF must be configured');
    }

    // Parse agent principal from private key
    const principal = Signer.parse(agentKey);

    // Create client with principal
    const client = await create({ principal });

    // Parse and add delegation proof
    const proof = await parseProof(delegationProof);
    const space = await client.addSpace(proof);
    await client.setCurrentSpace(space.did());

    // Use single timestamp for consistency
    const timestamp = Date.now();

    // Build IPFS package
    const ipfsPackage: IPFSCardPackage = {
      author: sanitizedAuthor,
      timestamp,
      version: '1.0',
      cards: cards.map(card => ({
        cardNumber: card.cardNumber,
        deckType: card.deckType,
        cardName: `Card ${card.cardNumber}`,
        imageData: card.frames[0] || '',
        videoData: card.videoUrl,
        metadata: {
          generatedAt: card.timestamp,
          model: 'gemini-2.0-flash-exp',
        },
      })),
    };

    // Convert to File
    const blob = new Blob([JSON.stringify(ipfsPackage)], { type: 'application/json' });
    const file = new File([blob], 'manifest.json');

    // Upload to IPFS
    const cid = await client.uploadFile(file);

    // Create bundle metadata
    const bundle: GalleryBundle = {
      cid: cid.toString(),
      author: sanitizedAuthor,
      cardCount: cards.length,
      timestamp,
      deckTypes: [...new Set(cards.map(c => c.deckType))],
    };

    // Add to registry
    const galleries = (await kv.get<GalleryBundle[]>('galleries')) || [];
    galleries.unshift(bundle); // Add to front
    await kv.set('galleries', galleries);

    return res.status(200).json({
      success: true,
      cid: cid.toString(),
      cardCount: cards.length,
    });
  } catch (error) {
    console.error('[API] Upload failed:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Upload failed',
    });
  }
}
