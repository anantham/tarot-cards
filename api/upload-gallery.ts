import type { VercelRequest, VercelResponse } from '@vercel/node';
import { create } from '@web3-storage/w3up-client';
import { kv } from '@vercel/kv';
import type { GeneratedCard, GalleryBundle, IPFSCardPackage } from '../src/types';

interface UploadRequest {
  cards: GeneratedCard[];
  author?: string;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { cards, author }: UploadRequest = req.body;

    // Validate
    if (!cards || !Array.isArray(cards) || cards.length === 0) {
      return res.status(400).json({ error: 'Invalid cards data' });
    }

    if (cards.length > 100) {
      return res.status(400).json({ error: 'Maximum 100 cards per bundle' });
    }

    // Create Web3.Storage client
    const client = await create();
    const token = process.env.WEB3_STORAGE_TOKEN;
    if (!token) {
      throw new Error('WEB3_STORAGE_TOKEN not configured');
    }

    // Authorize client (simplified - actual implementation needs proper auth flow)
    // For now, assume token is a space DID
    await client.login(token);

    // Build IPFS package
    const ipfsPackage: IPFSCardPackage = {
      author: author || undefined,
      timestamp: Date.now(),
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
      author,
      cardCount: cards.length,
      timestamp: Date.now(),
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
