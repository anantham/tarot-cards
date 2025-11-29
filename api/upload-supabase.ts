import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
// Supabase upload endpoint with verbose logging for debugging env/config and upload progress

const bucket = process.env.SUPABASE_BUCKET || '';
const publicBaseUrl = process.env.SUPABASE_PUBLIC_BASE_URL || '';
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

interface UploadPayload {
  cards: Array<{
    cardNumber: number;
    deckType: string;
    frames: string[];
    gifUrl?: string;
    videoUrl?: string;
    timestamp: number;
    model?: string;
    author?: string;
  }>;
}

function mimeToExtension(mime: string): string {
  if (mime.includes('png')) return '.png';
  if (mime.includes('jpeg') || mime.includes('jpg')) return '.jpg';
  if (mime.includes('gif')) return '.gif';
  if (mime.includes('mp4')) return '.mp4';
  if (mime.includes('webm')) return '.webm';
  if (mime.includes('octet-stream')) return '.bin';
  return '';
}

function getExtensionFromUrl(url: string): string {
  const match = url.split('.').pop();
  if (!match) return '.bin';
  const ext = match.split('?')[0].split('#')[0];
  return ext ? `.${ext}` : '.bin';
}

async function dataUrlToBuffer(dataUrl: string): Promise<{ buffer: Buffer; ext: string; mime: string }> {
  const [meta, data] = dataUrl.split(',');
  const mime = meta.split(';')[0].replace('data:', '') || 'application/octet-stream';
  const ext = mimeToExtension(mime) || '.bin';
  const buffer = Buffer.from(data, 'base64');
  return { buffer, ext, mime };
}

async function fetchAsBuffer(url: string): Promise<{ buffer: Buffer; ext: string; mime: string }> {
  if (url.startsWith('data:')) {
    return dataUrlToBuffer(url);
  }
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Fetch failed: ${resp.status}`);
  const mime = resp.headers.get('content-type') || 'application/octet-stream';
  const ext = mimeToExtension(mime) || getExtensionFromUrl(url);
  const arrayBuf = await resp.arrayBuffer();
  return { buffer: Buffer.from(arrayBuf), ext, mime };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  console.log('[Supabase] Config:', {
    bucket,
    publicBaseUrl: !!publicBaseUrl,
    supabaseUrl: !!supabaseUrl,
    supabaseKey: supabaseKey ? 'set' : 'missing',
  });

  if (!bucket || !publicBaseUrl || !supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'Supabase config missing (URL/key/bucket/base URL)' });
  }

  try {
    console.log('[Supabase] Creating client');
    const supabase = createClient(supabaseUrl, supabaseKey);
    const payload = req.body as UploadPayload;
    if (!payload?.cards || !Array.isArray(payload.cards) || payload.cards.length === 0) {
      return res.status(400).json({ error: 'No cards provided' });
    }

    const uploaded = [];
    console.log('[Supabase] Processing cards:', payload.cards.length);

    for (const card of payload.cards) {
      console.log('[Supabase] Card', card.cardNumber, card.deckType);
      const frameUrls: string[] = [];
      // Frames
      for (let i = 0; i < card.frames.length; i++) {
        console.log('[Supabase] Frame', i, 'of', card.frames.length);
        const { buffer, ext, mime } = await fetchAsBuffer(card.frames[i]);
        const path = `card-${card.cardNumber}/frame-${i}${ext}`;
        const { error } = await supabase.storage.from(bucket).upload(path, buffer, {
          contentType: mime,
          upsert: true,
        });
        if (error) throw error;
        frameUrls.push(`${publicBaseUrl}/${path}`);
      }

      // GIF
      let gifUrl: string | undefined;
      if (card.gifUrl) {
        console.log('[Supabase] GIF for card', card.cardNumber);
        const { buffer, ext, mime } = await fetchAsBuffer(card.gifUrl);
        const path = `card-${card.cardNumber}/gif${ext}`;
        const { error } = await supabase.storage.from(bucket).upload(path, buffer, {
          contentType: mime,
          upsert: true,
        });
        if (error) throw error;
        gifUrl = `${publicBaseUrl}/${path}`;
      }

      // Video
      let videoUrl: string | undefined;
      if (card.videoUrl) {
        console.log('[Supabase] Video for card', card.cardNumber);
        const { buffer, ext, mime } = await fetchAsBuffer(card.videoUrl);
        const path = `card-${card.cardNumber}/video${ext}`;
        const { error } = await supabase.storage.from(bucket).upload(path, buffer, {
          contentType: mime,
          upsert: true,
        });
        if (error) throw error;
        videoUrl = `${publicBaseUrl}/${path}`;
      }

      // Insert metadata row
      console.log('[Supabase] Inserting gallery row for card', card.cardNumber);
      const { error: insertError } = await supabase.from('gallery').insert({
        card_number: card.cardNumber,
        deck_type: card.deckType,
        frames: frameUrls,
        gif_url: gifUrl,
        video_url: videoUrl,
        author: card.author || null,
        timestamp: card.timestamp || Date.now(),
        model: card.model || null,
        prompt: (card as any).prompt || null,
        deck_prompt_suffix: (card as any).deckPromptSuffix || null,
      });
      if (insertError) throw insertError;

      uploaded.push({
        cardNumber: card.cardNumber,
        deckType: card.deckType,
        frames: frameUrls,
        gifUrl,
        videoUrl,
      });
    }

    console.log('[Supabase] Upload complete, cards:', uploaded.length);
    return res.status(200).json({ uploaded });
  } catch (error: any) {
    console.error('[Supabase Upload] error:', error);
    return res.status(500).json({ error: error?.message || 'Upload failed' });
  }
}
