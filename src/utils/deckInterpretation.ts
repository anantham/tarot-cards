import type { CardInterpretation, TarotCard } from '../types';

export function getInterpretationForDeck(card: TarotCard, deckType: string): CardInterpretation {
  switch (deckType) {
    case 'lord-of-mysteries-masterpiece':
      return card.lordOfMysteriesMasterpiece || card.lordOfMysteries;
    case 'lord-of-mysteries':
      return card.lordOfMysteries;
    case 'traditional-rider-waite':
      return card.traditional;
    case 'egyptian-tarot':
      return card.egyptian;
    case 'celtic-tarot':
      return card.celtic;
    case 'japanese-shinto':
      return card.shinto;
    case 'advaita-vedanta':
      return card.advaita;
    case 'buddhist':
      return card.traditional;
    default:
      return card.traditional;
  }
}
