import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Settings, GeneratedCard, TarotCard } from '../types';
import tarotData from '../data/tarot-decks.json';
import { getAllGeneratedCards, putGeneratedCard, clearGeneratedCardsStore } from '../utils/idb';

interface StoreState {
  // Settings
  settings: Settings;
  updateSettings: (settings: Partial<Settings>) => void;

  // Generated cards cache
  generatedCards: GeneratedCard[];
  addGeneratedCard: (card: GeneratedCard) => void;
  getGeneratedCard: (cardNumber: number, deckType: string) => GeneratedCard | undefined;
  getAllGenerationsForCard: (cardNumber: number, deckType: string) => GeneratedCard[];
  deleteGeneratedCard: (timestamp: number) => void;
  clearGeneratedCards: () => void;

  // UI State
  selectedCard: TarotCard | null;
  setSelectedCard: (card: TarotCard | null) => void;
  isGenerating: boolean;
  setIsGenerating: (generating: boolean) => void;
  showSettings: boolean;
  setShowSettings: (show: boolean) => void;
  returnToSettingsOnClose: boolean;
  setReturnToSettingsOnClose: (value: boolean) => void;

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
    (set, get) => {
      // Load any previously stored generations from IndexedDB
      getAllGeneratedCards().then((cards) => set({ generatedCards: cards })).catch(() => {});

      return {
        // Initial settings
        settings: tarotData.defaultSettings as Settings,

        updateSettings: (newSettings) =>
          set((state) => ({
            settings: { ...state.settings, ...newSettings },
          })),

        // Generated cards (persisted in IndexedDB)
        generatedCards: [],

        addGeneratedCard: (card) =>
          set((state) => {
            const updated = [...state.generatedCards, card];
            void putGeneratedCard(card);
            return { generatedCards: updated };
          }),

        getGeneratedCard: (cardNumber, deckType) => {
          const cards = get().generatedCards
            .filter((c) => c.cardNumber === cardNumber && c.deckType === deckType)
            .sort((a, b) => b.timestamp - a.timestamp);
          return cards[0];
        },

        getAllGenerationsForCard: (cardNumber, deckType) => {
          return get().generatedCards
            .filter((c) => c.cardNumber === cardNumber && c.deckType === deckType)
            .sort((a, b) => b.timestamp - a.timestamp);
        },

        deleteGeneratedCard: (timestamp) => {
          const updated = get().generatedCards.filter((c) => c.timestamp !== timestamp);
          set({ generatedCards: updated });
          // No direct delete by timestamp in IDB store; rewrite the store
          updated.forEach((card) => void putGeneratedCard(card));
        },

        clearGeneratedCards: () => {
          void clearGeneratedCardsStore();
          set({ generatedCards: [] });
        },

        // UI State
        selectedCard: null,
        setSelectedCard: (card) => set({ selectedCard: card }),

        isGenerating: false,
        setIsGenerating: (generating) => set({ isGenerating: generating }),

        showSettings: false,
        setShowSettings: (show) => set({ showSettings: show }),
        returnToSettingsOnClose: false,
        setReturnToSettingsOnClose: (value) => set({ returnToSettingsOnClose: value }),

        generationProgress: {
          current: 0,
          total: 0,
          status: '',
        },
        setGenerationProgress: (progress) => set({ generationProgress: progress }),
      };
    },
    {
      name: 'tarot-cards-storage',
      partialize: (state) => ({
        // Keep only lightweight settings in localStorage; generated cards live in IndexedDB
        settings: state.settings,
      }),
    }
  )
);
