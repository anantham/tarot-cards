import { useState } from 'react';
import { useStore } from '../store/useStore';
import { getUnsharedCards, markCardsAsShared } from '../utils/idb';
import * as Client from '@web3-storage/w3up-client';
import * as Proof from '@web3-storage/w3up-client/proof';
import type { GeneratedCard, IPFSCardPackage } from '../types';

/**
 * Gallery Sharing Hook
 *
 * Provides upload and download functionality for the community gallery
 * Uses client-side IPFS upload with UCAN delegation (bypasses Vercel 4.5MB limit)
 */
export function useGallerySharing() {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string>('');
  const { addGeneratedCard, settings, updateSettings } = useStore();
  const useSupabase = true; // interim path

  const logProgress = (message: string) => {
    console.log(`[Gallery] ${message}`);
    setProgress(message);
  };

  /**
   * Convert PNG image to WebP for 90% size reduction
   * Uses browser's native Canvas API (hardware accelerated, no libraries)
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
        canvas.toBlob(
          (blob) => {
            if (blob) resolve(blob);
            else reject(new Error('WebP conversion failed'));
          },
          'image/webp',
          0.8 // 80% quality (imperceptible loss)
        );
      };
      img.onerror = reject;
      img.src = dataUrl;
    });
  };

  /**
   * Download Gemini video via streaming proxy
   * Bypasses CORS and keeps API key server-side
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
   *
   * Multi-step flow:
   * 1. Request UCAN delegation from server
   * 2. Download videos via proxy (before they expire)
   * 3. Convert images to WebP
   * 4. Upload directory to IPFS
   * 5. Register CID in Vercel KV
   * 6. Mark cards as shared in IndexedDB
   */
  const uploadSession = async (displayName?: string): Promise<boolean> => {
    try {
      setUploading(true);
      setError(null);

      const base64Bytes = (b64: string) => {
        const pad = (b64.match(/=*$/)?.[0].length ?? 0);
        return (b64.length * 3) / 4 - pad;
      };

      const dataUrlBytes = (url: string) => {
        if (!url.startsWith('data:')) return 0;
        const [, b64] = url.split(',');
        return base64Bytes(b64 || '');
      };

      const estimateCardSize = (card: typeof unshared[number]) => {
        let total = 0;
        card.frames.forEach((f) => {
          total += dataUrlBytes(f);
        });
        if (card.gifUrl?.startsWith('data:')) total += dataUrlBytes(card.gifUrl);
        if (card.videoUrl?.startsWith('data:')) total += dataUrlBytes(card.videoUrl);
        return total;
      };

      const unshared = await getUnsharedCards();
      if (unshared.length === 0) {
        setProgress('No cards to share');
        return true;
      }

      logProgress(`Uploading ${unshared.length} cards...`);

      // Supabase interim path: skip w3up
      if (useSupabase) {
        // Vercel body limit is ~4.5MB; upload in small batches to avoid 500s.
        const MAX_CARDS_PER_BATCH = 1;
        const batches: typeof unshared[] = [];
        for (let i = 0; i < unshared.length; i += MAX_CARDS_PER_BATCH) {
          batches.push(unshared.slice(i, i + MAX_CARDS_PER_BATCH));
        }

        const deckIdFromMap = settings.deckIdMap?.[settings.selectedDeckType];
        const deckId = deckIdFromMap || crypto.randomUUID();
        const deckName =
          settings.deckNameMap?.[settings.selectedDeckType] ||
          settings.deckName ||
          displayName ||
          settings.selectedDeckType ||
          'Community Deck';
        const deckDescription =
          settings.deckDescriptionMap?.[settings.selectedDeckType] ||
          settings.deckDescription ||
          '';

        // Persist deckId for this deck type so subsequent uploads stay in one deck
        if (!deckIdFromMap) {
          updateSettings({
            deckIdMap: {
              ...(settings.deckIdMap || {}),
              [settings.selectedDeckType]: deckId,
            },
          });
        }
        for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
          const batch = batches[batchIndex];
          logProgress(`Uploading batch ${batchIndex + 1}/${batches.length} via Supabase...`);
          const payload = {
            cards: batch.map((card) => ({
              cardNumber: card.cardNumber,
              deckType: card.deckType,
              frames: card.frames,
              gifUrl: card.gifUrl,
              videoUrl: card.videoUrl,
              timestamp: card.timestamp,
              model: card.source || 'local',
              author: displayName || 'anonymous',
              prompt: card.prompt || null,
              deckPromptSuffix: card.deckPromptSuffix || null,
              deckId,
              deckName,
              deckDescription,
            })),
          };

          // Estimate batch size (bytes) to avoid ~4.5MB Vercel body limit
          const batchBytes = batch.reduce((sum, c) => sum + estimateCardSize(c), 0);
          console.log(`[Gallery] Batch ${batchIndex + 1} estimated size: ${(batchBytes / 1024 / 1024).toFixed(2)} MB`);
          if (batchBytes > 4_500_000) {
            throw new Error(`Batch too large (${(batchBytes / 1024 / 1024).toFixed(2)} MB). Reduce frames or batch size.`);
          }

          const resp = await fetch('/api/upload-supabase', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
          if (!resp.ok) {
            const data = await resp.json().catch(() => ({}));
            throw new Error(data?.error || `Supabase upload failed: ${resp.status}`);
          }

          // Mark this batch as shared
          await markCardsAsShared(batch.map((c) => c.timestamp));
        }

        logProgress('Upload complete (Supabase)');
        return true;
      }

      // w3up path (currently blocked by key issues)
      // Step 1: Initialize w3up client
      logProgress('Initializing client...');
      const client = await Client.create();

      // Step 2: Request delegation from server
      logProgress('Requesting authorization...');
      const authResponse = await fetch('/api/auth/w3up', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientDID: client.agent.did() }),
      });

      if (!authResponse.ok) {
        // Try to extract a helpful message even if the body is empty/non-JSON
        let authError = 'Authorization failed';
        try {
          const data = await authResponse.json();
          authError = data?.error || authError;
        } catch {
          const text = await authResponse.text();
          if (text) authError = text;
        }
        if (authResponse.status === 404) {
          authError = 'Authorization endpoint not reachable (404). Is the API server running?';
        }
        throw new Error(authError);
      }

      const { delegation: delegationBase64, spaceDID } = await authResponse.json();

      // Step 3: Parse and activate delegation
      logProgress('Activating delegation...');
      
      // Convert base64 to base64url (UCAN JWTs use base64url internally)
      const b64url = delegationBase64
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
      
      // Parse the delegation using the official Proof parser
      const delegation = await Proof.parse(b64url);
      
      // Add as proof and set the space
      await client.addProof(delegation);
      await client.setCurrentSpace(spaceDID as `did:key:${string}`);

      logProgress(`Authorized to upload to space: ${spaceDID}`);

      // Step 4: Process cards (download videos, convert images)
      logProgress('Processing media...');
      const files: File[] = [];
      const cardData: IPFSCardPackage['cards'] = [];

      for (let i = 0; i < unshared.length; i++) {
        const card = unshared[i];
        logProgress(`Processing card ${i + 1}/${unshared.length}...`);

        // Convert image to WebP (90% size reduction)
        const imageBlob = await convertToWebP(card.frames[0]);
        const imageName = `image-${card.cardNumber}-${card.deckType}.webp`;
        files.push(
          new File([imageBlob], imageName, {
            type: 'image/webp',
          })
        );

        // Download video if exists (before Gemini URL expires)
        let videoName: string | undefined;
        if (card.videoUrl) {
          try {
            const videoBlob = await downloadVideo(card.videoUrl);
            videoName = `video-${card.cardNumber}-${card.deckType}.mp4`;
            files.push(
              new File([videoBlob], videoName, {
                type: 'video/mp4',
              })
            );
          } catch (err) {
            console.warn(`[Gallery] Video download failed for card ${card.cardNumber}:`, err);
            // Continue without video (degraded mode)
          }
        }

        // Add to manifest
        cardData.push({
          cardNumber: card.cardNumber,
          deckType: card.deckType,
          cardName: `Card ${card.cardNumber}`,
          imageData: imageName,
          videoData: videoName,
          metadata: {
            generatedAt: card.timestamp,
            model: 'gemini-2.0-flash-exp',
          },
        });
      }

      // Step 5: Create manifest.json
      const manifest: IPFSCardPackage = {
        author: displayName,
        timestamp: Date.now(),
        version: '1.0',
        cards: cardData,
      };

      files.push(
        new File([JSON.stringify(manifest, null, 2)], 'manifest.json', {
          type: 'application/json',
        })
      );

      console.log(`[Gallery] Prepared ${files.length} files for upload`);

      // Step 6: Upload to IPFS
      logProgress('Uploading to IPFS...');
      const cid = await client.uploadDirectory(files);

      logProgress(`Uploaded to IPFS: ${cid}`);

      // Step 7: Register in Vercel KV
      logProgress('Registering in gallery...');
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
        const regError = await registerResponse.json();
        throw new Error(regError.error || 'Registration failed');
      }

      // Step 8: Mark cards as shared in IndexedDB
      await markCardsAsShared(unshared.map((c) => c.timestamp));

      logProgress(`Upload complete! CID: ${cid.toString().slice(0, 16)}...`);
      console.log(`[Gallery] Success! ${unshared.length} cards shared`);
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
   * Download gallery from IPFS
   *
   * Implements gateway race for reliability:
   * - Tries w3s.link, dweb.link, cloudflare-ipfs.com
   * - Uses first successful response
   * - High availability (99.9%+ uptime)
   */
  const downloadGallery = async (cid: string): Promise<number> => {
    try {
      setError(null);

      // Get metadata from registry
      const metaResponse = await fetch(`/api/gallery/${cid}`);
      if (!metaResponse.ok) {
        throw new Error('Gallery not found');
      }

      await metaResponse.json(); // Validate gallery exists

      // Gateway race: try multiple IPFS gateways
      const gateways = [
        `https://w3s.link/ipfs/${cid}/manifest.json`,
        `https://dweb.link/ipfs/${cid}/manifest.json`,
        `https://cloudflare-ipfs.com/ipfs/${cid}/manifest.json`,
      ];

      let ipfsData: IPFSCardPackage | null = null;

      for (const url of gateways) {
        try {
          console.log(`[Gallery] Trying gateway: ${url}`);
          const response = await fetch(url);
          if (response.ok) {
            ipfsData = await response.json();
            console.log(`[Gallery] Success from: ${url}`);
            break;
          }
        } catch (err) {
          console.warn(`[Gallery] Gateway ${url} failed:`, err);
        }
      }

      if (!ipfsData) {
        throw new Error('All IPFS gateways failed. Try again later.');
      }

      // Add cards to IndexedDB
      let loaded = 0;
      for (const card of ipfsData.cards) {
        const fullCard: GeneratedCard = {
          cardNumber: card.cardNumber,
          deckType: card.deckType,
          frames: [`https://w3s.link/ipfs/${cid}/${card.imageData}`],
          videoUrl: card.videoData ? `https://w3s.link/ipfs/${cid}/${card.videoData}` : undefined,
          timestamp: Date.now() + loaded, // Unique timestamp
          shared: true, // Already in IPFS
          source: 'community', // Not generated locally
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
