import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Vercel function configuration
 * Set maxDuration to 60s to allow large video streams
 */
export const config = {
  maxDuration: 60,
};

/**
 * Gemini Video Streaming Proxy
 *
 * Purpose: Stream Gemini-generated videos to the client while:
 * 1. Bypassing CORS restrictions (Gemini APIs don't send Access-Control-Allow-Origin)
 * 2. Hiding the GEMINI_API_KEY from client-side code
 * 3. Avoiding the 4.5MB Vercel payload limit (by streaming, not buffering)
 *
 * Flow:
 * 1. Client requests: GET /api/proxy?url=https://generativelanguage.googleapis.com/v1beta/files/abc123
 * 2. Server validates URL is from Gemini
 * 3. Server fetches with API key and alt=media parameter
 * 4. Server streams response body directly to client (NO BUFFERING)
 * 5. Client receives video as a blob
 *
 * Key: By returning geminiResponse.body directly (not await geminiResponse.blob()),
 * Vercel streams the data through without holding it in memory.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const fileUri = req.query.url as string;

    // Validate URL
    if (!fileUri || typeof fileUri !== 'string') {
      return res.status(400).json({ error: 'Missing URL parameter' });
    }

    if (!fileUri.includes('generativelanguage.googleapis.com')) {
      return res.status(400).json({
        error: 'Invalid URL. Only generativelanguage.googleapis.com URLs allowed.',
      });
    }

    // Extract file ID from URI
    // Expected format: https://generativelanguage.googleapis.com/v1beta/files/{fileId}
    const fileIdMatch = fileUri.match(/files\/([\w-]+)/);
    if (!fileIdMatch) {
      return res.status(400).json({
        error: 'Invalid file URI format. Expected: /files/{fileId}',
      });
    }

    const fileId = fileIdMatch[1];
    const geminiApiKey = process.env.GEMINI_API_KEY;

    if (!geminiApiKey) {
      throw new Error('GEMINI_API_KEY not configured');
    }

    // Construct Gemini API URL with:
    // - alt=media: Returns actual file data instead of metadata
    // - key: Authentication (server-side only, never exposed to client)
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/files/${fileId}?key=${geminiApiKey}&alt=media`;

    console.log(`[Proxy] Streaming video: ${fileId}`);

    // Fetch from Gemini
    const geminiResponse = await fetch(geminiUrl);

    if (!geminiResponse.ok) {
      console.error(`[Proxy] Gemini API error: ${geminiResponse.status} ${geminiResponse.statusText}`);
      return res.status(geminiResponse.status).json({
        error: `Gemini API error: ${geminiResponse.statusText}`,
      });
    }

    // Forward critical headers from Gemini response
    const headers = new Headers(geminiResponse.headers);

    // Add CORS headers (this is the whole point!)
    headers.set('Access-Control-Allow-Origin', '*');
    headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
    headers.set('Access-Control-Allow-Headers', 'Content-Type');

    // Cache for 1 hour (Gemini URLs expire in 48h anyway)
    headers.set('Cache-Control', 'public, max-age=3600');

    // Stream response body directly to client
    // CRITICAL: Return geminiResponse.body (ReadableStream), NOT await geminiResponse.blob()
    // This ensures Vercel streams the data without buffering it in memory
    return new Response(geminiResponse.body, {
      status: geminiResponse.status,
      headers,
    });
  } catch (error) {
    console.error('[API] /api/proxy error:', error);

    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Proxy failed',
    });
  }
}
