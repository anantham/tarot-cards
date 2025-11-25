import type { Settings } from '../types';

interface VideoResponse {
  videoUrl?: string;
  error?: string;
}

function dataUrlToBytes(dataUrl: string): { mimeType: string; base64: string } | null {
  const match = dataUrl.match(/^data:([^;]+);base64,(.*)$/);
  if (!match) return null;
  return { mimeType: match[1], base64: match[2] };
}

function extractVideoUri(opData: any): string | null {
  const paths = [
    opData?.response?.generateVideoResponse?.generatedSamples?.[0]?.video?.uri,
    opData?.response?.generateVideoResponse?.generatedSamples?.[0]?.videoUri,
    opData?.response?.generateVideoResponse?.generatedSamples?.[0]?.video?.downloadUri,
    opData?.response?.generatedVideos?.[0]?.video?.uri,
    opData?.response?.generatedVideos?.[0]?.videoUri,
    opData?.response?.generatedVideos?.[0]?.video?.downloadUri,
    opData?.response?.video?.uri,
    opData?.response?.videoUri,
  ];
  return paths.find((u) => typeof u === 'string' && u.length > 0) || null;
}

/**
 * Generate an 8s 9:16 video using Veo 3.1 via Gemini API
 */
export async function generateVideoFromImage(
  prompt: string,
  referenceImage: string | undefined,
  settings?: Settings
): Promise<VideoResponse> {
  try {
    const apiKey = settings?.geminiApiKey;
    if (!apiKey) {
      throw new Error('Gemini API key is required for video generation.');
    }

    const maxRetries = 2;
    const pollIntervalMs = 2000;
    const maxPollAttempts = 60; // ~2 minutes
    const model = 'veo-3.1-generate-preview';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:predictLongRunning?key=${apiKey}`;

    const attemptOnce = async (): Promise<VideoResponse> => {
      const instances: any[] = [{ prompt }];

      if (referenceImage) {
        const parsed = dataUrlToBytes(referenceImage);
        if (parsed) {
          instances[0].image = {
            bytesBase64Encoded: parsed.base64,
            mimeType: parsed.mimeType,
          };
        }
      }

      const body = {
        instances,
        parameters: {
          aspectRatio: '9:16',
          durationSeconds: 8,
        },
      };

      console.log('[VideoGen] request', {
        url,
        model,
        hasReferenceImage: Boolean(referenceImage),
        promptPreview: prompt.slice(0, 300),
      });

      const startResponse = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      const startText = await startResponse.text();

      if (!startResponse.ok) {
        let details = startText;
        try {
          const parsed = JSON.parse(startText);
          if (parsed?.error?.message) {
            details = parsed.error.message;
          }
        } catch {
          // ignore parse failure, keep raw text
        }
        if (startResponse.status === 429 || details.toLowerCase().includes('quota')) {
          throw new Error(
            'Rate limit hit for Gemini video. Wait a bit or check billing/usage. ' +
            'Daily cap is often 10 videos; RPM limit can be 5 or lower. Details: ' + details
          );
        }
        throw new Error(`Video start failed: ${startResponse.status} ${details}`);
      }

      let operation: any;
      try {
        operation = JSON.parse(startText);
      } catch (err) {
        throw new Error(`Video start parse failed: ${String(err)} Body: ${startText}`);
      }

      console.log('[VideoGen] start response', operation);
      if (!operation?.name) {
        throw new Error('Video generation operation name missing');
      }

      // Poll for completion
      const operationUrl = `https://generativelanguage.googleapis.com/v1beta/${operation.name}?key=${apiKey}`;
      let attempts = 0;
      while (attempts < maxPollAttempts) {
        const opResp = await fetch(operationUrl);
        if (!opResp.ok) {
          const opText = await opResp.text();
          let detail = opText;
          try {
            const parsed = JSON.parse(opText);
            detail = parsed?.error?.message || opText;
          } catch {
            // ignore parse error
          }
          if (opResp.status === 429 || detail.toLowerCase().includes('quota')) {
            throw new Error(
              'Rate limit hit while polling video status. Wait a bit and retry. Details: ' + detail
            );
          }
          throw new Error(`Video poll failed: ${opResp.status} ${detail}`);
        }
        const opText = await opResp.text();
        let opData: any;
        try {
          opData = JSON.parse(opText);
        } catch {
          throw new Error(`Video poll parse failed. Body: ${opText}`);
        }
        console.log('[VideoGen] poll', { attempt: attempts, done: opData.done, response: opData });
        if (opData.done) {
          const uri = extractVideoUri(opData);
          if (!uri) {
            console.error('[VideoGen] missing video URI. Full response:', opData);
            throw new Error('Video URI not found in response');
          }
          // The URI is downloadable with the same API key
          return { videoUrl: uri };
        }
        attempts += 1;
        await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
      }

      throw new Error('Video generation timed out');
    };

    // Retry wrapper
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const result = await attemptOnce();
        return result;
      } catch (err) {
        if (attempt === maxRetries) {
          throw err;
        }
        console.warn('[VideoGen] retrying after error:', err);
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }

    throw new Error('Video generation failed after retries');
  } catch (error) {
    console.error('[VideoGen] error:', error);
    return {
      videoUrl: '',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
