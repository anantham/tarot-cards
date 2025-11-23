import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Settings, GeneratedCard, TarotCard } from '../types';
import tarotData from '../data/tarot-decks.json';

interface StoreState {
  // Settings
  settings: Settings;
  updateSettings: (settings: Partial<Settings>) => void;

  // Generated cards cache
  generatedCards: GeneratedCard[];
  addGeneratedCard: (card: GeneratedCard) => void;
  getGeneratedCard: (cardNumber: number, deckType: string) => GeneratedCard | undefined;
  clearGeneratedCards: () => void;

  // UI State
  selectedCard: TarotCard | null;
  setSelectedCard: (card: TarotCard | null) => void;
  isGenerating: boolean;
  setIsGenerating: (generating: boolean) => void;
  showSettings: boolean;
  setShowSettings: (show: boolean) => void;

  // Generation progress
  generationProgress: {
    current: number;
    total: number;
    status: string;
  };
  setGenerationProgress: (progress: { current: number; total: number; status: string }) => void;
}

export const useStore = create<StoreState>()(
  persist(
    (set, get) => ({
      // Initial settings
      settings: tarotData.defaultSettings as Settings,

      updateSettings: (newSettings) =>
        set((state) => ({
          settings: { ...state.settings, ...newSettings },
        })),

      // Generated cards
      generatedCards: [],

      addGeneratedCard: (card) =>
        set((state) => {
          // Remove existing card with same number and deck type
          const filtered = state.generatedCards.filter(
            (c) => !(c.cardNumber === card.cardNumber && c.deckType === card.deckType)
          );
          return { generatedCards: [...filtered, card] };
        }),

      getGeneratedCard: (cardNumber, deckType) => {
        return get().generatedCards.find(
          (c) => c.cardNumber === cardNumber && c.deckType === deckType
        );
      },

      clearGeneratedCards: () => set({ generatedCards: [] }),

      // UI State
      selectedCard: null,
      setSelectedCard: (card) => set({ selectedCard: card }),

      isGenerating: false,
      setIsGenerating: (generating) => set({ isGenerating: generating }),

      showSettings: false,
      setShowSettings: (show) => set({ showSettings: show }),

      generationProgress: {
        current: 0,
        total: 0,
        status: '',
      },
      setGenerationProgress: (progress) => set({ generationProgress: progress }),
    }),
    {
      name: 'tarot-cards-storage',
      partialize: (state) => ({
        settings: state.settings,
        generatedCards: state.generatedCards,
      }),
    }
  )
);
