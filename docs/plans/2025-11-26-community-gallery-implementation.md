# Community Gallery IPFS Sharing - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enable seamless community sharing of generated tarot cards via IPFS with zero-friction upload and browsing.

**Architecture:** Delegated IPFS uploads through Vercel serverless functions, centralized discovery via Vercel KV, client-side streaming downloads to IndexedDB.

**Tech Stack:** Web3.Storage SDK, Vercel KV, React hooks, IndexedDB

---

## Task 1: Update TypeScript Types

**Files:**
- Modify: `src/types/index.ts:68-75`

**Step 1: Add new fields to GeneratedCard interface**

In `src/types/index.ts`, update the `GeneratedCard` interface:

```typescript
export interface GeneratedCard {
  cardNumber: number;
  deckType: string;
  frames: string[]; // URLs to generated images
  gifUrl?: string;
  videoUrl?: string;
  timestamp: number;
  shared: boolean;         // NEW: has been uploaded to IPFS
  source: 'local' | 'community';  // NEW: origin of card
  bundleCID?: string;      // NEW: IPFS bundle CID if from community
}
```

**Step 2: Add new Settings fields**

In same file, update `Settings` interface (~line 49):

```typescript
export interface Settings {
  userPhoto: string;
  usePhoto?: boolean;
  referenceImages?: ReferenceImage[];
  selectedDeckType: string;
  framesPerCard: number;
  generationModel: string;
  promptSuffix: string;
  promptTemplates?: PromptTemplates;
  apiProvider: 'openrouter' | 'gemini';
  apiEndpoint: string;
  apiKey?: string;
  geminiApiKey?: string;
  imageSize?: '1K' | '2K';
  showCardInfo?: boolean;
  animateCards?: boolean;
  navigateWithArrows?: boolean;
  autoShareEnabled?: boolean;     // NEW
  displayName?: string;           // NEW
  lastSharedTimestamp?: number;   // NEW
}
```

**Step 3: Add GalleryBundle interface**

At end of file, add new interfaces:

```typescript
export interface GalleryBundle {
  cid: string;
  author?: string;
  cardCount: number;
  timestamp: number;
  deckTypes: string[];
}

export interface IPFSCardPackage {
  author?: string;
  timestamp: number;
  version: string;
  cards: Array<{
    cardNumber: number;
    deckType: string;
    cardName: string;
    imageData: string;     // base64 or data URL
    videoData?: string;    // base64 or data URL
    metadata: {
      generatedAt: number;
      model: string;
    };
  }>;
}
```

**Step 4: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 5: Commit**

```bash
git add src/types/index.ts
git commit -m "feat(types): add IPFS sharing types for community gallery"
```

---

## Task 2: Update IndexedDB Schema with Migration

**Files:**
- Modify: `src/utils/idb.ts`
- Modify: `src/store/useStore.ts:54-62`

**Step 1: Update IDB schema version and add migration**

In `src/utils/idb.ts`, update the `openDB` call:

```typescript
import { openDB, DBSchema, IDBPDatabase } from 'idb';
import type { GeneratedCard } from '../types';

interface TarotDB extends DBSchema {
  generatedCards: {
    key: number;
    value: GeneratedCard;
    indexes: {
      'by-card-deck': [number, string];
      'by-source': string;  // NEW
      'by-shared': boolean; // NEW
    };
  };
}

const DB_VERSION = 2; // Increment from 1

async function getDB(): Promise<IDBPDatabase<TarotDB>> {
  return openDB<TarotDB>('tarot-cards-db', DB_VERSION, {
    upgrade(db, oldVersion, newVersion, transaction) {
      if (oldVersion < 1) {
        const store = db.createObjectStore('generatedCards', {
          keyPath: 'timestamp',
        });
        store.createIndex('by-card-deck', ['cardNumber', 'deckType']);
      }

      if (oldVersion < 2) {
        // Migration: add new indexes
        const store = transaction.objectStore('generatedCards');
        if (!store.indexNames.contains('by-source')) {
          store.createIndex('by-source', 'source');
        }
        if (!store.indexNames.contains('by-shared')) {
          store.createIndex('by-shared', 'shared');
        }

        // Migrate existing records
        const cursor = await store.openCursor();
        while (cursor) {
          const card = cursor.value;
          if (card.shared === undefined) {
            card.shared = false;
            card.source = 'local';
          }
          await cursor.update(card);
          await cursor.continue();
        }
      }
    },
  });
}
```

**Step 2: Add helper to get unshared cards**

Add new function in `src/utils/idb.ts`:

```typescript
export async function getUnsharedCards(): Promise<GeneratedCard[]> {
  try {
    const db = await getDB();
    const index = db.transaction('generatedCards').store.index('by-shared');
    return await index.getAll(false); // Get all with shared=false
  } catch (error) {
    console.warn('[IDB] getUnsharedCards failed', error);
    return [];
  }
}

export async function markCardsAsShared(timestamps: number[]): Promise<void> {
  try {
    const db = await getDB();
    const tx = db.transaction('generatedCards', 'readwrite');

    for (const timestamp of timestamps) {
      const card = await tx.store.get(timestamp);
      if (card) {
        card.shared = true;
        await tx.store.put(card);
      }
    }

    await tx.done;
  } catch (error) {
    console.error('[IDB] markCardsAsShared failed', error);
    throw error;
  }
}
```

**Step 3: Update default card creation**

In `src/store/useStore.ts`, update `addGeneratedCard`:

```typescript
addGeneratedCard: (card) =>
  set((state) => {
    // Ensure new fields have defaults
    const fullCard: GeneratedCard = {
      ...card,
      shared: card.shared ?? false,
      source: card.source ?? 'local',
    };
    const updated = [...state.generatedCards, fullCard];
    void putGeneratedCard(fullCard);
    return { generatedCards: updated };
  }),
```

**Step 4: Test migration manually**

1. Open app in browser
2. Open DevTools → Application → IndexedDB → tarot-cards-db
3. Verify `generatedCards` store has indexes: `by-source`, `by-shared`
4. Verify existing cards have `shared: false`, `source: 'local'`

**Step 5: Commit**

```bash
git add src/utils/idb.ts src/store/useStore.ts
git commit -m "feat(idb): add schema v2 with sharing fields and migration"
```

---

## Task 3: Create Serverless API - Upload Gallery

**Files:**
- Create: `api/upload-gallery.ts`
- Create: `package.json` (add Web3.Storage dependency)

**Step 1: Install Web3.Storage SDK**

Run: `npm install @web3-storage/w3up-client`

**Step 2: Create upload endpoint**

Create `api/upload-gallery.ts`:

```typescript
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
```

**Step 3: Test with curl (manual test)**

```bash
curl -X POST http://localhost:3000/api/upload-gallery \
  -H "Content-Type: application/json" \
  -d '{
    "cards": [{
      "cardNumber": 0,
      "deckType": "test",
      "frames": ["data:image/png;base64,test"],
      "timestamp": 1234567890,
      "shared": false,
      "source": "local"
    }],
    "author": "Test User"
  }'
```

Expected: `{"success": true, "cid": "bafyrei...", "cardCount": 1}`

**Step 4: Commit**

```bash
git add api/upload-gallery.ts package.json package-lock.json
git commit -m "feat(api): add upload-gallery endpoint for IPFS uploads"
```

---

## Task 4: Create Serverless API - Gallery Listing

**Files:**
- Create: `api/galleries.ts`

**Step 1: Create listing endpoint**

Create `api/galleries.ts`:

```typescript
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { kv } from '@vercel/kv';
import type { GalleryBundle } from '../src/types';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    const allGalleries = (await kv.get<GalleryBundle[]>('galleries')) || [];

    const galleries = allGalleries.slice(offset, offset + limit);
    const hasMore = offset + limit < allGalleries.length;

    return res.status(200).json({
      galleries,
      total: allGalleries.length,
      hasMore,
    });
  } catch (error) {
    console.error('[API] Galleries fetch failed:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Fetch failed',
    });
  }
}
```

**Step 2: Test with curl**

```bash
curl http://localhost:3000/api/galleries?limit=10&offset=0
```

Expected: `{"galleries": [], "total": 0, "hasMore": false}` (empty initially)

**Step 3: Commit**

```bash
git add api/galleries.ts
git commit -m "feat(api): add galleries listing endpoint"
```

---

## Task 5: Create Serverless API - Individual Gallery

**Files:**
- Create: `api/gallery/[cid].ts`

**Step 1: Create dynamic route handler**

Create `api/gallery/[cid].ts`:

```typescript
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { kv } from '@vercel/kv';
import type { GalleryBundle } from '../../src/types';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { cid } = req.query;

    if (!cid || typeof cid !== 'string') {
      return res.status(400).json({ error: 'Invalid CID' });
    }

    const galleries = (await kv.get<GalleryBundle[]>('galleries')) || [];
    const bundle = galleries.find(g => g.cid === cid);

    if (!bundle) {
      return res.status(404).json({ error: 'Gallery not found' });
    }

    // Return bundle metadata + IPFS gateway URL
    return res.status(200).json({
      cid: bundle.cid,
      ipfsUrl: `https://w3s.link/ipfs/${bundle.cid}`,
      metadata: {
        author: bundle.author,
        cardCount: bundle.cardCount,
        deckTypes: bundle.deckTypes,
        timestamp: bundle.timestamp,
      },
    });
  } catch (error) {
    console.error('[API] Gallery fetch failed:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Fetch failed',
    });
  }
}
```

**Step 2: Test with curl**

```bash
curl http://localhost:3000/api/gallery/bafytest123
```

Expected: `{"error": "Gallery not found"}` (until we upload one)

**Step 3: Commit**

```bash
git add api/gallery/[cid].ts
git commit -m "feat(api): add individual gallery fetch endpoint"
```

---

## Task 6: Create Gallery Sharing Hook

**Files:**
- Create: `src/hooks/useGallerySharing.ts`

**Step 1: Create hook skeleton**

Create `src/hooks/useGallerySharing.ts`:

```typescript
import { useState } from 'react';
import { useStore } from '../store/useStore';
import { getUnsharedCards, markCardsAsShared } from '../utils/idb';
import type { GeneratedCard, GalleryBundle, IPFSCardPackage } from '../types';

export function useGallerySharing() {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { settings, generatedCards, addGeneratedCard } = useStore();

  const uploadSession = async (displayName?: string): Promise<boolean> => {
    try {
      setUploading(true);
      setError(null);

      const unshared = await getUnsharedCards();
      if (unshared.length === 0) {
        return true; // Nothing to upload
      }

      console.log(`[Gallery] Uploading ${unshared.length} cards...`);

      // Upload to API
      const response = await fetch('/api/upload-gallery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cards: unshared,
          author: displayName,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Upload failed');
      }

      const result = await response.json();
      console.log(`[Gallery] Uploaded as CID: ${result.cid}`);

      // Mark as shared
      await markCardsAsShared(unshared.map(c => c.timestamp));

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

  const downloadGallery = async (cid: string): Promise<number> => {
    try {
      setError(null);

      // Get metadata
      const metaResponse = await fetch(`/api/gallery/${cid}`);
      if (!metaResponse.ok) {
        throw new Error('Gallery not found');
      }

      const { ipfsUrl } = await metaResponse.json();

      // Fetch from IPFS
      const ipfsResponse = await fetch(ipfsUrl);
      if (!ipfsResponse.ok) {
        throw new Error('IPFS fetch failed');
      }

      const ipfsData: IPFSCardPackage = await ipfsResponse.json();

      // Add to IndexedDB
      let loaded = 0;
      for (const card of ipfsData.cards) {
        const fullCard: GeneratedCard = {
          cardNumber: card.cardNumber,
          deckType: card.deckType,
          frames: [card.imageData],
          videoUrl: card.videoData,
          timestamp: Date.now() + loaded, // Unique timestamp
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
    uploadSession,
    downloadGallery,
  };
}
```

**Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/hooks/useGallerySharing.ts
git commit -m "feat(hooks): add useGallerySharing for upload/download"
```

---

## Task 7: Update Settings Component

**Files:**
- Modify: `src/components/Settings.tsx`

**Step 1: Add imports**

At top of `src/components/Settings.tsx`:

```typescript
import { useGallerySharing } from '../hooks/useGallerySharing';
```

**Step 2: Add state and hook**

Inside `Settings()` function, after existing hooks:

```typescript
const { uploadSession, uploading: isUploading } = useGallerySharing();
const [unsharedCount, setUnsharedCount] = useState(0);

// Update unshared count
useEffect(() => {
  import('../utils/idb').then(({ getUnsharedCards }) => {
    getUnsharedCards().then(cards => setUnsharedCount(cards.length));
  });
}, [generatedCards]);
```

**Step 3: Add upload on close handler**

Modify the `handleClose` or create new close handler:

```typescript
const handleSettingsClose = async () => {
  // Upload unshared cards if enabled
  if (settings.autoShareEnabled && unsharedCount > 0) {
    console.log('[Settings] Auto-uploading on close...');
    await uploadSession(settings.displayName);
  }
  setShowSettings(false);
};
```

Update the close button onClick:

```typescript
<button
  onClick={handleSettingsClose}
  style={{...}}
>
```

**Step 4: Add Community Sharing UI section**

After the "Image Generation" section (~line 1070), add:

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
        style={{ width: '1.2rem', height: '1.2rem' }}
      />
      <span style={{ fontSize: '0.95rem' }}>
        Auto-share generated cards to community gallery
      </span>
    </label>

    <p style={{ fontSize: '0.85rem', marginTop: '0.5rem', opacity: 0.7, lineHeight: '1.5' }}>
      When enabled, your generated cards are automatically uploaded to IPFS when you close Settings.
      Cards are shared publicly and permanently.
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
      background: 'rgba(147, 51, 234, 0.1)',
      border: '1px solid rgba(147, 51, 234, 0.3)',
      borderRadius: '6px',
      fontSize: '0.85rem',
      color: '#e8e8e8',
    }}>
      {unsharedCount > 0 ? (
        <span>✓ {unsharedCount} card{unsharedCount !== 1 ? 's' : ''} ready to share</span>
      ) : (
        <span>All cards synced</span>
      )}
      {settings.lastSharedTimestamp && (
        <div style={{ marginTop: '0.25rem', opacity: 0.7 }}>
          Last shared: {new Date(settings.lastSharedTimestamp).toLocaleString()}
        </div>
      )}
    </div>
  )}
</section>
```

**Step 5: Update last shared timestamp after upload**

In `handleSettingsClose`, update:

```typescript
const handleSettingsClose = async () => {
  if (settings.autoShareEnabled && unsharedCount > 0) {
    const success = await uploadSession(settings.displayName);
    if (success) {
      updateSettings({ lastSharedTimestamp: Date.now() });
    }
  }
  setShowSettings(false);
};
```

**Step 6: Test in browser**

1. Open Settings
2. Verify "Community Sharing" section appears
3. Toggle auto-share, verify state persists
4. Enter display name, verify it saves
5. Close Settings with unshared cards, verify upload happens

**Step 7: Commit**

```bash
git add src/components/Settings.tsx
git commit -m "feat(settings): add Community Sharing section with auto-upload"
```

---

## Task 8: Create Community Gallery Component

**Files:**
- Create: `src/components/CommunityGallery.tsx`

**Step 1: Create component**

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
      alert(`Successfully loaded ${count} cards!`);
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

**Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/components/CommunityGallery.tsx
git commit -m "feat(components): add CommunityGallery browser component"
```

---

## Task 9: Update App Routing

**Files:**
- Modify: `src/App.tsx`

**Step 1: Add imports**

At top of `src/App.tsx`:

```typescript
import CommunityGallery from './components/CommunityGallery';
```

**Step 2: Add view state**

Inside `App()` function:

```typescript
const [currentView, setCurrentView] = useState<'deck' | 'community' | 'settings'>('deck');
```

**Step 3: Add navigation tabs**

Replace or modify existing navigation to include Community tab:

```typescript
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
  <button
    onClick={() => setCurrentView('deck')}
    style={{
      padding: '0.75rem 1.5rem',
      background: currentView === 'deck' ? 'rgba(147, 51, 234, 0.5)' : 'transparent',
      border: currentView === 'deck' ? '1px solid rgba(147, 51, 234, 0.7)' : '1px solid rgba(255, 255, 255, 0.1)',
      borderRadius: '8px',
      color: '#e8e8e8',
      cursor: 'pointer',
    }}
  >
    🎴 Card Deck
  </button>

  <button
    onClick={() => setCurrentView('community')}
    style={{
      padding: '0.75rem 1.5rem',
      background: currentView === 'community' ? 'rgba(147, 51, 234, 0.5)' : 'transparent',
      border: currentView === 'community' ? '1px solid rgba(147, 51, 234, 0.7)' : '1px solid rgba(255, 255, 255, 0.1)',
      borderRadius: '8px',
      color: '#e8e8e8',
      cursor: 'pointer',
    }}
  >
    🌐 Community
  </button>

  <button
    onClick={() => setCurrentView('settings')}
    style={{
      padding: '0.75rem 1.5rem',
      background: currentView === 'settings' ? 'rgba(147, 51, 234, 0.5)' : 'transparent',
      border: currentView === 'settings' ? '1px solid rgba(147, 51, 234, 0.7)' : '1px solid rgba(255, 255, 255, 0.1)',
      borderRadius: '8px',
      color: '#e8e8e8',
      cursor: 'pointer',
    }}
  >
    ⚙️ Settings
  </button>
</div>
```

**Step 4: Add conditional rendering**

In the main render return:

```typescript
return (
  <>
    {/* Navigation tabs from Step 3 */}

    {currentView === 'deck' && (
      <>
        <CardDeck />
        {selectedCard && <CardDetail />}
      </>
    )}

    {currentView === 'community' && <CommunityGallery />}

    {currentView === 'settings' && <Settings />}
  </>
);
```

**Step 5: Test navigation**

1. Run app: `npm run dev`
2. Click each tab, verify views switch
3. Verify Settings opens/closes correctly
4. Verify Community Gallery loads

**Step 6: Commit**

```bash
git add src/App.tsx
git commit -m "feat(app): add Community Gallery navigation tab"
```

---

## Task 10: Add Environment Variables Setup

**Files:**
- Create: `.env.example`
- Modify: `.gitignore`

**Step 1: Create environment template**

Create `.env.example`:

```bash
# Web3.Storage API Token
# Get one at: https://web3.storage
WEB3_STORAGE_TOKEN=your_token_here

# Vercel KV (auto-populated by Vercel)
KV_REST_API_URL=
KV_REST_API_TOKEN=
```

**Step 2: Update .gitignore**

Ensure `.env` is ignored:

```bash
echo ".env" >> .gitignore
echo ".env.local" >> .gitignore
```

**Step 3: Document setup in README**

Add to README.md (or create if doesn't exist):

```markdown
## Environment Setup

### Required Environment Variables

1. **Web3.Storage Token**
   - Sign up at https://web3.storage
   - Create an API token
   - Add to `.env`: `WEB3_STORAGE_TOKEN=your_token_here`

2. **Vercel KV**
   - Enable KV in Vercel project dashboard
   - Auto-populated in production
   - For local dev, copy from Vercel dashboard

### Local Development

```bash
cp .env.example .env
# Edit .env with your tokens
npm install
npm run dev
```
```

**Step 4: Commit**

```bash
git add .env.example .gitignore README.md
git commit -m "docs: add environment setup instructions"
```

---

## Task 11: Deploy and Test End-to-End

**Files:**
- None (deployment step)

**Step 1: Push to GitHub**

```bash
git push origin main
```

**Step 2: Configure Vercel environment**

In Vercel dashboard:
1. Go to Project → Settings → Environment Variables
2. Add `WEB3_STORAGE_TOKEN` with your token
3. Enable Vercel KV if not already enabled
4. Redeploy

**Step 3: Test upload flow**

1. Open deployed app
2. Generate a test card
3. Enable auto-share in Settings
4. Add display name
5. Close Settings
6. Check browser console for upload logs
7. Verify card marked as shared in IndexedDB

**Step 4: Test download flow**

1. Open Community Gallery tab
2. Verify bundle appears in list
3. Click "Load Gallery"
4. Verify cards load into IndexedDB
5. Switch to Card Deck, verify community cards appear

**Step 5: Verify IPFS persistence**

1. Note CID from bundle
2. Visit `https://w3s.link/ipfs/{CID}` directly
3. Verify JSON data loads
4. Check data structure matches IPFSCardPackage type

**Step 6: Document completion**

Create `docs/deployment-notes.md`:

```markdown
# Deployment Notes - Community Gallery

**Deployed:** [Date]
**URL:** [Your Vercel URL]

## Verification Checklist

- [x] Environment variables configured
- [x] Upload endpoint working
- [x] Gallery listing working
- [x] Download from IPFS working
- [x] Auto-share on Settings close working
- [x] Community cards appear in deck

## Known Issues

- None

## Next Steps

- Monitor Web3.Storage quota usage
- Add error monitoring (Sentry?)
- Consider pagination for >100 bundles
```

**Step 7: Final commit**

```bash
git add docs/deployment-notes.md
git commit -m "docs: add deployment verification notes"
git push origin main
```

---

## Success Criteria

- ✅ Users can toggle auto-share in Settings
- ✅ Cards upload to IPFS on Settings close
- ✅ Community Gallery shows uploaded bundles
- ✅ Users can download and view community cards
- ✅ Cards persist in IndexedDB across sessions
- ✅ No TypeScript errors
- ✅ All features work in production

## Future Enhancements

- Add search/filter for galleries
- Show upload progress bar
- Add "share this card" individual action
- Implement pagination for large galleries
- Add bundle preview before loading
- Track download stats per bundle
