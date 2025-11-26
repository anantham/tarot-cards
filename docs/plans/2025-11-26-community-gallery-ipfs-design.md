# Community Gallery with IPFS Sharing - Design Document

**Date:** 2025-11-26
**Status:** Approved
**Author:** Claude + Aditya

## Overview

Add seamless community sharing of generated tarot cards using IPFS (Web3.Storage) and Vercel KV registry. Users can auto-share their generated cards with the community and browse/download cards from others, all without manual GitHub interaction.

## Goals

- **Seamless Sharing:** Auto-upload generated cards when user closes Settings (if enabled)
- **Public Gallery:** Browse and load community-contributed card bundles
- **Zero Friction:** No GitHub PRs, issues, or git knowledge required
- **Decentralized Storage:** IPFS for immutable, permanent hosting
- **Easy Discovery:** Centralized registry (Vercel KV) for fast browsing

## Non-Goals

- User authentication/accounts
- Card moderation/curation
- Real-time sync
- Deletion from IPFS once uploaded

## Architecture

### Data Flow

#### Upload Flow (Settings Close)
1. User generates cards in session (tracked as `shared: false`)
2. User closes Settings panel (trigger point)
3. If `autoShareEnabled` and unshared cards exist:
   - Download videos from Gemini URLs → blobs (before they expire)
   - Package cards + images + videos into IPFS structure
   - Upload to Web3.Storage via delegated API endpoint
   - Get CID back
   - Register CID in Vercel KV
   - Mark cards as `shared: true` in IndexedDB
4. Show subtle toast notification (non-blocking)

#### Download Flow (Community Gallery)
1. User clicks "Community Gallery" tab
2. Fetch `/api/galleries` → list of bundle metadata
3. Display paginated list with author, card count, timestamp
4. User clicks bundle → fetch `/api/gallery/{cid}`
5. Stream download from IPFS
6. Populate IndexedDB with `source: 'community'`
7. Cards appear in main deck with 🌐 badge

### Components

#### New Files
- `src/components/CommunityGallery.tsx` - Gallery browser UI
- `src/hooks/useGallerySharing.ts` - Upload/download logic
- `api/upload-gallery.ts` - Serverless upload endpoint
- `api/galleries.ts` - Registry list endpoint
- `api/gallery/[cid].ts` - Individual bundle endpoint

#### Modified Files
- `src/types/index.ts` - Add `shared`, `source`, `bundleCID` fields
- `src/store/useStore.ts` - Add `autoShareEnabled`, `displayName` settings
- `src/components/Settings.tsx` - Add Community Sharing section
- `src/utils/idb.ts` - Schema migration for new fields

### Data Structures

#### IndexedDB Schema (Updated)
```typescript
interface GeneratedCard {
  cardNumber: number;
  deckType: string;
  frames: string[];        // data URLs or IPFS URLs
  videoUrl?: string;       // Gemini URL or IPFS URL
  timestamp: number;
  shared: boolean;         // NEW: uploaded to IPFS?
  source: 'local' | 'community';  // NEW: origin
  bundleCID?: string;      // NEW: IPFS bundle CID
}
```

#### IPFS Package Structure
```json
{
  "author": "Alice" | null,
  "timestamp": 1732534800000,
  "version": "1.0",
  "cards": [
    {
      "cardNumber": 0,
      "deckType": "lordOfMysteries",
      "cardName": "The Fool",
      "image": "/images/card-0.png",
      "video": "/videos/card-0.mp4",
      "metadata": {
        "generatedAt": 1732534800000,
        "model": "gemini-2.0-flash-exp"
      }
    }
  ],
  "images/": { /* IPFS directory with PNGs */ },
  "videos/": { /* IPFS directory with MP4s */ }
}
```

#### Vercel KV Registry
```typescript
interface GalleryBundle {
  cid: string;             // IPFS content identifier
  author?: string;         // optional display name
  cardCount: number;       // total cards in bundle
  timestamp: number;       // upload time
  deckTypes: string[];     // ["lordOfMysteries", "egyptian"]
}

// Storage:
// Key: "galleries" → Value: GalleryBundle[]
// Sorted by timestamp descending
```

#### Settings Schema (Updated)
```typescript
interface Settings {
  // ... existing fields
  autoShareEnabled: boolean;     // NEW: auto-upload toggle
  displayName?: string;          // NEW: optional author name
  lastSharedTimestamp?: number;  // NEW: tracking
}
```

### API Endpoints

#### POST /api/upload-gallery
**Purpose:** Upload user's card bundle to IPFS and register in KV

**Request:**
```typescript
{
  cards: GeneratedCard[],
  author?: string
}
```

**Process:**
1. Validate request (max 100 cards per bundle)
2. For each card with Gemini video URL:
   - Fetch video → blob
   - Store in memory
3. Create IPFS package structure
4. Upload to Web3.Storage (using server-side token)
5. Get CID
6. Add to Vercel KV `galleries` array
7. Return CID

**Response:**
```typescript
{
  success: true,
  cid: "bafybeiabc123...",
  cardCount: 22
}
```

#### GET /api/galleries
**Purpose:** List available community bundles

**Query Params:**
- `limit` (default: 50)
- `offset` (default: 0)

**Response:**
```typescript
{
  galleries: GalleryBundle[],
  total: number,
  hasMore: boolean
}
```

#### GET /api/gallery/[cid]
**Purpose:** Get specific bundle metadata and IPFS URL

**Response:**
```typescript
{
  cid: string,
  ipfsUrl: string,  // https://w3s.link/ipfs/{cid}
  metadata: {
    author?: string,
    cardCount: number,
    deckTypes: string[],
    timestamp: number
  }
}
```

### UI Changes

#### Settings Panel - New Section
```
┌─ Community Sharing ─────────────────────┐
│ 🌐 Auto-Share Generated Cards           │
│    [Toggle ON/OFF]                       │
│                                          │
│ When enabled, your generated cards are  │
│ automatically uploaded to IPFS when you │
│ close Settings and added to the shared  │
│ community gallery.                       │
│                                          │
│ Display Name (optional):                 │
│ [____________]                           │
│                                          │
│ Status: ✓ 5 cards ready to share        │
│         📦 Last shared: 2 hours ago      │
└──────────────────────────────────────────┘
```

#### New Top-Level Tab: "Community Gallery"
- Replaces or sits alongside existing navigation
- Shows paginated list of bundles
- Each entry: Author, card count, deck types, relative timestamp
- "Load Gallery" button → downloads to IndexedDB
- Progress indicator during download

#### Card Deck View - Community Cards
- Cards from community have 🌐 badge
- Hovering shows: "From {author}'s gallery"
- Functionally identical to local cards

## Technical Implementation Details

### Upload Process

**Trigger Point:** Settings panel close handler
```typescript
const handleSettingsClose = async () => {
  if (settings.autoShareEnabled) {
    const unsharedCards = generatedCards.filter(c => !c.shared && c.source === 'local');
    if (unsharedCards.length > 0) {
      // Non-blocking background upload
      uploadSession(unsharedCards, settings.displayName)
        .catch(err => console.warn('Upload failed:', err));
    }
  }
  setShowSettings(false);
};
```

**Video Handling:**
```typescript
async function downloadVideoBlob(geminiUrl: string): Promise<Blob> {
  const response = await fetch(geminiUrl);
  if (!response.ok) throw new Error('Video download failed');
  return await response.blob();
}
```

**IPFS Package Creation:**
```typescript
async function createIPFSPackage(cards: GeneratedCard[], author?: string) {
  const files = [];

  for (const card of cards) {
    // Add image
    const imageBlob = dataURLToBlob(card.frames[0]);
    files.push({
      path: `images/card-${card.cardNumber}-${card.deckType}.png`,
      content: imageBlob
    });

    // Add video if exists
    if (card.videoUrl) {
      const videoBlob = await downloadVideoBlob(card.videoUrl);
      files.push({
        path: `videos/card-${card.cardNumber}-${card.deckType}.mp4`,
        content: videoBlob
      });
    }
  }

  // Add manifest
  files.push({
    path: 'manifest.json',
    content: JSON.stringify({ author, timestamp: Date.now(), cards })
  });

  return files;
}
```

### Download Process

**Gallery Browsing:**
```typescript
function CommunityGallery() {
  const [galleries, setGalleries] = useState<GalleryBundle[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/galleries?limit=50')
      .then(r => r.json())
      .then(data => setGalleries(data.galleries))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      {galleries.map(bundle => (
        <BundleCard
          key={bundle.cid}
          bundle={bundle}
          onLoad={() => loadBundle(bundle.cid)}
        />
      ))}
    </div>
  );
}
```

**Bundle Loading:**
```typescript
async function loadBundle(cid: string) {
  // 1. Get metadata
  const meta = await fetch(`/api/gallery/${cid}`).then(r => r.json());

  // 2. Fetch from IPFS
  const ipfsData = await fetch(meta.ipfsUrl).then(r => r.json());

  // 3. Stream cards into IndexedDB
  for (const card of ipfsData.cards) {
    const fullCard: GeneratedCard = {
      ...card,
      source: 'community',
      bundleCID: cid,
      shared: true,  // Already in IPFS
      frames: [`${meta.ipfsUrl}/${card.image}`],
      videoUrl: card.video ? `${meta.ipfsUrl}/${card.video}` : undefined
    };

    await putGeneratedCard(fullCard);
  }

  // 4. Refresh UI
  refreshCardDeck();
}
```

### Error Handling

#### Upload Failures
- **Network timeout:** Retry 3x with exponential backoff (1s, 2s, 4s)
- **Web3.Storage rate limit:** Queue upload, retry after 60s
- **Partial upload:** Rollback, don't mark cards as shared
- **Video download fails:** Continue with images only (degraded mode)
- **Vercel KV write fails:** Log error, show user notification

#### Download Failures
- **IPFS gateway timeout:** Try alternate gateway (dweb.link)
- **Invalid CID:** Show error toast, skip bundle
- **Corrupted data:** Validate schema, discard invalid cards
- **Schema mismatch:** Attempt migration, fall back to skip

#### Storage Limits
- **IndexedDB quota exceeded:** Show warning modal, suggest deleting old cards
- **IPFS 5GB quota full:** Disable auto-share, show upgrade prompt
- **Vercel KV limits:** Archive old bundles, keep only recent 1000

### Security Considerations

- **No authentication:** Anyone can upload (public free-for-all)
- **Rate limiting:** Vercel API routes have built-in limits
- **Validation:** Server validates card data structure before upload
- **Size limits:** Max 100 cards per bundle, max 50MB total
- **Content policy:** No moderation (immutable once uploaded)

### Performance

**Upload:**
- Expected: ~30s for 22 cards with videos (5-10MB total)
- Non-blocking UI (happens in background)
- Progress shown via toast notification

**Download:**
- Expected: ~10s for 22-card bundle from IPFS
- Streaming download (cards appear progressively)
- Cached by IPFS gateways

**Registry:**
- Vercel KV read latency: <50ms
- Pagination prevents loading all bundles at once

## Environment Setup

### Required Environment Variables
```bash
# Vercel deployment
WEB3_STORAGE_TOKEN=eyJhbGc...  # Your Web3.Storage API token
KV_REST_API_URL=https://...     # Vercel KV endpoint
KV_REST_API_TOKEN=xxx...        # Vercel KV auth token
```

### External Services
1. **Web3.Storage Account**
   - Sign up: https://web3.storage
   - Create API token
   - Free tier: 5GB storage, unlimited uploads

2. **Vercel KV**
   - Enable in Vercel project dashboard
   - Free tier: 256MB, 30k reads/month

## Migration Plan

### Phase 1: Infrastructure Setup
1. Create Web3.Storage account, get token
2. Enable Vercel KV in project
3. Add environment variables
4. Deploy serverless functions

### Phase 2: Schema Migration
1. Add new fields to IndexedDB schema
2. Migrate existing cards: `shared: false`, `source: 'local'`
3. Add migration version tracking

### Phase 3: UI Implementation
1. Add Settings toggle + display name field
2. Implement upload on Settings close
3. Create Community Gallery tab
4. Add bundle browser + loader

### Phase 4: Testing & Refinement
1. Test upload with small bundles
2. Test download from IPFS
3. Verify error handling
4. Performance optimization

## Success Metrics

- User can share 22 cards in <60s (including video downloads)
- Community bundles load in <15s
- Zero manual GitHub interaction required
- 95% upload success rate
- IPFS gateway uptime >99%

## Future Enhancements

- Search/filter community bundles by deck type
- User reputation/favorite galleries
- Bring-your-own Web3.Storage token for power users
- IPFS pinning redundancy (multiple providers)
- Export/import functionality for local backups
