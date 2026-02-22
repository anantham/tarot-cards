import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Settings, GeneratedCard, TarotCard } from '../types';
import tarotData from '../data/tarot-decks.json';
import { getAllGeneratedCards, putGeneratedCard, clearGeneratedCardsStore, deleteGeneratedCardFromStore } from '../utils/idb';

// Prefer explicitly-exposed VITE_* defaults when available.
const envOpenrouterKey = (import.meta as any).env?.VITE_OPENROUTER_API_KEY;
const envGeminiKey = (import.meta as any).env?.VITE_GEMINI_API_KEY;
const envOpenrouterEndpoint = (import.meta as any).env?.VITE_OPENROUTER_API_ENDPOINT;

const applyEnvDefaults = (settings: Settings): Settings => {
  const next = { ...settings };
  if (envOpenrouterKey && next.apiKey === undefined) next.apiKey = envOpenrouterKey;
  if (envGeminiKey && next.geminiApiKey === undefined) next.geminiApiKey = envGeminiKey;
  if (envOpenrouterEndpoint && next.apiEndpoint === undefined) next.apiEndpoint = envOpenrouterEndpoint;
  return next;
};

const defaultSettings = applyEnvDefaults(tarotData.defaultSettings as Settings);

interface StoreState {
  // Settings
  settings: Settings;
  updateSettings: (settings: Partial<Settings>) => void;

  // Generated cards cache
  generatedCards: GeneratedCard[];
  addGeneratedCard: (card: GeneratedCard) => void;
  updateGeneratedCard: (updated: GeneratedCard) => void;
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
        settings: defaultSettings,

        updateSettings: (newSettings) =>
          set((state) => ({
            settings: { ...state.settings, ...newSettings },
          })),

        // Generated cards (persisted in IndexedDB)
        generatedCards: [],

        addGeneratedCard: (card) =>
          set((state) => {
            // Ensure new fields have defaults
            const fullCard: GeneratedCard = {
              ...card,
              shared: card.shared ?? false,
              source: card.source ?? 'local',
            };
            const updated = [...state.generatedCards, fullCard];
            void putGeneratedCard(fullCard);
            return { generatedCards: updated };
          }),

        updateGeneratedCard: (updatedCard) =>
          set((state) => {
            const updatedList = state.generatedCards.map((c) =>
              c.timestamp === updatedCard.timestamp ? { ...c, ...updatedCard } : c
            );
            void putGeneratedCard(updatedCard);
            return { generatedCards: updatedList };
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
          void deleteGeneratedCardFromStore(timestamp).catch(() => {});
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
      merge: (persistedState, currentState) => {
        const merged = { ...currentState, ...(persistedState as any) };
        const persistedSettings = (persistedState as any)?.settings as Settings | undefined;

        merged.settings = applyEnvDefaults({
          ...currentState.settings,
          ...(persistedSettings || {}),
        });

        return merged;
      },
      partialize: (state) => ({
        // Keep only lightweight settings in localStorage; generated cards live in IndexedDB
        settings: {
          ...state.settings,
          // Avoid persisting raw API keys in browser localStorage.
          apiKey: undefined,
          geminiApiKey: undefined,
        },
      }),
    }
  )
);
