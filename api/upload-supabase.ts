import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import {
  HttpError,
  type UploadedCard,
  parsePayload,
  uploadConfig,
  uploadLimits,
} from '../server/upload/supabase-upload-config';
import {
  assertAuthorized,
  buildCardPathPrefix,
  enforceRateLimit,
  getClientIp,
  validateMediaSources,
} from '../server/upload/supabase-upload-guards';
import { fetchAsBuffer } from '../server/upload/supabase-upload-media';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!uploadConfig.bucket || !uploadConfig.publicBaseUrl || !uploadConfig.supabaseUrl || !uploadConfig.supabaseKey) {
    return res.status(500).json({ error: 'Supabase config missing (URL/key/bucket/base URL)' });
  }

  try {
    assertAuthorized(req);
    const clientIp = getClientIp(req);
    enforceRateLimit(clientIp);

    const payload = parsePayload(req.body);
    validateMediaSources(payload.cards);

    const supabase = createClient(uploadConfig.supabaseUrl, uploadConfig.supabaseKey);
    const uploaded: UploadedCard[] = [];
    const requestId = crypto.randomUUID();
    const normalizedPublicBaseUrl = uploadConfig.publicBaseUrl.replace(/\/+$/, '');
    let totalUploadedBytes = 0;

    console.log('[Supabase] Upload request accepted', {
      requestId,
      clientIp,
      cardCount: payload.cards.length,
    });

    for (let cardIndex = 0; cardIndex < payload.cards.length; cardIndex++) {
      const card = payload.cards[cardIndex];
      const frameUrls: string[] = [];
      const deckId = card.deckId || crypto.randomUUID();
      const deckName = card.deckName || 'Community Deck';
      const deckDescription = card.deckDescription || null;
      const pathPrefix = buildCardPathPrefix({ ...card, deckId }, `${requestId}-${cardIndex}`);

      for (let i = 0; i < card.frames.length; i++) {
        const { buffer, ext, mime } = await fetchAsBuffer(card.frames[i], 'image');
        totalUploadedBytes += buffer.byteLength;
        if (totalUploadedBytes > uploadLimits.maxTotalAssetBytes) {
          throw new HttpError(413, `Upload exceeds max total media size of ${uploadLimits.maxTotalAssetBytes} bytes`);
        }

        const path = `${pathPrefix}/frame-${i}${ext}`;
        const { error } = await supabase.storage.from(uploadConfig.bucket).upload(path, buffer, {
          contentType: mime,
          upsert: false,
        });
        if (error) {
          throw error;
        }
        frameUrls.push(`${normalizedPublicBaseUrl}/${path}`);
      }

      let gifUrl: string | undefined;
      if (card.gifUrl) {
        const { buffer, ext, mime } = await fetchAsBuffer(card.gifUrl, 'image');
        totalUploadedBytes += buffer.byteLength;
        if (totalUploadedBytes > uploadLimits.maxTotalAssetBytes) {
          throw new HttpError(413, `Upload exceeds max total media size of ${uploadLimits.maxTotalAssetBytes} bytes`);
        }

        const path = `${pathPrefix}/gif${ext}`;
        const { error } = await supabase.storage.from(uploadConfig.bucket).upload(path, buffer, {
          contentType: mime,
          upsert: false,
        });
        if (error) {
          throw error;
        }
        gifUrl = `${normalizedPublicBaseUrl}/${path}`;
      }

      let videoUrl: string | undefined;
      if (card.videoUrl) {
        const { buffer, ext, mime } = await fetchAsBuffer(card.videoUrl, 'video');
        totalUploadedBytes += buffer.byteLength;
        if (totalUploadedBytes > uploadLimits.maxTotalAssetBytes) {
          throw new HttpError(413, `Upload exceeds max total media size of ${uploadLimits.maxTotalAssetBytes} bytes`);
        }

        const path = `${pathPrefix}/video${ext}`;
        const { error } = await supabase.storage.from(uploadConfig.bucket).upload(path, buffer, {
          contentType: mime,
          upsert: false,
        });
        if (error) {
          throw error;
        }
        videoUrl = `${normalizedPublicBaseUrl}/${path}`;
      }

      const { error: insertError } = await supabase.from('gallery').insert({
        card_number: card.cardNumber,
        deck_type: card.deckType,
        frames: frameUrls,
        gif_url: gifUrl,
        video_url: videoUrl,
        author: card.author || null,
        timestamp: card.timestamp || Date.now(),
        model: card.model || null,
        prompt: card.prompt || null,
        deck_prompt_suffix: card.deckPromptSuffix || null,
        deck_id: deckId,
        deck_name: deckName,
        deck_description: deckDescription,
      });
      if (insertError) {
        throw insertError;
      }

      uploaded.push({
        cardNumber: card.cardNumber,
        deckType: card.deckType,
        frames: frameUrls,
        gifUrl,
        videoUrl,
      });
    }

    console.log('[Supabase] Upload complete', {
      requestId,
      uploadedCards: uploaded.length,
      totalUploadedBytes,
    });

    return res.status(200).json({ uploaded });
  } catch (error) {
    if (error instanceof HttpError) {
      console.warn('[Supabase Upload] rejected', { status: error.status, message: error.message });
      return res.status(error.status).json({ error: error.message });
    }

    const err = error as Error;
    console.error('[Supabase Upload] error:', error);
    return res.status(500).json({ error: err?.message || 'Upload failed' });
  }
}
