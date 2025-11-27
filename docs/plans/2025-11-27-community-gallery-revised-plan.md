# Community Gallery IPFS Sharing - REVISED Implementation Plan

> **Date:** 2025-11-27
> **Status:** Approved
> **Architecture:** Delegated Client-Side Upload with Streaming Proxy

**CRITICAL CHANGE:** The original plan attempted server-side uploads, which violates Vercel's 4.5MB payload limit. This revised plan implements the **Server-Signed, Client-Executed** pattern using UCAN delegations.

---

## Architecture Overview

### Data Flow (CORRECT)

**Upload Flow:**
```
1. Client requests UCAN delegation → /api/auth/w3up → Receives proof
2. Client fetches Gemini video → /api/proxy?url=<gemini_uri> → Streams video (bypasses CORS)
3. Client uploads directly to Web3.Storage → Gets CID
4. Client registers CID → /api/register-gallery → Updates Vercel KV registry
```

**Download Flow:**
```
1. Client fetches gallery list → /api/galleries → ZSET pagination
2. Client selects bundle → /api/gallery/[cid] → Metadata + IPFS URL
3. Client downloads from IPFS → Gateway race (w3s.link, dweb.link, cloudflare-ipfs.com)
4. Client populates IndexedDB → Cards appear in deck
```

### Key Constraints

- **Vercel Payload Limit:** 4.5MB (cannot proxy video uploads through server)
- **Gemini URLs:** Expire in 48 hours (must download before IPFS upload)
- **CORS Restriction:** Gemini endpoints don't allow browser fetch (requires proxy)
- **Redis Array Anti-Pattern:** O(N) reads/writes don't scale (use ZSET)

---

## Task Breakdown (14 Tasks)

### Phase 1: Foundation (Tasks 1-2) ✅ COMPLETED

**Task 1:** Update TypeScript Types ✅
**Task 2:** Update IndexedDB Schema ✅

---

### Phase 2: Authentication & Delegation (Task 3)

## Task 3: Implement UCAN Delegation Endpoint

**Files:**
- Create: `api/auth/w3up.ts`
- Install: `@web3-storage/w3up-client`, `@ucanto/principal`, `@ucanto/core`, `@ipld/car`

**Purpose:** Vend UCAN delegations to clients, allowing them to upload directly to Web3.Storage without exposing the master token.

**Step 1: Install dependencies**

```bash
npm install @web3-storage/w3up-client @ucanto/principal @ucanto/core @ipld/car
```

**Step 2: Create delegation endpoint**

Create `api/auth/w3up.ts`:

```typescript
import type { VercelRequest, VercelResponse } from '@vercel/node';
import * as Client from '@web3-storage/w3up-client';
import * as Signer from '@ucanto/principal/ed25519';
import * as Delegation from '@ucanto/core/delegation';
import { CarReader } from '@ipld/car';

async function parseProof(data: string): Promise<Delegation.Delegation> {
  const blocks = [];
  const reader = await CarReader.fromBytes(Buffer.from(data, 'base64'));
  for await (const block of reader.blocks()) {
    blocks.push(block);
  }
  return Delegation.importDAG(blocks);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { clientDID } = req.body;

    if (!clientDID || typeof clientDID !== 'string') {
      return res.status(400).json({ error: 'clientDID required' });
    }

    // Initialize server agent
    const principal = Signer.parse(process.env.WEB3_STORAGE_AGENT_KEY!);
    const client = await Client.create({ principal });

    // Load space proof
    const proof = await parseProof(process.env.WEB3_STORAGE_DELEGATION_PROOF!);
    const space = await client.addSpace(proof);
    await client.setCurrentSpace(space.did());

    // Create scoped delegation for client (only store/add, upload/add)
    const delegation = await client.createDelegation(clientDID, {
      abilities: ['store/add', 'upload/add'],
    });

    // Serialize delegation as Base64 CAR
    const archive = await delegation.archive();
    const delegationBytes = new Uint8Array(await archive.arrayBuffer());
    const delegationBase64 = Buffer.from(delegationBytes).toString('base64');

    return res.status(200).json({
      delegation: delegationBase64,
      spaceDID: space.did(),
    });
  } catch (error) {
    console.error('[API] Delegation error:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Delegation failed',
    });
  }
}
```

**Step 3: Verify compiles**

```bash
npx tsc --noEmit
```

**Step 4: Commit**

```bash
git add api/auth/w3up.ts package.json package-lock.json
git commit -m "feat(api): add UCAN delegation endpoint for Web3.Storage"
```

---

### Phase 3: Gemini Video Proxy (Task 4)

## Task 4: Create Gemini Video Streaming Proxy

**Files:**
- Create: `api/proxy.ts`

**Purpose:** Stream Gemini videos to client (bypasses CORS, stays under 4.5MB limit)

**Step 1: Create proxy endpoint**

Create `api/proxy.ts`:

```typescript
import type { VercelRequest, VercelResponse } from '@vercel/node';

export const config = {
  maxDuration: 60, // Allow up to 60s for large video streams
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const fileUri = req.query.url as string;

    if (!fileUri || !fileUri.includes('generativelanguage.googleapis.com')) {
      return res.status(400).json({ error: 'Invalid URL' });
    }

    // Extract file ID from URI
    const fileIdMatch = fileUri.match(/files\/([\w-]+)/);
    if (!fileIdMatch) {
      return res.status(400).json({ error: 'Invalid file URI format' });
    }

    const fileId = fileIdMatch[1];
    const geminiApiKey = process.env.GEMINI_API_KEY;

    if (!geminiApiKey) {
      throw new Error('GEMINI_API_KEY not configured');
    }

    // Fetch with alt=media to get actual video data
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/files/${fileId}?key=${geminiApiKey}&alt=media`;
    const geminiResponse = await fetch(geminiUrl);

    if (!geminiResponse.ok) {
      return res.status(geminiResponse.status).json({
        error: `Gemini API error: ${geminiResponse.statusText}`,
      });
    }

    // Forward response with CORS headers
    const headers = new Headers(geminiResponse.headers);
    headers.set('Access-Control-Allow-Origin', '*');
    headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
    headers.set('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour

    // Stream response body (bypasses 4.5MB limit)
    return new Response(geminiResponse.body, {
      status: geminiResponse.status,
      headers,
    });
  } catch (error) {
    console.error('[API] Proxy error:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Proxy failed',
    });
  }
}
```

**Step 2: Test with curl**

```bash
# Replace with actual Gemini file URI
curl "http://localhost:3000/api/proxy?url=https://generativelanguage.googleapis.com/v1beta/files/test123"
```

**Step 3: Commit**

```bash
git add api/proxy.ts
git commit -m "feat(api): add Gemini video streaming proxy with CORS bypass"
```

---

### Phase 4: Gallery Registry (Tasks 5-6)

## Task 5: Refactor KV to Use ZSET Pattern

**Files:**
- Create: `api/register-gallery.ts`
- Modify: `api/galleries.ts`

**Purpose:** Replace array-based storage with Redis ZSET for O(log N) scalability

**Step 1: Create registration endpoint**

Create `api/register-gallery.ts`:

```typescript
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { kv } from '@vercel/kv';
import { z } from 'zod';
import DOMPurify from 'isomorphic-dompurify';

const RegisterRequestSchema = z.object({
  cid: z.string().min(1),
  author: z.string().max(50).optional(),
  cardCount: z.number().int().min(1).max(100),
  deckTypes: z.array(z.string()).min(1),
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const parseResult = RegisterRequestSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: 'Invalid request data',
        details: parseResult.error.format(),
      });
    }

    const { cid, author, cardCount, deckTypes } = parseResult.data;
    const timestamp = Date.now();

    // Sanitize author
    const sanitizedAuthor = author
      ? DOMPurify.sanitize(author.trim()).slice(0, 50)
      : undefined;

    // Store card metadata in HASH
    await kv.hset(`gallery:${cid}`, {
      cid,
      author: sanitizedAuthor,
      cardCount,
      deckTypes: JSON.stringify(deckTypes),
      timestamp,
    });

    // Add to timeline ZSET (sorted by timestamp)
    await kv.zadd('gallery:timeline', {
      score: timestamp,
      member: cid,
    });

    return res.status(200).json({
      success: true,
      cid,
      timestamp,
    });
  } catch (error) {
    console.error('[API] Register error:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Registration failed',
    });
  }
}
```

**Step 2: Update galleries listing to use ZSET**

Replace contents of `api/galleries.ts`:

```typescript
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { kv } from '@vercel/kv';
import { z } from 'zod';
import type { GalleryBundle } from '../src/types';

const QuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const parseResult = QuerySchema.safeParse(req.query);
    if (!parseResult.success) {
      return res.status(400).json({
        error: 'Invalid query parameters',
        details: parseResult.error.format(),
      });
    }

    const { limit, offset } = parseResult.data;

    // Get total count
    const total = await kv.zcard('gallery:timeline');

    // Fetch CIDs from ZSET (newest first)
    const cids = await kv.zrange('gallery:timeline', offset, offset + limit - 1, {
      rev: true,
    });

    // Batch fetch metadata using pipeline
    const pipeline = kv.pipeline();
    cids.forEach((cid) => pipeline.hgetall(`gallery:${cid}`));
    const results = await pipeline.exec();

    // Transform results
    const galleries: GalleryBundle[] = results
      .map((result: any) => {
        if (!result) return null;
        return {
          cid: result.cid,
          author: result.author,
          cardCount: parseInt(result.cardCount),
          deckTypes: JSON.parse(result.deckTypes),
          timestamp: parseInt(result.timestamp),
        };
      })
      .filter(Boolean) as GalleryBundle[];

    return res.status(200).json({
      galleries,
      total,
      hasMore: offset + limit < total,
    });
  } catch (error) {
    console.error('[API] Galleries fetch error:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Fetch failed',
    });
  }
}
```

**Step 3: Commit**

```bash
git add api/register-gallery.ts api/galleries.ts
git commit -m "feat(api): refactor gallery registry to use Redis ZSET pattern"
```

---

## Task 6: Update Individual Gallery Endpoint

**Files:**
- Modify: `api/gallery/[cid].ts`

**Purpose:** Fetch from HASH instead of array

**Step 1: Update to use HASH lookup**

Replace contents of `api/gallery/[cid].ts`:

```typescript
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { kv } from '@vercel/kv';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { cid } = req.query;

    if (!cid || typeof cid !== 'string') {
      return res.status(400).json({ error: 'Invalid CID' });
    }

    const bundle = await kv.hgetall(`gallery:${cid}`);

    if (!bundle || !bundle.cid) {
      return res.status(404).json({ error: 'Gallery not found' });
    }

    return res.status(200).json({
      cid: bundle.cid,
      ipfsUrl: `https://w3s.link/ipfs/${bundle.cid}`,
      metadata: {
        author: bundle.author,
        cardCount: parseInt(bundle.cardCount as string),
        deckTypes: JSON.parse(bundle.deckTypes as string),
        timestamp: parseInt(bundle.timestamp as string),
      },
    });
  } catch (error) {
    console.error('[API] Gallery fetch error:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Fetch failed',
    });
  }
}
```

**Step 2: Commit**

```bash
git add api/gallery/[cid].ts
git commit -m "refactor(api): use HASH lookup for individual gallery fetch"
```

---

### Phase 5: Client-Side Upload Logic (Task 7)

## Task 7: Implement Client-Side Upload Hook

**Files:**
- Create: `src/hooks/useGallerySharing.ts`
- Install: `@web3-storage/w3up-client` (client-side)

**Purpose:** Multi-step upload flow: delegate → proxy → upload → register

**Step 1: Create hook with full flow**

Create `src/hooks/useGallerySharing.ts`:

```typescript
import { useState } from 'react';
import { useStore } from '../store/useStore';
import { getUnsharedCards, markCardsAsShared } from '../utils/idb';
import * as Client from '@web3-storage/w3up-client';
import * as Delegation from '@ucanto/core/delegation';
import { CarReader } from '@ipld/car';
import type { GeneratedCard, GalleryBundle, IPFSCardPackage } from '../types';

export function useGallerySharing() {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string>('');
  const { settings, generatedCards, addGeneratedCard } = useStore();

  /**
   * Convert data URL to Blob
   */
  const dataURLToBlob = (dataUrl: string): Blob => {
    const [header, data] = dataUrl.split(',');
    const mimeMatch = header.match(/:(.*?);/);
    const mime = mimeMatch ? mimeMatch[1] : 'application/octet-stream';
    const binary = atob(data);
    const array = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      array[i] = binary.charCodeAt(i);
    }
    return new Blob([array], { type: mime });
  };

  /**
   * Convert image to WebP for 90% size reduction
   */
  const convertToWebP = async (dataUrl: string): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('Canvas context failed'));
        ctx.drawImage(img, 0, 0);
        canvas.toBlob((blob) => {
          if (blob) resolve(blob);
          else reject(new Error('WebP conversion failed'));
        }, 'image/webp', 0.8);
      };
      img.onerror = reject;
      img.src = dataUrl;
    });
  };

  /**
   * Download Gemini video via proxy
   */
  const downloadVideo = async (geminiUrl: string): Promise<Blob> => {
    const response = await fetch(`/api/proxy?url=${encodeURIComponent(geminiUrl)}`);
    if (!response.ok) {
      throw new Error(`Video download failed: ${response.statusText}`);
    }
    return await response.blob();
  };

  /**
   * Upload session to IPFS
   */
  const uploadSession = async (displayName?: string): Promise<boolean> => {
    try {
      setUploading(true);
      setError(null);

      const unshared = await getUnsharedCards();
      if (unshared.length === 0) {
        setProgress('No cards to share');
        return true;
      }

      console.log(`[Gallery] Uploading ${unshared.length} cards...`);

      // Step 1: Initialize w3up client
      setProgress('Initializing...');
      const client = await Client.create();

      // Step 2: Request delegation from server
      setProgress('Requesting authorization...');
      const authResponse = await fetch('/api/auth/w3up', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientDID: client.agent.did() }),
      });

      if (!authResponse.ok) {
        throw new Error('Authorization failed');
      }

      const { delegation: delegationBase64, spaceDID } = await authResponse.json();

      // Step 3: Parse and activate delegation
      const delegationBytes = Uint8Array.from(atob(delegationBase64), (c) => c.charCodeAt(0));
      const reader = await CarReader.fromBytes(delegationBytes);
      const blocks = [];
      for await (const block of reader.blocks()) {
        blocks.push(block);
      }
      const delegation = Delegation.importDAG(blocks);
      const space = await client.addSpace(delegation);
      await client.setCurrentSpace(space.did());

      // Step 4: Process cards (download videos, convert images)
      setProgress('Processing media...');
      const files: File[] = [];

      for (let i = 0; i < unshared.length; i++) {
        const card = unshared[i];
        setProgress(`Processing card ${i + 1}/${unshared.length}...`);

        // Convert image to WebP
        const imageBlob = await convertToWebP(card.frames[0]);
        files.push(new File([imageBlob], `image-${card.cardNumber}-${card.deckType}.webp`, {
          type: 'image/webp',
        }));

        // Download video if exists
        if (card.videoUrl) {
          try {
            const videoBlob = await downloadVideo(card.videoUrl);
            files.push(new File([videoBlob], `video-${card.cardNumber}-${card.deckType}.mp4`, {
              type: 'video/mp4',
            }));
          } catch (err) {
            console.warn(`[Gallery] Video download failed for card ${card.cardNumber}:`, err);
            // Continue without video (degraded mode)
          }
        }
      }

      // Step 5: Create manifest
      const manifest: IPFSCardPackage = {
        author: displayName,
        timestamp: Date.now(),
        version: '1.0',
        cards: unshared.map((card) => ({
          cardNumber: card.cardNumber,
          deckType: card.deckType,
          cardName: `Card ${card.cardNumber}`,
          imageData: `image-${card.cardNumber}-${card.deckType}.webp`,
          videoData: card.videoUrl ? `video-${card.cardNumber}-${card.deckType}.mp4` : undefined,
          metadata: {
            generatedAt: card.timestamp,
            model: 'gemini-2.0-flash-exp',
          },
        })),
      };

      files.push(new File([JSON.stringify(manifest)], 'manifest.json', {
        type: 'application/json',
      }));

      // Step 6: Upload to IPFS
      setProgress('Uploading to IPFS...');
      const cid = await client.uploadDirectory(files);

      console.log(`[Gallery] Uploaded to IPFS: ${cid}`);

      // Step 7: Register in KV
      setProgress('Registering...');
      const registerResponse = await fetch('/api/register-gallery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cid: cid.toString(),
          author: displayName,
          cardCount: unshared.length,
          deckTypes: [...new Set(unshared.map((c) => c.deckType))],
        }),
      });

      if (!registerResponse.ok) {
        throw new Error('Registration failed');
      }

      // Step 8: Mark as shared
      await markCardsAsShared(unshared.map((c) => c.timestamp));

      setProgress('Upload complete!');
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Upload failed';
      setError(message);
      console.error('[Gallery] Upload error:', err);
      return false;
    } finally {
      setUploading(false);
    }
  };

  /**
   * Download gallery from IPFS (with gateway race)
   */
  const downloadGallery = async (cid: string): Promise<number> => {
    try {
      setError(null);

      // Get metadata
      const metaResponse = await fetch(`/api/gallery/${cid}`);
      if (!metaResponse.ok) {
        throw new Error('Gallery not found');
      }

      const { metadata } = await metaResponse.json();

      // Gateway race: try multiple IPFS gateways
      const gateways = [
        `https://w3s.link/ipfs/${cid}/manifest.json`,
        `https://dweb.link/ipfs/${cid}/manifest.json`,
        `https://cloudflare-ipfs.com/ipfs/${cid}/manifest.json`,
      ];

      let ipfsData: IPFSCardPackage | null = null;

      for (const url of gateways) {
        try {
          const response = await fetch(url);
          if (response.ok) {
            ipfsData = await response.json();
            break;
          }
        } catch (err) {
          console.warn(`[Gallery] Gateway ${url} failed:`, err);
        }
      }

      if (!ipfsData) {
        throw new Error('All IPFS gateways failed');
      }

      // Add to IndexedDB
      let loaded = 0;
      for (const card of ipfsData.cards) {
        const fullCard: GeneratedCard = {
          cardNumber: card.cardNumber,
          deckType: card.deckType,
          frames: [`https://w3s.link/ipfs/${cid}/${card.imageData}`],
          videoUrl: card.videoData ? `https://w3s.link/ipfs/${cid}/${card.videoData}` : undefined,
          timestamp: Date.now() + loaded,
          shared: true,
          source: 'community',
          bundleCID: cid,
        };

        addGeneratedCard(fullCard);
        loaded++;
      }

      console.log(`[Gallery] Loaded ${loaded} cards from ${cid}`);
      return loaded;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Download failed';
      setError(message);
      console.error('[Gallery] Download error:', err);
      return 0;
    }
  };

  return {
    uploading,
    error,
    progress,
    uploadSession,
    downloadGallery,
  };
}
```

**Step 2: Verify compiles**

```bash
npx tsc --noEmit
```

**Step 3: Commit**

```bash
git add src/hooks/useGallerySharing.ts
git commit -m "feat(hooks): implement client-side IPFS upload with delegation"
```

---

### Phase 6: UI Integration (Tasks 8-9)

## Task 8: Update Settings Component

**Files:**
- Modify: `src/components/Settings.tsx`

**Step 1: Add navigation guard**

At top of `Settings.tsx`, add:

```typescript
import { useEffect } from 'react';
import { useGallerySharing } from '../hooks/useGallerySharing';
import { getUnsharedCards } from '../utils/idb';

// Inside Settings() function:
const { uploadSession, uploading: isUploading, progress } = useGallerySharing();
const [unsharedCount, setUnsharedCount] = useState(0);

// Update unshared count
useEffect(() => {
  getUnsharedCards().then(cards => setUnsharedCount(cards.length));
}, [generatedCards]);

// Guard against closing tab during upload
useEffect(() => {
  const handleBeforeUnload = (e: BeforeUnloadEvent) => {
    if (isUploading) {
      e.preventDefault();
      e.returnValue = 'Upload in progress. Are you sure you want to leave?';
    }
  };
  window.addEventListener('beforeunload', handleBeforeUnload);
  return () => window.removeEventListener('beforeunload', handleBeforeUnload);
}, [isUploading]);
```

**Step 2: Add Community Sharing section**

After "Image Generation" section, add:

```typescript
{/* Community Sharing */}
<section style={{ marginBottom: '2rem' }}>
  <h3 style={{ fontSize: '1.2rem', marginBottom: '1rem', color: '#ffd1d1' }}>
    🌐 Community Sharing
  </h3>

  <div style={{ marginBottom: '1.5rem' }}>
    <label style={{
      display: 'flex',
      alignItems: 'center',
      gap: '0.5rem',
      cursor: 'pointer',
      padding: '1rem',
      background: 'rgba(255, 255, 255, 0.05)',
      borderRadius: '8px',
      border: '1px solid rgba(255, 255, 255, 0.1)',
    }}>
      <input
        type="checkbox"
        checked={settings.autoShareEnabled ?? false}
        onChange={(e) => updateSettings({ autoShareEnabled: e.target.checked })}
        disabled={isUploading}
        style={{ width: '1.2rem', height: '1.2rem' }}
      />
      <span style={{ fontSize: '0.95rem' }}>
        Auto-share generated cards to community gallery
      </span>
    </label>

    <p style={{ fontSize: '0.85rem', marginTop: '0.5rem', opacity: 0.7, lineHeight: '1.5' }}>
      Cards are uploaded to IPFS when you close Settings. Shared publicly and permanently.
    </p>
  </div>

  <div style={{ marginBottom: '1rem' }}>
    <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>
      Display Name (optional)
    </label>
    <input
      type="text"
      value={settings.displayName || ''}
      onChange={(e) => updateSettings({ displayName: e.target.value })}
      placeholder="Anonymous"
      maxLength={50}
      disabled={isUploading}
      style={{
        width: '100%',
        padding: '0.75rem',
        background: 'rgba(255, 255, 255, 0.1)',
        border: '1px solid rgba(255, 255, 255, 0.2)',
        borderRadius: '6px',
        color: '#e8e8e8',
        fontSize: '0.95rem',
      }}
    />
  </div>

  {settings.autoShareEnabled && (
    <div style={{
      padding: '0.75rem 1rem',
      background: isUploading
        ? 'rgba(147, 51, 234, 0.2)'
        : 'rgba(147, 51, 234, 0.1)',
      border: '1px solid rgba(147, 51, 234, 0.3)',
      borderRadius: '6px',
      fontSize: '0.85rem',
      color: '#e8e8e8',
    }}>
      {isUploading ? (
        <div>
          <div>⏳ {progress}</div>
          <div style={{ marginTop: '0.5rem', opacity: 0.7, fontSize: '0.75rem' }}>
            Do not close this tab
          </div>
        </div>
      ) : unsharedCount > 0 ? (
        <span>✓ {unsharedCount} card{unsharedCount !== 1 ? 's' : ''} ready to share</span>
      ) : (
        <span>All cards synced</span>
      )}
    </div>
  )}
</section>
```

**Step 3: Add upload on close handler**

Modify close button:

```typescript
const handleSettingsClose = async () => {
  // Upload unshared cards if enabled
  if (settings.autoShareEnabled && unsharedCount > 0 && !isUploading) {
    const success = await uploadSession(settings.displayName);
    if (success) {
      updateSettings({ lastSharedTimestamp: Date.now() });
    }
  }
  onClose();
};
```

**Step 4: Commit**

```bash
git add src/components/Settings.tsx
git commit -m "feat(settings): add Community Sharing UI with upload guard"
```

---

## Task 9: Create Community Gallery Component

**Files:**
- Create: `src/components/CommunityGallery.tsx`

**Step 1: Create component with gateway race**

Create `src/components/CommunityGallery.tsx`:

```typescript
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useGallerySharing } from '../hooks/useGallerySharing';
import type { GalleryBundle } from '../types';

export default function CommunityGallery() {
  const [galleries, setGalleries] = useState<GalleryBundle[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingCID, setLoadingCID] = useState<string | null>(null);
  const { downloadGallery, error } = useGallerySharing();

  useEffect(() => {
    fetchGalleries();
  }, []);

  const fetchGalleries = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/galleries?limit=50&offset=0');
      const data = await response.json();
      setGalleries(data.galleries || []);
    } catch (err) {
      console.error('[CommunityGallery] Fetch failed:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleLoadGallery = async (cid: string) => {
    setLoadingCID(cid);
    const count = await downloadGallery(cid);
    setLoadingCID(null);

    if (count > 0) {
      alert(`Successfully loaded ${count} cards from the community!`);
    }
  };

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#e8e8e8',
      }}>
        <div>Loading community galleries...</div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      padding: '2rem',
      background: 'linear-gradient(to bottom, #1a0b2e, #2d1b4e)',
    }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        <h1 style={{
          fontSize: '2.5rem',
          marginBottom: '1rem',
          color: '#ffd1d1',
          textAlign: 'center',
        }}>
          🌐 Community Gallery
        </h1>

        <p style={{
          textAlign: 'center',
          marginBottom: '2rem',
          color: '#e8e8e8',
          opacity: 0.8,
        }}>
          Browse and load tarot card collections shared by the community
        </p>

        {error && (
          <div style={{
            padding: '1rem',
            marginBottom: '1rem',
            background: 'rgba(255, 0, 0, 0.1)',
            border: '1px solid rgba(255, 0, 0, 0.3)',
            borderRadius: '8px',
            color: '#ff6b6b',
          }}>
            Error: {error}
          </div>
        )}

        {galleries.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '3rem',
            color: '#e8e8e8',
            opacity: 0.6,
          }}>
            No community galleries yet. Be the first to share!
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
            gap: '1.5rem',
          }}>
            {galleries.map((bundle) => (
              <motion.div
                key={bundle.cid}
                whileHover={{ scale: 1.02 }}
                style={{
                  padding: '1.5rem',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '12px',
                  cursor: 'pointer',
                }}
              >
                <div style={{ marginBottom: '1rem' }}>
                  <div style={{
                    fontSize: '1.2rem',
                    color: '#ffd1d1',
                    marginBottom: '0.5rem',
                  }}>
                    {bundle.author || 'Anonymous'}
                  </div>
                  <div style={{
                    fontSize: '0.85rem',
                    color: '#e8e8e8',
                    opacity: 0.7,
                  }}>
                    {bundle.cardCount} card{bundle.cardCount !== 1 ? 's' : ''}
                    {' • '}
                    {new Date(bundle.timestamp).toLocaleDateString()}
                  </div>
                </div>

                <div style={{ marginBottom: '1rem' }}>
                  <div style={{
                    fontSize: '0.8rem',
                    color: '#e8e8e8',
                    opacity: 0.6,
                    marginBottom: '0.25rem',
                  }}>
                    Decks:
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                    {bundle.deckTypes.map(deck => (
                      <span
                        key={deck}
                        style={{
                          padding: '0.25rem 0.5rem',
                          background: 'rgba(147, 51, 234, 0.2)',
                          borderRadius: '4px',
                          fontSize: '0.75rem',
                          color: '#e8e8e8',
                        }}
                      >
                        {deck}
                      </span>
                    ))}
                  </div>
                </div>

                <button
                  onClick={() => handleLoadGallery(bundle.cid)}
                  disabled={loadingCID === bundle.cid}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    background: loadingCID === bundle.cid
                      ? 'rgba(147, 51, 234, 0.3)'
                      : 'rgba(147, 51, 234, 0.5)',
                    border: '1px solid rgba(147, 51, 234, 0.7)',
                    borderRadius: '6px',
                    color: '#e8e8e8',
                    fontSize: '0.9rem',
                    cursor: loadingCID === bundle.cid ? 'wait' : 'pointer',
                  }}
                >
                  {loadingCID === bundle.cid ? '⏳ Loading...' : '📥 Load Gallery'}
                </button>

                <div style={{
                  marginTop: '0.5rem',
                  fontSize: '0.7rem',
                  color: '#e8e8e8',
                  opacity: 0.5,
                  fontFamily: 'monospace',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}>
                  {bundle.cid}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/CommunityGallery.tsx
git commit -m "feat(components): add Community Gallery with IPFS gateway race"
```

---

## Task 10: Update App Routing

**Files:**
- Modify: `src/App.tsx`

**Step 1: Add Community tab navigation**

In `src/App.tsx`, add:

```typescript
import CommunityGallery from './components/CommunityGallery';

// Add state
const [currentView, setCurrentView] = useState<'deck' | 'community'>('deck');

// Add navigation
<div style={{
  position: 'fixed',
  top: '1rem',
  left: '50%',
  transform: 'translateX(-50%)',
  zIndex: 100,
  display: 'flex',
  gap: '0.5rem',
  background: 'rgba(0, 0, 0, 0.5)',
  padding: '0.5rem',
  borderRadius: '12px',
  backdropFilter: 'blur(10px)',
}}>
  <button onClick={() => setCurrentView('deck')} style={{...}}>
    🎴 Card Deck
  </button>
  <button onClick={() => setCurrentView('community')} style={{...}}>
    🌐 Community
  </button>
</div>

// Conditional rendering
{currentView === 'deck' && <CardDeck />}
{currentView === 'community' && <CommunityGallery />}
```

**Step 2: Commit**

```bash
git add src/App.tsx
git commit -m "feat(app): add Community Gallery navigation tab"
```

---

### Phase 7: Deployment Setup (Tasks 11-12)

## Task 11: Environment Variables Setup

**Files:**
- Create: `.env.example`
- Modify: `.gitignore`
- Modify: `README.md`

**Step 1: Create .env.example**

```bash
# Web3.Storage Delegation Credentials
# Generate using w3cli (see README.md)
WEB3_STORAGE_AGENT_KEY=your_ed25519_private_key_here
WEB3_STORAGE_DELEGATION_PROOF=your_base64_encoded_delegation_car_here

# Gemini API Key
GEMINI_API_KEY=your_gemini_api_key_here

# Vercel KV (auto-populated in production)
KV_REST_API_URL=
KV_REST_API_TOKEN=
```

**Step 2: Update .gitignore**

```bash
echo ".env" >> .gitignore
echo ".env.local" >> .gitignore
```

**Step 3: Document setup in README**

Add to `README.md`:

```markdown
## Web3.Storage Setup (Required)

This application uses Web3.Storage with UCAN delegation. Follow these steps:

### 1. Install w3cli

\`\`\`bash
npm install -g @web3-storage/w3cli
\`\`\`

### 2. Create Server Identity

\`\`\`bash
# Generate Ed25519 key pair
w3 key create > server_identity.key

# Extract DID (public ID)
w3 key did < server_identity.key
# Output: did:key:z6Mk... (save this as SERVER_DID)

# Save private key to .env
cat server_identity.key
# Copy output to .env as WEB3_STORAGE_AGENT_KEY
\`\`\`

### 3. Create and Register Space

\`\`\`bash
# Create space
w3 space create "Production Tarot Gallery"
# Output: Space DID

# Register space to activate billing
w3 space register your-email@example.com
\`\`\`

### 4. Generate Delegation Proof

\`\`\`bash
# Create delegation CAR file (replace <SERVER_DID> with actual value)
w3 delegation create <SERVER_DID> --can 'space/*' --name "Vercel Backend" --output delegation.car

# Base64 encode for environment variable
cat delegation.car | base64
# Copy output to .env as WEB3_STORAGE_DELEGATION_PROOF
\`\`\`

### 5. Set Environment Variables

Create `.env`:

\`\`\`bash
WEB3_STORAGE_AGENT_KEY=Ed25519PrivateKey:base58:...
WEB3_STORAGE_DELEGATION_PROOF=AAAAA...base64...
GEMINI_API_KEY=AI...
\`\`\`

### 6. Deploy to Vercel

In Vercel dashboard:
1. Add environment variables from `.env`
2. Enable Vercel KV
3. Deploy

## Architecture

- **Client-Side Upload:** Videos don't go through server (bypasses 4.5MB limit)
- **UCAN Delegation:** Server vends temporary upload permissions to clients
- **Streaming Proxy:** Gemini videos streamed through `/api/proxy` (CORS bypass)
- **Redis ZSET:** Gallery registry uses sorted sets for O(log N) scalability
```

**Step 4: Commit**

```bash
git add .env.example .gitignore README.md
git commit -m "docs: add Web3.Storage delegation setup instructions"
```

---

## Task 12: Vercel Configuration

**Files:**
- Create: `vercel.json`

**Step 1: Create vercel.json**

```json
{
  "functions": {
    "api/proxy.ts": {
      "maxDuration": 60
    },
    "api/auth/w3up.ts": {
      "maxDuration": 10
    }
  },
  "rewrites": [
    {
      "source": "/api/(.*)",
      "destination": "/api/$1"
    }
  ]
}
```

**Step 2: Commit**

```bash
git add vercel.json
git commit -m "build: add Vercel function configuration with timeout overrides"
```

---

## Task 13: Delete Old Upload-Gallery Endpoint

**Files:**
- Delete: `api/upload-gallery.ts`

**Purpose:** Remove the incorrect server-side upload implementation

```bash
git rm api/upload-gallery.ts
git commit -m "refactor: remove server-side upload endpoint (replaced by client delegation)"
```

---

## Task 14: End-to-End Testing

**Manual Test Checklist:**

### Local Testing
- [ ] `npm install` completes without errors
- [ ] `npm run dev` starts successfully
- [ ] TypeScript compiles: `npx tsc --noEmit`
- [ ] Community Gallery tab appears
- [ ] Settings shows Community Sharing section

### Deployment Testing
- [ ] Push to GitHub
- [ ] Configure Vercel environment variables
- [ ] Enable Vercel KV
- [ ] Deploy succeeds
- [ ] Visit `/api/galleries` → returns empty array
- [ ] Generate test card
- [ ] Enable auto-share in Settings
- [ ] Close Settings → upload triggers
- [ ] Check browser console for IPFS CID
- [ ] Visit Community Gallery → bundle appears
- [ ] Load gallery → cards populate
- [ ] Verify community cards in deck (with 🌐 badge)
- [ ] Visit `https://w3s.link/ipfs/{CID}/manifest.json` → data loads

---

## Success Criteria

- ✅ Client can request UCAN delegation from server
- ✅ Client uploads directly to Web3.Storage (no 4.5MB limit)
- ✅ Gemini videos stream through proxy (CORS bypass)
- ✅ Gallery registry uses ZSET (scalable pagination)
- ✅ Images converted to WebP (90% size reduction)
- ✅ IPFS gateway race (high availability)
- ✅ Navigation guard prevents tab close during upload
- ✅ Community cards load from IPFS
- ✅ All TypeScript compiles
- ✅ Deployment succeeds

---

## Architectural Differences from Original Plan

| Aspect | Original Plan | Revised Plan |
|--------|---------------|--------------|
| Upload Flow | Server uploads to IPFS | Client uploads (delegation) |
| Video Handling | Server downloads from Gemini | Proxy stream (no buffering) |
| Payload Limit | Blocked at 4.5MB | Bypassed entirely |
| KV Storage | Array (O(N)) | ZSET + HASH (O(log N)) |
| Image Format | PNG (2-3MB) | WebP (200KB) |
| IPFS Gateway | Single (w3s.link) | Race (3 gateways) |
| Auth Model | Bearer token | UCAN delegation chain |

---

## Future Enhancements

- Background Fetch API for offline uploads
- Service Worker for upload resilience
- TanStack Query for optimistic updates
- Pagination for >1000 bundles
- Search/filter by deck type
- Bundle preview before loading
- Download stats tracking
