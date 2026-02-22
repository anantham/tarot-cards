import type { DeckType } from '../../types';

type CommunityDeckOption = {
  id: string;
  name: string;
  description: string;
};

type DeckTypeSectionProps = {
  combinedDecks: Array<DeckType | CommunityDeckOption>;
  selectedDeckType: string;
  onSelectDeck: (deckId: string) => void;
};

export function DeckTypeSection({
  combinedDecks,
  selectedDeckType,
  onSelectDeck,
}: DeckTypeSectionProps) {
  return (
    <section>
      <h3 style={{ fontSize: '1.3rem', marginBottom: '1rem', color: '#d4af37' }}>
        Deck Type
      </h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {combinedDecks.map((deck) => (
          <label
            key={deck.id}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '0.75rem',
              padding: '1rem',
              background: selectedDeckType === deck.id ? 'rgba(147, 51, 234, 0.2)' : 'rgba(255, 255, 255, 0.05)',
              border: `1px solid ${selectedDeckType === deck.id ? 'rgba(147, 51, 234, 0.5)' : 'rgba(255, 255, 255, 0.1)'}`,
              borderRadius: '8px',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
            }}
          >
            <input
              type="radio"
              name="deckType"
              value={deck.id}
              checked={selectedDeckType === deck.id}
              onChange={(e) => onSelectDeck(e.target.value)}
              style={{ marginTop: '0.25rem' }}
            />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '0.25rem' }}>
                {deck.name}
              </div>
              <div style={{ fontSize: '0.85rem', opacity: 0.7 }}>
                {deck.description}
              </div>
            </div>
          </label>
        ))}
      </div>
    </section>
  );
}
