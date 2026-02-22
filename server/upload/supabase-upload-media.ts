import { HttpError, uploadLimits } from './supabase-upload-config';
import { assertAllowedRemoteUrl } from './supabase-upload-guards';

function mimeToExtension(mime: string): string {
  const normalized = mime.toLowerCase();
  if (normalized.includes('png')) return '.png';
  if (normalized.includes('jpeg') || normalized.includes('jpg')) return '.jpg';
  if (normalized.includes('gif')) return '.gif';
  if (normalized.includes('mp4')) return '.mp4';
  if (normalized.includes('webm')) return '.webm';
  if (normalized.includes('octet-stream')) return '.bin';
  return '';
}

function getExtensionFromUrl(url: string): string {
  const match = url.split('.').pop();
  if (!match) return '.bin';
  const ext = match.split('?')[0].split('#')[0];
  return ext ? `.${ext}` : '.bin';
}

function assertExpectedMediaType(mime: string, expected: 'image' | 'video'): void {
  const normalized = mime.toLowerCase();
  if (expected === 'image') {
    if (!normalized.startsWith('image/')) {
      throw new HttpError(400, `Expected image media, got "${mime}"`);
    }
    return;
  }

  if (normalized.startsWith('video/') || normalized === 'application/octet-stream') {
    return;
  }
  throw new HttpError(400, `Expected video media, got "${mime}"`);
}

function decodeDataUrl(dataUrl: string): { buffer: Buffer; ext: string; mime: string } {
  const match = dataUrl.match(/^data:([^;]+);base64,([A-Za-z0-9+/=]+)$/);
  if (!match) {
    throw new HttpError(400, 'Malformed data URL');
  }

  const mime = match[1] || 'application/octet-stream';
  const buffer = Buffer.from(match[2], 'base64');
  if (buffer.byteLength === 0) {
    throw new HttpError(400, 'Empty data URL payload');
  }

  if (buffer.byteLength > uploadLimits.maxSingleAssetBytes) {
    throw new HttpError(413, `Asset exceeds max size of ${uploadLimits.maxSingleAssetBytes} bytes`);
  }

  const ext = mimeToExtension(mime) || '.bin';
  return { buffer, ext, mime };
}

async function fetchRemoteBuffer(url: string): Promise<{ buffer: Buffer; ext: string; mime: string }> {
  assertAllowedRemoteUrl(url);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), uploadLimits.fetchTimeoutMs);
  try {
    const resp = await fetch(url, { signal: controller.signal, redirect: 'error' });
    if (!resp.ok) {
      throw new HttpError(400, `Remote fetch failed: HTTP ${resp.status}`);
    }

    const declaredLength = Number.parseInt(resp.headers.get('content-length') || '', 10);
    if (Number.isFinite(declaredLength) && declaredLength > uploadLimits.maxSingleAssetBytes) {
      throw new HttpError(413, `Remote asset exceeds max size of ${uploadLimits.maxSingleAssetBytes} bytes`);
    }

    const mime = resp.headers.get('content-type') || 'application/octet-stream';
    const ext = mimeToExtension(mime) || getExtensionFromUrl(url);
    const arrayBuf = await resp.arrayBuffer();
    const buffer = Buffer.from(arrayBuf);

    if (buffer.byteLength > uploadLimits.maxSingleAssetBytes) {
      throw new HttpError(413, `Remote asset exceeds max size of ${uploadLimits.maxSingleAssetBytes} bytes`);
    }

    return { buffer, ext, mime };
  } catch (error) {
    if (error instanceof HttpError) {
      throw error;
    }

    if ((error as Error).name === 'AbortError') {
      throw new HttpError(408, `Remote fetch timed out after ${uploadLimits.fetchTimeoutMs}ms`);
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchAsBuffer(
  url: string,
  expectedType: 'image' | 'video'
): Promise<{ buffer: Buffer; ext: string; mime: string }> {
  if (url.startsWith('data:')) {
    const decoded = decodeDataUrl(url);
    assertExpectedMediaType(decoded.mime, expectedType);
    return decoded;
  }

  if (expectedType === 'image') {
    throw new HttpError(400, 'Image uploads must be data URLs');
  }

  const remote = await fetchRemoteBuffer(url);
  assertExpectedMediaType(remote.mime, expectedType);
  return remote;
}
