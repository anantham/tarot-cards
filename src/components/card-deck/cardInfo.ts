import type { TarotCard } from '../../types';

export function getCardNameForDeck(card: TarotCard, deckType: string): string {
  const fallbackName = card.traditional.name || `Card ${card.number}`;
  if (deckType === 'lord-of-mysteries-masterpiece') {
    return (card.lordOfMysteriesMasterpiece && card.lordOfMysteriesMasterpiece.pathway) || fallbackName;
  }
  if (deckType === 'lord-of-mysteries') return card.lordOfMysteries.pathway || fallbackName;
  if (deckType === 'traditional-rider-waite') return fallbackName;
  if (deckType === 'egyptian-tarot') return card.egyptian.deity || fallbackName;
  if (deckType === 'celtic-tarot') return card.celtic.figure || fallbackName;
  if (deckType === 'japanese-shinto') return card.shinto.kami || fallbackName;
  if (deckType === 'advaita-vedanta') return card.advaita.name || fallbackName;
  return fallbackName;
}

export function getRandomKeywordForDeck(card: TarotCard, deckType: string): string {
  let keywords: string[] = [];

  if (deckType === 'lord-of-mysteries-masterpiece') keywords = card.lordOfMysteriesMasterpiece?.keywords || card.lordOfMysteries.keywords;
  else if (deckType === 'lord-of-mysteries') keywords = card.lordOfMysteries.keywords;
  else if (deckType === 'traditional-rider-waite') keywords = card.traditional.keywords;
  else if (deckType === 'egyptian-tarot') keywords = card.egyptian.keywords;
  else if (deckType === 'celtic-tarot') keywords = card.celtic.keywords;
  else if (deckType === 'japanese-shinto') keywords = card.shinto.keywords;
  else if (deckType === 'advaita-vedanta') keywords = card.advaita.keywords;

  return keywords[Math.floor(Math.random() * keywords.length)] || 'mystery';
}
