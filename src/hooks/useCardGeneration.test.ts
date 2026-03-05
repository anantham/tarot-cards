/**
 * Tests for useCardGeneration hook
 *
 * Strategy:
 *   - Mock all external dependencies (store, imageGeneration, videoGeneration,
 *     deckInterpretation, videoPrompt, tarot-decks.json)
 *   - Use renderHook + act from @testing-library/react
 *   - Mock tarot-decks.json to 2 cards so batch tests stay fast
 *   - vi.useFakeTimers() for inter-card rate-limit delays
 *
 * Scenarios covered:
 *   generateSingleCard  — happy path, bad card number, image failure,
 *                         existing prompt preserved, progress context
 *   generateVideo       — happy path, no reference image, video API error,
 *                         bad card number
 *   generateAllCards    — generates each card in sequence, continues after failure
 *   generateAllVideos   — skips no-image cards, skips cached videos,
 *                         accumulates failures, formats final status
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { GeneratedCard, Settings } from '../types';

// ─── Mocks (must be declared before imports) ────────────────────────────────

vi.mock('../store/useStore');
vi.mock('../utils/imageGeneration');
vi.mock('../utils/videoGeneration');
vi.mock('../utils/deckInterpretation');
vi.mock('../utils/videoPrompt');
vi.mock('../utils/logger', () => ({ debugLog: vi.fn() }));

// Limit to 2 cards so batch operations finish instantly
vi.mock('../data/tarot-decks.json', () => ({
  default: {
    cards: [
      {
        number: 0,
        traditional: { name: 'The Fool' },
        lordOfMysteries: { pathway: 'Fool' },
      },
      {
        number: 1,
        traditional: { name: 'The Magician' },
        lordOfMysteries: { pathway: 'Magician' },
      },
    ],
  },
}));

import { useCardGeneration } from './useCardGeneration';
import { useStore } from '../store/useStore';
import { generateCardFrames } from '../utils/imageGeneration';
import { generateVideoFromImage } from '../utils/videoGeneration';
import { getInterpretationForDeck } from '../utils/deckInterpretation';
import { buildTarotVideoPrompt } from '../utils/videoPrompt';

// ─── Helpers ────────────────────────────────────────────────────────────────

const DEFAULT_SETTINGS = {
  selectedDeckType: 'traditional-rider-waite',
  geminiApiKey: 'test-key',
} as Settings;

function makeGeneratedCard(overrides: Partial<GeneratedCard> = {}): GeneratedCard {
  return {
    cardNumber: 0,
    deckType: 'traditional-rider-waite',
    timestamp: 1_000,
    frames: ['data:image/jpeg;base64,abc'],
    prompt: undefined,
    shared: false,
    source: 'local',
    ...overrides,
  };
}

// ─── Store mock factory ──────────────────────────────────────────────────────

function makeStoreMock(overrides: Partial<ReturnType<typeof useStore>> = {}) {
  return {
    settings: DEFAULT_SETTINGS,
    addGeneratedCard: vi.fn(),
    setIsGenerating: vi.fn(),
    setGenerationProgress: vi.fn(),
    getGeneratedCard: vi.fn().mockReturnValue(undefined),
    ...overrides,
  };
}

// ─── Setup ──────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.mocked(useStore).mockReturnValue(makeStoreMock() as any);
  vi.mocked(generateCardFrames).mockResolvedValue(['data:image/jpeg;base64,frame1']);
  vi.mocked(generateVideoFromImage).mockResolvedValue({ videoUrl: 'https://example.com/video.mp4' });
  vi.mocked(getInterpretationForDeck).mockReturnValue({
    name: 'The Fool',
    prompt: 'A fool stands at the precipice',
  } as any);
  vi.mocked(buildTarotVideoPrompt).mockReturnValue({
    title: 'The Fool',
    basePrompt: 'Animate a tarot card: The Fool',
  });

  vi.useFakeTimers();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

// ─── generateSingleCard ──────────────────────────────────────────────────────

describe('generateSingleCard', () => {
  it('generates image, adds card to store, and clears isGenerating', async () => {
    const store = makeStoreMock();
    vi.mocked(useStore).mockReturnValue(store as any);

    const { result } = renderHook(() => useCardGeneration());

    await act(async () => {
      await result.current.generateSingleCard(0);
    });

    expect(generateCardFrames).toHaveBeenCalledOnce();
    expect(store.addGeneratedCard).toHaveBeenCalledOnce();

    const saved = store.addGeneratedCard.mock.calls[0][0] as GeneratedCard;
    expect(saved.cardNumber).toBe(0);
    expect(saved.deckType).toBe('traditional-rider-waite');
    expect(saved.frames).toEqual(['data:image/jpeg;base64,frame1']);
    expect(saved.shared).toBe(false);
    expect(saved.source).toBe('local');

    expect(store.setIsGenerating).toHaveBeenLastCalledWith(false);
    expect(result.current.error).toBeNull();
  });

  it('sets error and clears isGenerating when card number is invalid', async () => {
    const store = makeStoreMock();
    vi.mocked(useStore).mockReturnValue(store as any);

    const { result } = renderHook(() => useCardGeneration());

    await act(async () => {
      await result.current.generateSingleCard(999);
    });

    expect(result.current.error).toContain('Card 999 not found');
    expect(store.setIsGenerating).toHaveBeenLastCalledWith(false);
    expect(store.addGeneratedCard).not.toHaveBeenCalled();
  });

  it('sets error and clears isGenerating when image generation fails', async () => {
    vi.mocked(generateCardFrames).mockRejectedValueOnce(new Error('Gemini API key required'));
    const store = makeStoreMock();
    vi.mocked(useStore).mockReturnValue(store as any);

    const { result } = renderHook(() => useCardGeneration());

    await act(async () => {
      await result.current.generateSingleCard(0);
    });

    expect(result.current.error).toContain('Gemini API key required');
    expect(store.setIsGenerating).toHaveBeenLastCalledWith(false);
    expect(store.addGeneratedCard).not.toHaveBeenCalled();
  });

  it('preserves an existing edited prompt from the store', async () => {
    const existingCard = makeGeneratedCard({ cardNumber: 0, prompt: 'My custom prompt' });
    const store = makeStoreMock({
      getGeneratedCard: vi.fn().mockReturnValue(existingCard),
    });
    vi.mocked(useStore).mockReturnValue(store as any);

    const { result } = renderHook(() => useCardGeneration());

    await act(async () => {
      await result.current.generateSingleCard(0);
    });

    const saved = store.addGeneratedCard.mock.calls[0][0] as GeneratedCard;
    expect(saved.prompt).toBe('My custom prompt');
  });

  it('uses generic status message when no progressContext is provided', async () => {
    const store = makeStoreMock();
    vi.mocked(useStore).mockReturnValue(store as any);

    const { result } = renderHook(() => useCardGeneration());

    await act(async () => {
      await result.current.generateSingleCard(0);
    });

    const firstProgress = store.setGenerationProgress.mock.calls[0][0];
    expect(firstProgress.status).toContain('The Fool');
    expect(firstProgress.status).not.toMatch(/\d+\/\d+/); // no "1/5" style context
  });

  it('uses batch status message when progressContext is provided', async () => {
    const store = makeStoreMock();
    vi.mocked(useStore).mockReturnValue(store as any);

    const { result } = renderHook(() => useCardGeneration());

    await act(async () => {
      await result.current.generateSingleCard(0, { current: 2, total: 10, cardName: 'The Fool' });
    });

    const firstProgress = store.setGenerationProgress.mock.calls[0][0];
    expect(firstProgress.status).toContain('3/10'); // baseCurrent+1 / total
    expect(firstProgress.total).toBe(10);
  });
});

// ─── generateVideo ───────────────────────────────────────────────────────────

describe('generateVideo', () => {
  it('generates video and updates the card in the store', async () => {
    const existingCard = makeGeneratedCard({ cardNumber: 0, frames: ['data:image/jpeg;base64,ref'] });
    const store = makeStoreMock({
      getGeneratedCard: vi.fn().mockReturnValue(existingCard),
    });
    vi.mocked(useStore).mockReturnValue(store as any);

    const { result } = renderHook(() => useCardGeneration());

    await act(async () => {
      await result.current.generateVideo(0);
    });

    expect(generateVideoFromImage).toHaveBeenCalledOnce();
    expect(store.addGeneratedCard).toHaveBeenCalledOnce();

    const saved = store.addGeneratedCard.mock.calls[0][0] as GeneratedCard;
    expect(saved.videoUrl).toBe('https://example.com/video.mp4');
    expect(saved.cardNumber).toBe(0);
    expect(store.setIsGenerating).toHaveBeenLastCalledWith(false);
    expect(result.current.error).toBeNull();
  });

  it('sets error when no existing card has a reference image', async () => {
    const store = makeStoreMock({
      getGeneratedCard: vi.fn().mockReturnValue(undefined),
    });
    vi.mocked(useStore).mockReturnValue(store as any);

    const { result } = renderHook(() => useCardGeneration());

    await act(async () => {
      await result.current.generateVideo(0);
    });

    expect(result.current.error).toContain('No reference image');
    expect(generateVideoFromImage).not.toHaveBeenCalled();
    expect(store.setIsGenerating).toHaveBeenLastCalledWith(false);
  });

  it('sets error when existing card has empty frames', async () => {
    const store = makeStoreMock({
      getGeneratedCard: vi.fn().mockReturnValue(makeGeneratedCard({ frames: [] })),
    });
    vi.mocked(useStore).mockReturnValue(store as any);

    const { result } = renderHook(() => useCardGeneration());

    await act(async () => {
      await result.current.generateVideo(0);
    });

    expect(result.current.error).toContain('No reference image');
  });

  it('sets error when video API returns an error', async () => {
    vi.mocked(generateVideoFromImage).mockResolvedValueOnce({ error: 'Rate limit hit' });
    const store = makeStoreMock({
      getGeneratedCard: vi.fn().mockReturnValue(makeGeneratedCard()),
    });
    vi.mocked(useStore).mockReturnValue(store as any);

    const { result } = renderHook(() => useCardGeneration());

    await act(async () => {
      await result.current.generateVideo(0);
    });

    expect(result.current.error).toContain('Rate limit hit');
    expect(store.addGeneratedCard).not.toHaveBeenCalled();
    expect(store.setIsGenerating).toHaveBeenLastCalledWith(false);
  });

  it('sets error for an unknown card number', async () => {
    const { result } = renderHook(() => useCardGeneration());

    await act(async () => {
      await result.current.generateVideo(999);
    });

    expect(result.current.error).toContain('Card 999 not found');
  });
});

// ─── generateAllCards ────────────────────────────────────────────────────────

describe('generateAllCards', () => {
  it('calls generateCardFrames for each card and adds all to store', async () => {
    const store = makeStoreMock();
    vi.mocked(useStore).mockReturnValue(store as any);

    const { result } = renderHook(() => useCardGeneration());

    const promise = act(async () => {
      const p = result.current.generateAllCards();
      await vi.runAllTimersAsync();
      await p;
    });
    await promise;

    // 2 mocked cards → 2 frames generated → 2 store writes
    expect(generateCardFrames).toHaveBeenCalledTimes(2);
    expect(store.addGeneratedCard).toHaveBeenCalledTimes(2);
    expect(store.setIsGenerating).toHaveBeenLastCalledWith(false);
  });

  it('continues generating remaining cards after one fails', async () => {
    vi.mocked(generateCardFrames)
      .mockRejectedValueOnce(new Error('API error on card 0'))
      .mockResolvedValueOnce(['data:image/jpeg;base64,frame1']);

    const store = makeStoreMock();
    vi.mocked(useStore).mockReturnValue(store as any);

    const { result } = renderHook(() => useCardGeneration());

    const promise = act(async () => {
      const p = result.current.generateAllCards();
      await vi.runAllTimersAsync();
      await p;
    });
    await promise;

    // First card failed, second succeeded
    expect(store.addGeneratedCard).toHaveBeenCalledTimes(1);
    const saved = store.addGeneratedCard.mock.calls[0][0] as GeneratedCard;
    expect(saved.cardNumber).toBe(1);
  });

  it('sets final progress to total cards on completion', async () => {
    const store = makeStoreMock();
    vi.mocked(useStore).mockReturnValue(store as any);

    const { result } = renderHook(() => useCardGeneration());

    const promise = act(async () => {
      const p = result.current.generateAllCards();
      await vi.runAllTimersAsync();
      await p;
    });
    await promise;

    const lastProgress = store.setGenerationProgress.mock.calls.at(-1)[0];
    expect(lastProgress.current).toBe(2); // 2 mocked cards
    expect(lastProgress.total).toBe(2);
    expect(lastProgress.status).toContain('All cards generated');
  });
});

// ─── generateAllVideos ───────────────────────────────────────────────────────

describe('generateAllVideos', () => {
  it('skips cards with no reference image and lists them in failures', async () => {
    // No existing cards in store → no reference images
    const store = makeStoreMock({
      getGeneratedCard: vi.fn().mockReturnValue(undefined),
    });
    vi.mocked(useStore).mockReturnValue(store as any);

    const { result } = renderHook(() => useCardGeneration());

    await act(async () => {
      await result.current.generateAllVideos();
    });

    expect(generateVideoFromImage).not.toHaveBeenCalled();
    expect(result.current.error).toContain('Failed:');
  });

  it('skips cards that already have a videoUrl (cache hit)', async () => {
    const cachedCard = makeGeneratedCard({
      frames: ['data:image/jpeg;base64,ref'],
      videoUrl: 'https://example.com/cached.mp4',
    });
    const store = makeStoreMock({
      getGeneratedCard: vi.fn().mockReturnValue(cachedCard),
    });
    vi.mocked(useStore).mockReturnValue(store as any);

    const { result } = renderHook(() => useCardGeneration());

    await act(async () => {
      await result.current.generateAllVideos();
    });

    expect(generateVideoFromImage).not.toHaveBeenCalled();
    expect(store.addGeneratedCard).not.toHaveBeenCalled();
  });

  it('generates videos for eligible cards and saves them to the store', async () => {
    const cardWithImage = makeGeneratedCard({ frames: ['data:image/jpeg;base64,ref'] });
    const store = makeStoreMock({
      getGeneratedCard: vi.fn().mockReturnValue(cardWithImage),
    });
    vi.mocked(useStore).mockReturnValue(store as any);

    const { result } = renderHook(() => useCardGeneration());

    const promise = act(async () => {
      const p = result.current.generateAllVideos();
      await vi.runAllTimersAsync();
      await p;
    });
    await promise;

    expect(generateVideoFromImage).toHaveBeenCalledTimes(2); // 2 mocked cards
    expect(store.addGeneratedCard).toHaveBeenCalledTimes(2);

    const saved = store.addGeneratedCard.mock.calls[0][0] as GeneratedCard;
    expect(saved.videoUrl).toBe('https://example.com/video.mp4');
  });

  it('continues after a video failure and records it in the error summary', async () => {
    const cardWithImage = makeGeneratedCard({ frames: ['data:image/jpeg;base64,ref'] });
    const store = makeStoreMock({
      getGeneratedCard: vi.fn().mockReturnValue(cardWithImage),
    });
    vi.mocked(useStore).mockReturnValue(store as any);

    vi.mocked(generateVideoFromImage)
      .mockResolvedValueOnce({ error: 'Quota exceeded' }) // card 0 fails
      .mockResolvedValueOnce({ videoUrl: 'https://example.com/video.mp4' }); // card 1 succeeds

    const { result } = renderHook(() => useCardGeneration());

    const promise = act(async () => {
      const p = result.current.generateAllVideos();
      await vi.runAllTimersAsync();
      await p;
    });
    await promise;

    // Card 1 still saves despite card 0 failing
    expect(store.addGeneratedCard).toHaveBeenCalledTimes(1);
    expect(result.current.error).toContain('Failed');
  });

  it('reports correct final status when all videos are generated', async () => {
    const cardWithImage = makeGeneratedCard({ frames: ['data:image/jpeg;base64,ref'] });
    const store = makeStoreMock({
      getGeneratedCard: vi.fn().mockReturnValue(cardWithImage),
    });
    vi.mocked(useStore).mockReturnValue(store as any);

    const { result } = renderHook(() => useCardGeneration());

    const promise = act(async () => {
      const p = result.current.generateAllVideos();
      await vi.runAllTimersAsync();
      await p;
    });
    await promise;

    const lastProgress = store.setGenerationProgress.mock.calls.at(-1)[0];
    expect(lastProgress.status).toBe('All videos generated!');
    expect(result.current.error).toBeNull();
  });

  it('reports mixed status when some cached and some generated', async () => {
    // Card 0: has existing video (skip/cached), Card 1: has image only (generate)
    const cachedCard = makeGeneratedCard({ videoUrl: 'https://example.com/cached.mp4', frames: ['f'] });
    const freshCard = makeGeneratedCard({ cardNumber: 1, frames: ['data:image/jpeg;base64,ref'] });

    const store = makeStoreMock({
      getGeneratedCard: vi.fn()
        .mockReturnValueOnce(cachedCard)  // card 0
        .mockReturnValueOnce(freshCard),  // card 1
    });
    vi.mocked(useStore).mockReturnValue(store as any);

    const { result } = renderHook(() => useCardGeneration());

    const promise = act(async () => {
      const p = result.current.generateAllVideos();
      await vi.runAllTimersAsync();
      await p;
    });
    await promise;

    const lastProgress = store.setGenerationProgress.mock.calls.at(-1)[0];
    expect(lastProgress.status).toContain('generated');
    expect(lastProgress.status).toContain('cached');
  });
});
