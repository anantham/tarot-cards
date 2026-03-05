/**
 * Tests for videoGeneration.ts (Veo 3.1 client-side polling)
 *
 * Strategy:
 *   - mock globalThis.fetch for all network calls
 *   - vi.useFakeTimers() + vi.runAllTimersAsync() to fast-forward poll delays
 *     without real 2s waits
 *   - URL-based fetch routing: predictLongRunning = start, everything else = poll
 *
 * Scenarios covered:
 *   prerequisites  — missing key, undefined settings
 *   start errors   — 400, 429, quota message, bad JSON, missing operation name
 *   happy path     — immediate done, N pending polls, reference image inline
 *   response shapes — generatedVideos path, flat videoUri, done with no URI
 *   timeout/retry  — maxPollAttempts timeout, retry on 5xx, all retries exhausted
 */

import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import type { Settings } from '../types';

// Logger mock must be declared before the module under test is imported
vi.mock('./logger', () => ({ debugLog: vi.fn() }));

import { generateVideoFromImage } from './videoGeneration';

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeSettings(overrides: Partial<Settings> = {}): Settings {
  return { geminiApiKey: 'test-key-abc', ...overrides } as Settings;
}

function mockResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body),
  } as Response;
}

const START_RESPONSE = { name: 'operations/test-op-id' };
const POLL_NOT_DONE = { done: false };
const POLL_DONE = {
  done: true,
  response: {
    generateVideoResponse: {
      generatedSamples: [{ video: { uri: 'https://storage.googleapis.com/video.mp4' } }],
    },
  },
};

// Route fetch calls by URL — start uses predictLongRunning, polls use the operation path
function setupFetchByUrl(
  startResponse: () => Response,
  pollResponse: () => Response,
) {
  (globalThis.fetch as ReturnType<typeof vi.fn>).mockImplementation(async (url: string) => {
    return url.includes('predictLongRunning') ? startResponse() : pollResponse();
  });
}

// ─── Setup ──────────────────────────────────────────────────────────────────

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  globalThis.fetch = fetchMock;
  vi.useFakeTimers();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

// ─── Prerequisites ───────────────────────────────────────────────────────────

describe('generateVideoFromImage: prerequisites', () => {
  it('returns error immediately when API key is missing', async () => {
    const result = await generateVideoFromImage('prompt', undefined, {} as Settings);

    expect(result.videoUrl).toBe('');
    expect(result.error).toContain('Gemini API key is required');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns error when settings are undefined', async () => {
    const result = await generateVideoFromImage('prompt', undefined, undefined);

    expect(result.error).toContain('Gemini API key is required');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

// ─── Start request errors ────────────────────────────────────────────────────

describe('generateVideoFromImage: start request errors', () => {
  it('returns error on generic HTTP failure', async () => {
    fetchMock.mockResolvedValue(mockResponse({ error: { message: 'Bad request' } }, 400));

    const promise = generateVideoFromImage('prompt', undefined, makeSettings());
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result.error).toContain('Video start failed: 400');
  });

  it('returns rate-limit message on 429 status', async () => {
    fetchMock.mockResolvedValue(mockResponse({ error: { message: 'Limit exceeded' } }, 429));

    const promise = generateVideoFromImage('prompt', undefined, makeSettings());
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result.error).toContain('Rate limit hit for Gemini video');
    expect(result.error).toContain('Daily cap');
  });

  it('returns rate-limit message when response body contains "quota"', async () => {
    fetchMock.mockResolvedValue(
      mockResponse({ error: { message: 'Resource quota exhausted for the project' } }, 400)
    );

    const promise = generateVideoFromImage('prompt', undefined, makeSettings());
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result.error).toContain('Rate limit hit for Gemini video');
  });

  it('returns error when start response is not valid JSON', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => 'not json {{',
    } as Response);

    const promise = generateVideoFromImage('prompt', undefined, makeSettings());
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result.error).toContain('Video start parse failed');
  });

  it('returns error when operation name is missing from start response', async () => {
    fetchMock.mockResolvedValue(mockResponse({ noNameHere: true }));

    const promise = generateVideoFromImage('prompt', undefined, makeSettings());
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result.error).toContain('operation name missing');
  });
});

// ─── Happy path ──────────────────────────────────────────────────────────────

describe('generateVideoFromImage: happy path', () => {
  it('returns video URL when operation completes on first poll', async () => {
    fetchMock
      .mockResolvedValueOnce(mockResponse(START_RESPONSE))
      .mockResolvedValueOnce(mockResponse(POLL_DONE));

    const promise = generateVideoFromImage('A mystical fool', undefined, makeSettings());
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result.error).toBeUndefined();
    expect(result.videoUrl).toBe('https://storage.googleapis.com/video.mp4');
  });

  it('polls until done after several pending responses', async () => {
    fetchMock
      .mockResolvedValueOnce(mockResponse(START_RESPONSE))
      .mockResolvedValueOnce(mockResponse(POLL_NOT_DONE))
      .mockResolvedValueOnce(mockResponse(POLL_NOT_DONE))
      .mockResolvedValueOnce(mockResponse(POLL_DONE));

    const promise = generateVideoFromImage('prompt', undefined, makeSettings());
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result.videoUrl).toBe('https://storage.googleapis.com/video.mp4');
    expect(fetchMock).toHaveBeenCalledTimes(4); // 1 start + 3 polls
  });

  it('sends reference image inline when a data URL is provided', async () => {
    fetchMock
      .mockResolvedValueOnce(mockResponse(START_RESPONSE))
      .mockResolvedValueOnce(mockResponse(POLL_DONE));

    const dataUrl = 'data:image/jpeg;base64,/9j/abc123';
    const promise = generateVideoFromImage('prompt', dataUrl, makeSettings());
    await vi.runAllTimersAsync();
    await promise;

    const [, startOptions] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(startOptions.body as string);
    expect(body.instances[0].image).toBeDefined();
    expect(body.instances[0].image.mimeType).toBe('image/jpeg');
    expect(body.instances[0].image.bytesBase64Encoded).toBe('/9j/abc123');
  });

  it('skips image attachment when reference is not a data URL', async () => {
    fetchMock
      .mockResolvedValueOnce(mockResponse(START_RESPONSE))
      .mockResolvedValueOnce(mockResponse(POLL_DONE));

    const promise = generateVideoFromImage('prompt', 'https://not-a-data-url.com/img.jpg', makeSettings());
    await vi.runAllTimersAsync();
    await promise;

    const [, startOptions] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(startOptions.body as string);
    expect(body.instances[0].image).toBeUndefined();
  });
});

// ─── Response shape variants ─────────────────────────────────────────────────

describe('generateVideoFromImage: response shape variants', () => {
  it('extracts URI from generatedVideos[].video.uri path', async () => {
    const altShape = {
      done: true,
      response: { generatedVideos: [{ video: { uri: 'https://alt-path.example.com/v.mp4' } }] },
    };
    fetchMock
      .mockResolvedValueOnce(mockResponse(START_RESPONSE))
      .mockResolvedValueOnce(mockResponse(altShape));

    const promise = generateVideoFromImage('prompt', undefined, makeSettings());
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result.videoUrl).toBe('https://alt-path.example.com/v.mp4');
  });

  it('extracts URI from flat response.videoUri path', async () => {
    const flatShape = { done: true, response: { videoUri: 'https://flat.example.com/v.mp4' } };
    fetchMock
      .mockResolvedValueOnce(mockResponse(START_RESPONSE))
      .mockResolvedValueOnce(mockResponse(flatShape));

    const promise = generateVideoFromImage('prompt', undefined, makeSettings());
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result.videoUrl).toBe('https://flat.example.com/v.mp4');
  });

  it('returns error when done=true but no URI found in any known path', async () => {
    // "Video URI not found" is treated as a retryable error — set up routing so
    // all 3 attempts (initial + 2 retries) get valid start + poll responses.
    const noUri = { done: true, response: {} };
    setupFetchByUrl(
      () => mockResponse(START_RESPONSE),
      () => mockResponse(noUri),
    );

    const promise = generateVideoFromImage('prompt', undefined, makeSettings());
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result.error).toContain('Video URI not found');
  });
});

// ─── Timeout and retry ───────────────────────────────────────────────────────

describe('generateVideoFromImage: timeout and retry', () => {
  it('times out after maxPollAttempts with all pending responses', async () => {
    setupFetchByUrl(
      () => mockResponse(START_RESPONSE),
      () => mockResponse(POLL_NOT_DONE),
    );

    const promise = generateVideoFromImage('prompt', undefined, makeSettings());
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result.error).toContain('timed out');
  });

  it('retries on transient 5xx and succeeds on second attempt', async () => {
    fetchMock
      .mockResolvedValueOnce(mockResponse({ error: { message: 'Service unavailable' } }, 503))
      .mockResolvedValueOnce(mockResponse(START_RESPONSE)) // retry: start succeeds
      .mockResolvedValueOnce(mockResponse(POLL_DONE));

    const promise = generateVideoFromImage('prompt', undefined, makeSettings());
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result.videoUrl).toBe('https://storage.googleapis.com/video.mp4');
  });

  it('returns error after all retries are exhausted', async () => {
    // All start requests fail — 1 initial + 2 retries = 3 start attempts
    setupFetchByUrl(
      () => mockResponse({ error: { message: 'Server error' } }, 500),
      () => mockResponse(POLL_NOT_DONE),
    );

    const promise = generateVideoFromImage('prompt', undefined, makeSettings());
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result.error).toContain('Video start failed');
    expect(fetchMock).toHaveBeenCalledTimes(3); // maxRetries=2 → 3 total attempts
  });
});
