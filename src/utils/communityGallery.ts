import type { CommunityDeckGroup, CommunityGalleryRow, GeneratedCard } from '../types';

type CommunityRowWithDefaults = CommunityGalleryRow & {
  deckType: string;
  deckName: string;
  deckDescription: string;
  author: string;
};

function applyDeckDefaults(row: CommunityGalleryRow): CommunityRowWithDefaults {
  const deckType = row.deck_type || row.deckType || 'community';
  const deckName = row.deck_name || row.deckName || deckType || 'Community Deck';
  const deckDescription = row.deck_description || row.deckDescription || '';
  const author = row.author || 'Anonymous';
  return { ...row, deckType, deckName, deckDescription, author };
}

export function groupCommunityRows(rows: CommunityGalleryRow[]): CommunityDeckGroup[] {
  const byDeck: Record<string, CommunityDeckGroup> = {};
  const uncategorized: CommunityGalleryRow[] = [];

  rows.forEach((row) => {
    const withDefaults = applyDeckDefaults(row);
    const deckId = row.deck_id || row.deckId;

    if (!deckId) {
      uncategorized.push(withDefaults);
      return;
    }

    if (!byDeck[deckId]) {
      byDeck[deckId] = {
        id: deckId,
        deckId,
        deckType: withDefaults.deckType,
        deckName: withDefaults.deckName,
        deckDescription: withDefaults.deckDescription,
        author: withDefaults.author,
        timestamp: row.timestamp || Date.now(),
        cards: [],
      };
    }

    byDeck[deckId].cards.push(withDefaults);
  });

  const groups: CommunityDeckGroup[] = Object.values(byDeck);
  if (uncategorized.length > 0) {
    groups.push({
      id: 'uncategorized',
      deckId: null,
      deckType: 'community',
      deckName: 'Uncategorized (no deck id)',
      deckDescription: 'These uploads were missing a deck id; import individually or re-upload with a deck id.',
      author: 'Unknown',
      timestamp: Date.now(),
      cards: uncategorized,
    });
  }

  const merged: Record<string, CommunityDeckGroup> = {};
  groups.forEach((deck) => {
    const mergeKey = `${deck.deckName || ''}::${deck.deckType || ''}::${deck.author || ''}`;
    if (!merged[mergeKey]) {
      merged[mergeKey] = {
        ...deck,
        id: mergeKey,
        deckId: deck.deckId ?? mergeKey,
        cards: [...(deck.cards || [])],
      };
    } else {
      merged[mergeKey].cards.push(...(deck.cards || []));
      merged[mergeKey].timestamp = Math.min(merged[mergeKey].timestamp, deck.timestamp || Date.now());
    }
  });

  return Object.values(merged);
}

export function getCommunityLoadingId(bundle: CommunityGalleryRow): string {
  return bundle.id ? String(bundle.id) : bundle.cid || `${bundle.card_number}-${bundle.timestamp}`;
}

export function buildGeneratedCardFromCommunityRow(bundle: CommunityGalleryRow): GeneratedCard {
  const cardNumber = bundle.card_number ?? bundle.cardNumber;
  const deckType = bundle.deck_type ?? bundle.deckType;
  if (typeof cardNumber !== 'number' || !deckType) {
    throw new Error('Bundle missing required cardNumber/deckType');
  }

  const prompt = bundle.prompt || null;
  const deckPromptSuffix = bundle.deck_prompt_suffix || bundle.deckPromptSuffix || null;

  return {
    cardNumber,
    deckType,
    frames: bundle.frames || [],
    gifUrl: bundle.gif_url ?? bundle.gifUrl,
    videoUrl: bundle.video_url ?? bundle.videoUrl,
    timestamp: bundle.timestamp || Date.now(),
    shared: true,
    source: 'community',
    bundleCID: bundle.cid || undefined,
    prompt: prompt || undefined,
    deckPromptSuffix: deckPromptSuffix || undefined,
    deckId: bundle.deck_id ?? bundle.deckId,
    deckName: bundle.deck_name ?? bundle.deckName,
    deckDescription: bundle.deck_description ?? bundle.deckDescription,
    author: bundle.author || bundle.display_name || bundle.displayName,
  };
}
