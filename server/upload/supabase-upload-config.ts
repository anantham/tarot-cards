import { z } from 'zod';

function readPositiveInt(rawValue: string | undefined, fallback: number): number {
  const parsed = Number.parseInt((rawValue || '').trim(), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
}

export function parseAllowedHosts(rawValue: string | undefined, fallback: readonly string[]): string[] {
  const fromEnv = (rawValue || '')
    .split(',')
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean);

  const values = fromEnv.length > 0 ? fromEnv : [...fallback];
  return [...new Set(values)];
}

export class HttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const DEFAULT_ALLOWED_REMOTE_HOSTS = [
  'generativelanguage.googleapis.com',
  'storage.googleapis.com',
  'googleapis.com',
  'googleusercontent.com',
] as const;

export const uploadConfig = {
  bucket: process.env.SUPABASE_BUCKET || '',
  publicBaseUrl: process.env.SUPABASE_PUBLIC_BASE_URL || '',
  supabaseUrl: process.env.SUPABASE_URL || '',
  supabaseKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  uploadToken: process.env.UPLOAD_API_TOKEN?.trim() || '',
};

export const uploadLimits = {
  maxCardsPerRequest: readPositiveInt(process.env.UPLOAD_MAX_CARDS, 4),
  maxUrlLength: readPositiveInt(process.env.UPLOAD_MAX_URL_LENGTH, 8192),
  maxSingleAssetBytes: readPositiveInt(process.env.UPLOAD_MAX_SINGLE_ASSET_BYTES, 6_000_000),
  maxTotalAssetBytes: readPositiveInt(process.env.UPLOAD_MAX_TOTAL_ASSET_BYTES, 18_000_000),
  fetchTimeoutMs: readPositiveInt(process.env.UPLOAD_FETCH_TIMEOUT_MS, 15_000),
  rateWindowMs: readPositiveInt(process.env.UPLOAD_RATE_WINDOW_MS, 60_000),
  rateMaxRequests: readPositiveInt(process.env.UPLOAD_RATE_MAX_REQUESTS, 15),
};

export const allowedRemoteHosts = parseAllowedHosts(
  process.env.UPLOAD_FETCH_HOST_ALLOWLIST,
  DEFAULT_ALLOWED_REMOTE_HOSTS
);

const cardSchema = z
  .object({
    cardNumber: z.number().int().min(0).max(500),
    deckType: z.string().trim().min(1).max(120),
    frames: z.array(z.string().min(1).max(uploadLimits.maxUrlLength)).min(1).max(12),
    gifUrl: z.string().min(1).max(uploadLimits.maxUrlLength).optional(),
    videoUrl: z.string().min(1).max(uploadLimits.maxUrlLength).optional(),
    timestamp: z.number().int().positive().max(9999999999999).optional(),
    model: z.string().trim().max(160).optional(),
    author: z.string().trim().max(120).optional(),
    deckId: z.string().trim().max(120).optional(),
    deckName: z.string().trim().max(160).optional(),
    deckDescription: z.string().trim().max(4000).optional(),
    prompt: z.string().max(20000).optional().nullable(),
    deckPromptSuffix: z.string().max(20000).optional().nullable(),
  })
  .passthrough();

export const payloadSchema = z
  .object({
    cards: z.array(cardSchema).min(1).max(uploadLimits.maxCardsPerRequest),
  })
  .strict();

export type UploadPayload = z.infer<typeof payloadSchema>;
export type UploadCard = UploadPayload['cards'][number];

export type UploadedCard = {
  cardNumber: number;
  deckType: string;
  frames: string[];
  gifUrl?: string;
  videoUrl?: string;
};

export function parsePayload(body: unknown): UploadPayload {
  const parsedBody =
    typeof body === 'string'
      ? (() => {
          try {
            return JSON.parse(body);
          } catch {
            throw new HttpError(400, 'Request body must be valid JSON');
          }
        })()
      : body;

  const result = payloadSchema.safeParse(parsedBody);
  if (!result.success) {
    const issue = result.error.issues[0];
    const location = issue?.path?.length ? issue.path.join('.') : 'body';
    throw new HttpError(400, `Invalid payload at "${location}": ${issue?.message || 'unknown error'}`);
  }

  return result.data;
}
