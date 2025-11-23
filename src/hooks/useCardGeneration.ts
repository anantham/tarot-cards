import { useState } from 'react';
import { useStore } from '../store/useStore';
import { generateCardFrames } from '../utils/imageGeneration';
import { generateGIF } from '../utils/gifGenerator';
import tarotData from '../data/tarot-decks.json';
import type { TarotCard, GeneratedCard } from '../types';

export function useCardGeneration() {
  const {
    settings,
    addGeneratedCard,
    setIsGenerating,
    setGenerationProgress,
  } = useStore();

  const [error, setError] = useState<string | null>(null);

  /**
   * Generate a single card
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
        total: settings.framesPerCard,
        status: `Generating ${card.traditional.name}...`,
      });

      // Generate frames
      const frames = await generateCardFrames(
        card,
        settings.selectedDeckType,
        settings.framesPerCard,
        settings,
        (current, total) => {
          setGenerationProgress({
            current,
            total,
            status: `Generating ${card.traditional.name} (frame ${current}/${total})`,
          });
        }
      );

      // Generate GIF if multiple frames
      let gifUrl: string | undefined;
      if (frames.length > 1) {
        setGenerationProgress({
          current: settings.framesPerCard,
          total: settings.framesPerCard,
          status: `Creating animated GIF for ${card.traditional.name}...`,
        });

        gifUrl = await generateGIF(frames);
      }

      // Save to store
      const generatedCard: GeneratedCard = {
        cardNumber,
        deckType: settings.selectedDeckType,
        frames,
        gifUrl,
        timestamp: Date.now(),
      };

      addGeneratedCard(generatedCard);

      setGenerationProgress({
        current: settings.framesPerCard,
        total: settings.framesPerCard,
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
   * Generate all 22 cards
   */
  const generateAllCards = async (): Promise<void> => {
    try {
      setError(null);
      setIsGenerating(true);

      const cards = tarotData.cards as TarotCard[];

      for (let i = 0; i < cards.length; i++) {
        const card = cards[i];

        setGenerationProgress({
          current: i * settings.framesPerCard,
          total: cards.length * settings.framesPerCard,
          status: `Generating card ${i + 1}/${cards.length}: ${card.traditional.name}`,
        });

        await generateSingleCard(card.number);

        // Delay between cards to avoid rate limiting
        if (i < cards.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }
      }

      setGenerationProgress({
        current: cards.length * settings.framesPerCard,
        total: cards.length * settings.framesPerCard,
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

  return {
    generateSingleCard,
    generateAllCards,
    error,
  };
}
