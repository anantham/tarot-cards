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
  advaita: CardInterpretation;
  personalLore: string;
}

export interface ReferenceImage {
  id: string;
  dataUrl: string;
  instruction: string;
  type: 'face' | 'body' | 'style' | 'background' | 'custom';
  required?: boolean;
}

export interface PromptTemplates {
  baseTemplate: string;
  framingTemplate: string;
  faceReferenceInstruction: string;
  styleReferenceInstruction: string;
  poseReferenceInstruction: string;
  defaultPromptSuffix: string;
  loreContextTemplate: string;
}

export interface Settings {
  userPhoto: string;
  usePhoto?: boolean;
  referenceImages?: ReferenceImage[];
  selectedDeckType: string;
  framesPerCard: number;
  generationModel: string;
  promptSuffix: string;
  promptTemplates?: PromptTemplates;
  apiProvider: 'openrouter' | 'gemini';
  apiEndpoint: string;
  apiKey?: string;
  geminiApiKey?: string;
  imageSize?: '1K' | '2K';
  showCardInfo?: boolean;
  animateCards?: boolean;
  navigateWithArrows?: boolean;
  autoShareEnabled?: boolean;     // NEW
  displayName?: string;           // NEW
  lastSharedTimestamp?: number;   // NEW
}

export interface GeneratedCard {
  cardNumber: number;
  deckType: string;
  frames: string[]; // URLs to generated images
  gifUrl?: string;
  videoUrl?: string;
  timestamp: number;
  shared?: boolean;         // NEW: has been uploaded to IPFS
  source?: 'local' | 'community';  // NEW: origin of card
  bundleCID?: string;      // NEW: IPFS bundle CID if from community
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

export interface GalleryBundle {
  cid: string;
  author?: string;
  cardCount: number;
  timestamp: number;
  deckTypes: string[];
}

export interface IPFSCardPackage {
  author?: string;
  timestamp: number;
  version: string;
  cards: Array<{
    cardNumber: number;
    deckType: string;
    cardName: string;
    imageData: string;     // base64 or data URL
    videoData?: string;    // base64 or data URL
    metadata: {
      generatedAt: number;
      model: string;
    };
  }>;
}
