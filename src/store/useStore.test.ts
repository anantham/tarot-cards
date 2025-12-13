import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';

// Mock IndexedDB operations
vi.mock('../utils/idb', () => ({
  getAllGeneratedCards: vi.fn().mockResolvedValue([]),
  putGeneratedCard: vi.fn().mockResolvedValue(undefined),
  clearGeneratedCardsStore: vi.fn().mockResolvedValue(undefined),
}));

// Import after mocking
import { useStore } from './useStore';
import type { GeneratedCard, TarotCard } from '../types';

describe('useStore', () => {
  beforeEach(() => {
    // Reset store state between tests
    const { result } = renderHook(() => useStore());
    act(() => {
      result.current.clearGeneratedCards();
      result.current.setSelectedCard(null);
      result.current.setIsGenerating(false);
      result.current.setShowSettings(false);
    });
  });

  describe('settings', () => {
    it('should have default settings', () => {
      const { result } = renderHook(() => useStore());
      
      expect(result.current.settings).toBeDefined();
      expect(result.current.settings.selectedDeckType).toBeDefined();
    });

    it('should update settings partially', () => {
      const { result } = renderHook(() => useStore());
      
      act(() => {
        result.current.updateSettings({ navigateWithArrows: true });
      });

      expect(result.current.settings.navigateWithArrows).toBe(true);
    });
  });

  describe('selectedCard', () => {
    it('should start with no selected card', () => {
      const { result } = renderHook(() => useStore());
      expect(result.current.selectedCard).toBeNull();
    });

    it('should set and clear selected card', () => {
      const { result } = renderHook(() => useStore());
      
      const mockCard = { number: 0, traditional: { name: 'The Fool' } } as TarotCard;
      
      act(() => {
        result.current.setSelectedCard(mockCard);
      });
      
      expect(result.current.selectedCard).toEqual(mockCard);

      act(() => {
        result.current.setSelectedCard(null);
      });

      expect(result.current.selectedCard).toBeNull();
    });
  });

  describe('generatedCards', () => {
    const mockGeneratedCard: GeneratedCard = {
      cardNumber: 0,
      deckType: 'traditional-rider-waite',
      timestamp: Date.now(),
      frames: ['frame1.jpg', 'frame2.jpg'],
      gifUrl: 'animation.gif',
      prompt: 'A mystical fool',
      shared: false,
      source: 'local',
    };

    it('should add a generated card', () => {
      const { result } = renderHook(() => useStore());
      
      act(() => {
        result.current.addGeneratedCard(mockGeneratedCard);
      });

      expect(result.current.generatedCards).toHaveLength(1);
      expect(result.current.generatedCards[0].cardNumber).toBe(0);
    });

    it('should get generated card by number and deck type', () => {
      const { result } = renderHook(() => useStore());
      
      act(() => {
        result.current.addGeneratedCard(mockGeneratedCard);
      });

      const found = result.current.getGeneratedCard(0, 'traditional-rider-waite');
      expect(found).toBeDefined();
      expect(found?.cardNumber).toBe(0);

      const notFound = result.current.getGeneratedCard(1, 'traditional-rider-waite');
      expect(notFound).toBeUndefined();
    });

    it('should get all generations for a card sorted by timestamp (newest first)', () => {
      const { result } = renderHook(() => useStore());
      
      const olderCard = { ...mockGeneratedCard, timestamp: 1000 };
      const newerCard = { ...mockGeneratedCard, timestamp: 2000 };
      
      act(() => {
        result.current.addGeneratedCard(olderCard);
        result.current.addGeneratedCard(newerCard);
      });

      const generations = result.current.getAllGenerationsForCard(0, 'traditional-rider-waite');
      expect(generations).toHaveLength(2);
      expect(generations[0].timestamp).toBe(2000); // Newest first
      expect(generations[1].timestamp).toBe(1000);
    });

    it('should delete a generated card by timestamp', () => {
      const { result } = renderHook(() => useStore());
      
      act(() => {
        result.current.addGeneratedCard(mockGeneratedCard);
      });

      expect(result.current.generatedCards).toHaveLength(1);

      act(() => {
        result.current.deleteGeneratedCard(mockGeneratedCard.timestamp);
      });

      expect(result.current.generatedCards).toHaveLength(0);
    });

    it('should update a generated card', () => {
      const { result } = renderHook(() => useStore());
      
      act(() => {
        result.current.addGeneratedCard(mockGeneratedCard);
      });

      const updatedCard = { 
        ...mockGeneratedCard, 
        prompt: 'Updated prompt',
        shared: true,
      };

      act(() => {
        result.current.updateGeneratedCard(updatedCard);
      });

      const found = result.current.getGeneratedCard(0, 'traditional-rider-waite');
      expect(found?.prompt).toBe('Updated prompt');
      expect(found?.shared).toBe(true);
    });

    it('should clear all generated cards', () => {
      const { result } = renderHook(() => useStore());
      
      act(() => {
        result.current.addGeneratedCard(mockGeneratedCard);
        result.current.addGeneratedCard({ ...mockGeneratedCard, cardNumber: 1, timestamp: Date.now() + 1 });
      });

      expect(result.current.generatedCards).toHaveLength(2);

      act(() => {
        result.current.clearGeneratedCards();
      });

      expect(result.current.generatedCards).toHaveLength(0);
    });

    it('should default shared and source fields when adding card', () => {
      const { result } = renderHook(() => useStore());
      
      const cardWithoutDefaults = {
        cardNumber: 5,
        deckType: 'egyptian-tarot',
        timestamp: Date.now(),
        frames: ['frame.jpg'],
        prompt: 'Test',
        // shared and source omitted
      } as GeneratedCard;

      act(() => {
        result.current.addGeneratedCard(cardWithoutDefaults);
      });

      const found = result.current.getGeneratedCard(5, 'egyptian-tarot');
      expect(found?.shared).toBe(false);
      expect(found?.source).toBe('local');
    });
  });

  describe('UI state', () => {
    it('should track generation state', () => {
      const { result } = renderHook(() => useStore());
      
      expect(result.current.isGenerating).toBe(false);

      act(() => {
        result.current.setIsGenerating(true);
      });

      expect(result.current.isGenerating).toBe(true);
    });

    it('should track settings visibility', () => {
      const { result } = renderHook(() => useStore());
      
      expect(result.current.showSettings).toBe(false);

      act(() => {
        result.current.setShowSettings(true);
      });

      expect(result.current.showSettings).toBe(true);
    });

    it('should track generation progress', () => {
      const { result } = renderHook(() => useStore());
      
      expect(result.current.generationProgress.current).toBe(0);
      expect(result.current.generationProgress.total).toBe(0);

      act(() => {
        result.current.setGenerationProgress({
          current: 5,
          total: 22,
          status: 'Generating The Hierophant...',
        });
      });

      expect(result.current.generationProgress.current).toBe(5);
      expect(result.current.generationProgress.total).toBe(22);
      expect(result.current.generationProgress.status).toBe('Generating The Hierophant...');
    });
  });
});
