import type { VercelRequest } from '@vercel/node';
import { HttpError, type UploadCard, allowedRemoteHosts, uploadConfig, uploadLimits } from './supabase-upload-config';

const requestLogByIp = new Map<string, number[]>();

function getHeaderValue(headerValue: string | string[] | undefined): string {
  if (Array.isArray(headerValue)) return headerValue[0] || '';
  return headerValue || '';
}

export function isDataUrl(url: string): boolean {
  return url.startsWith('data:');
}

function isPrivateIpv4(host: string): boolean {
  const octets = host.split('.').map((part) => Number.parseInt(part, 10));
  if (octets.length !== 4 || octets.some((n) => Number.isNaN(n) || n < 0 || n > 255)) {
    return false;
  }

  if (octets[0] === 10) return true;
  if (octets[0] === 127) return true;
  if (octets[0] === 169 && octets[1] === 254) return true;
  if (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) return true;
  if (octets[0] === 192 && octets[1] === 168) return true;
  if (octets[0] === 0) return true;
  return false;
}

function isIpLiteral(host: string): boolean {
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return true;
  if (host.includes(':')) return true;
  return false;
}

function isAllowedHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return allowedRemoteHosts.some((allowed) => host === allowed || host.endsWith(`.${allowed}`));
}

export function assertAllowedRemoteUrl(url: string): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new HttpError(400, 'Invalid remote media URL');
  }

  if (parsed.protocol !== 'https:') {
    throw new HttpError(400, 'Only https remote URLs are allowed');
  }

  if (parsed.username || parsed.password) {
    throw new HttpError(400, 'Remote URLs may not include credentials');
  }

  const host = parsed.hostname.toLowerCase();
  if (host === 'localhost' || host.endsWith('.local') || host.endsWith('.internal')) {
    throw new HttpError(400, 'Local network hosts are not allowed');
  }

  if (isIpLiteral(host) && isPrivateIpv4(host)) {
    throw new HttpError(400, 'Private IP ranges are not allowed');
  }

  if (!isAllowedHost(host)) {
    throw new HttpError(400, `Remote host "${host}" is not in the allowlist`);
  }
}

export function getClientIp(req: VercelRequest): string {
  const forwarded = getHeaderValue(req.headers['x-forwarded-for']);
  if (forwarded) {
    const firstHop = forwarded.split(',')[0]?.trim();
    if (firstHop) return firstHop;
  }

  const realIp = getHeaderValue(req.headers['x-real-ip']);
  if (realIp) return realIp.trim();
  return 'unknown';
}

export function assertAuthorized(req: VercelRequest): void {
  if (!uploadConfig.uploadToken) {
    return;
  }

  const authHeader = getHeaderValue(req.headers.authorization);
  const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  const headerToken = getHeaderValue(req.headers['x-upload-token']).trim();
  const provided = bearerToken || headerToken;

  if (!provided || provided !== uploadConfig.uploadToken) {
    throw new HttpError(401, 'Unauthorized upload request');
  }
}

export function enforceRateLimit(ip: string): void {
  const now = Date.now();
  const recent = (requestLogByIp.get(ip) || []).filter((ts) => now - ts < uploadLimits.rateWindowMs);
  if (recent.length >= uploadLimits.rateMaxRequests) {
    throw new HttpError(429, 'Rate limit exceeded. Please retry later.');
  }

  recent.push(now);
  requestLogByIp.set(ip, recent);
}

function sanitizeStorageSegment(input: string, fallback: string): string {
  const normalized = input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
  return normalized || fallback;
}

export function buildCardPathPrefix(card: UploadCard, requestId: string): string {
  const safeDeckId = sanitizeStorageSegment(card.deckId || 'community', 'community');
  const safeDeckType = sanitizeStorageSegment(card.deckType, 'deck');
  const safeCardNumber = sanitizeStorageSegment(String(card.cardNumber), 'card');
  const safeTimestamp = sanitizeStorageSegment(String(card.timestamp || Date.now()), String(Date.now()));
  return `${safeDeckId}/${safeDeckType}/card-${safeCardNumber}/${safeTimestamp}-${requestId}`;
}

export function validateMediaSources(cards: UploadCard[]): void {
  for (const card of cards) {
    for (const frame of card.frames) {
      if (!isDataUrl(frame)) {
        throw new HttpError(400, `Card ${card.cardNumber}: frames must be base64 data URLs`);
      }
    }

    if (card.gifUrl && !isDataUrl(card.gifUrl)) {
      throw new HttpError(400, `Card ${card.cardNumber}: gifUrl must be a base64 data URL`);
    }

    if (card.videoUrl && !isDataUrl(card.videoUrl)) {
      assertAllowedRemoteUrl(card.videoUrl);
    }
  }
}
