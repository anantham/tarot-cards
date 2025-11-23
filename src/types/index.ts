export interface DeckType {
  id: string;
  name: string;
  description: string;
}

export interface CardInterpretation {
  name?: string;
  pathway?: string;
  sequence?: string;
  deity?: string;
  figure?: string;
  kami?: string;
  keywords: string[];
  meaning?: string;
  abilities?: string;
  prompt: string;
}

export interface TarotCard {
  number: number;
  traditional: CardInterpretation;
  lordOfMysteries: CardInterpretation;
  egyptian: CardInterpretation;
  celtic: CardInterpretation;
  shinto: CardInterpretation;
  personalLore: string;
}

export interface Settings {
  userPhoto: string;
  selectedDeckType: string;
  framesPerCard: number;
  generationModel: string;
  promptSuffix: string;
  apiEndpoint: string;
  apiKey?: string;
}

export interface GeneratedCard {
  cardNumber: number;
  deckType: string;
  frames: string[]; // URLs to generated images
  gifUrl?: string;
  timestamp: number;
}

export interface TarotDeckData {
  deckTypes: DeckType[];
  cards: TarotCard[];
  defaultSettings: Settings;
  costEstimation: {
    [key: string]: {
      perImage: number;
      note: string;
    };
  };
}

export interface CardState {
  card: TarotCard;
  interpretation: CardInterpretation;
  deckType: string;
  generated?: GeneratedCard;
}
