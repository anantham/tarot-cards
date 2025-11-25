import { useState } from 'react';
import { useStore } from '../store/useStore';
import { generateCardFrames } from '../utils/imageGeneration';
import { generateVideoFromImage } from '../utils/videoGeneration';
import tarotData from '../data/tarot-decks.json';
import type { TarotCard, GeneratedCard } from '../types';

export function useCardGeneration() {
  const {
    settings,
    addGeneratedCard,
    setIsGenerating,
    setGenerationProgress,
    getGeneratedCard,
  } = useStore();

  const [error, setError] = useState<string | null>(null);

  /**
   * Generate a single card image (for video reference)
   */
  const generateSingleCard = async (cardNumber: number): Promise<void> => {
    try {
      setError(null);
      setIsGenerating(true);

      const cards = tarotData.cards as TarotCard[];
      const card = cards.find((c) => c.number === cardNumber);

      if (!card) {
        throw new Error(`Card ${cardNumber} not found`);
      }

      setGenerationProgress({
        current: 0,
        total: 1,
        status: `Generating ${card.traditional.name}...`,
      });

      // Generate single image (for video reference)
      const frames = await generateCardFrames(
        card,
        settings.selectedDeckType,
        1, // Always 1 frame now
        settings,
        (current, total) => {
          setGenerationProgress({
            current,
            total,
            status: `Generating ${card.traditional.name}...`,
          });
        }
      );

      // Save to store (keeping frames/gifUrl for backward compatibility)
      const generatedCard: GeneratedCard = {
        cardNumber,
        deckType: settings.selectedDeckType,
        frames,
        gifUrl: frames[0], // Use image as static "gif"
        timestamp: Date.now(),
      };

      addGeneratedCard(generatedCard);

      setGenerationProgress({
        current: 1,
        total: 1,
        status: 'Complete!',
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      console.error('Card generation error:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  /**
   * Generate short video (Veo 3.1) using first frame if available
   */
  const generateCardVideo = async (cardNumber: number): Promise<void> => {
    try {
      setError(null);
      setIsGenerating(true);

      const cards = tarotData.cards as TarotCard[];
      const card = cards.find((c) => c.number === cardNumber);
      if (!card) throw new Error(`Card ${cardNumber} not found`);

      const existing = getGeneratedCard(cardNumber, settings.selectedDeckType);
      const referenceImage = existing?.frames?.[0];

      const title = card.number === 0 ? '0 – THE FOOL' : `${card.traditional.name}`;
      const basePrompt =
        `8-second portrait (9:16) tarot card animation. Title: ${title}. ` +
        `${card.lordOfMysteries.prompt} Render the title clearly on the card. ` +
        'Subtle motion only: gentle fabric sway, tiny head turn, light shimmer of cosmic symbols. Camera steady.';

      setGenerationProgress({
        current: 0,
        total: 1,
        status: `Generating video for ${title}...`,
      });

      const videoResult = await generateVideoFromImage(basePrompt, referenceImage, settings);
      if (videoResult.error || !videoResult.videoUrl) {
        throw new Error(videoResult.error || 'No video URL returned');
      }

      const updated: GeneratedCard = {
        cardNumber,
        deckType: settings.selectedDeckType,
        frames: existing?.frames || [],
        gifUrl: existing?.gifUrl,
        videoUrl: videoResult.videoUrl,
        timestamp: Date.now(),
      };

      addGeneratedCard(updated);
      setGenerationProgress({
        current: 1,
        total: 1,
        status: 'Video complete',
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      console.error('Video generation error:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  /**
   * Generate all 22 cards (images only - use generateAllVideos for videos)
   */
  const generateAllCards = async (): Promise<void> => {
    try {
      setError(null);
      setIsGenerating(true);

      const cards = tarotData.cards as TarotCard[];

      for (let i = 0; i < cards.length; i++) {
        const card = cards[i];

        setGenerationProgress({
          current: i,
          total: cards.length,
          status: `Generating card ${i + 1}/${cards.length}: ${card.traditional.name}`,
        });

        await generateSingleCard(card.number);

        // Delay between cards to avoid rate limiting
        if (i < cards.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }
      }

      setGenerationProgress({
        current: cards.length,
        total: cards.length,
        status: 'All cards generated!',
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      console.error('All cards generation error:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  /**
   * Generate videos for all cards that already have at least one generated frame
   */
  const generateAllVideos = async (): Promise<void> => {
    try {
      setError(null);
      setIsGenerating(true);

      const cards = tarotData.cards as TarotCard[];
      const failures: string[] = [];
      const skipped: string[] = [];
      const rateLimitDelayMs = 35000; // ~2 requests per minute to stay under RPM

      for (let i = 0; i < cards.length; i++) {
        const card = cards[i];
        const existing = getGeneratedCard(card.number, settings.selectedDeckType);
        const referenceImage = existing?.frames?.[0];

        setGenerationProgress({
          current: i,
          total: cards.length,
          status: `Generating video ${i + 1}/${cards.length}: ${card.traditional.name}`,
        });

        if (!referenceImage) {
          failures.push(`${card.traditional.name} (no image yet)`);
          continue;
        }

        // Skip if video already exists (cache hit)
        if (existing?.videoUrl) {
          skipped.push(card.traditional.name);
          continue;
        }

        let requestedVideo = false;
        try {
          const title = card.number === 0 ? '0 – THE FOOL' : `${card.traditional.name}`;
          const basePrompt =
            `8-second portrait (9:16) tarot card animation. Title: ${title}. ` +
            `${card.lordOfMysteries.prompt} Render the title clearly on the card. ` +
            'Subtle motion only: gentle fabric sway, tiny head turn, light shimmer of cosmic symbols. Camera steady.';

          const videoResult = await generateVideoFromImage(basePrompt, referenceImage, settings);
          requestedVideo = true;
          if (videoResult.error || !videoResult.videoUrl) {
            throw new Error(videoResult.error || 'No video URL returned');
          }

          const updated: GeneratedCard = {
            cardNumber: card.number,
            deckType: settings.selectedDeckType,
            frames: existing.frames || [],
            gifUrl: existing.gifUrl,
            videoUrl: videoResult.videoUrl,
            timestamp: Date.now(),
          };

          addGeneratedCard(updated);
        } catch (innerErr) {
          failures.push(`${card.traditional.name} (${innerErr instanceof Error ? innerErr.message : 'error'})`);
          console.error('Video generation error:', innerErr);
        }

        if (i < cards.length - 1 && requestedVideo) {
          await new Promise((resolve) => setTimeout(resolve, rateLimitDelayMs));
        }
      }

      const generated = cards.length - failures.length - skipped.length;
      let statusMessage = '';
      if (failures.length === 0 && skipped.length === 0) {
        statusMessage = 'All videos generated!';
      } else {
        const parts: string[] = [];
        if (generated > 0) parts.push(`${generated} generated`);
        if (skipped.length > 0) parts.push(`${skipped.length} cached`);
        if (failures.length > 0) parts.push(`${failures.length} failed`);
        statusMessage = parts.join(', ');
      }

      setGenerationProgress({
        current: cards.length,
        total: cards.length,
        status: statusMessage,
      });

      if (failures.length > 0) {
        setError(`Failed: ${failures.join(', ')}`);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      console.error('All videos generation error:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  return {
    generateSingleCard,
    generateAllCards,
    generateAllVideos,
    error,
    generateVideo: generateCardVideo,
  };
}
