import type { GeneratedCard, TarotCard, TarotDeckData } from '../../types';

type GeneratedCardsGallerySectionProps = {
  showGallery: boolean;
  galleryDeckFilter: string;
  generatedCards: GeneratedCard[];
  selectedDeckType: string;
  deckTypes: TarotDeckData['deckTypes'];
  cards: TarotCard[];
  onToggleGallery: () => void;
  onGalleryDeckFilterChange: (deck: string) => void;
  onOpenCard: (cardNumber: number) => void;
};

export function GeneratedCardsGallerySection({
  showGallery,
  galleryDeckFilter,
  generatedCards,
  selectedDeckType,
  deckTypes,
  cards,
  onToggleGallery,
  onGalleryDeckFilterChange,
  onOpenCard,
}: GeneratedCardsGallerySectionProps) {
  const filteredCards = galleryDeckFilter === 'all'
    ? generatedCards
    : generatedCards.filter((c) => c.deckType === galleryDeckFilter);

  const byCard: Record<number, GeneratedCard[]> = {};
  filteredCards.forEach((card) => {
    if (!byCard[card.cardNumber]) byCard[card.cardNumber] = [];
    byCard[card.cardNumber].push(card);
  });

  return (
    <section>
      <div
        onClick={onToggleGallery}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer',
          padding: '0.75rem 1rem',
          background: 'rgba(147, 51, 234, 0.1)',
          border: '1px solid rgba(147, 51, 234, 0.3)',
          borderRadius: '8px',
          marginBottom: showGallery ? '1rem' : '1.5rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <h3 style={{ fontSize: '1.3rem', margin: 0, color: '#9333ea' }}>
            Generated Cards Gallery
          </h3>
          <span
            style={{
              padding: '0.25rem 0.6rem',
              background: 'rgba(147, 51, 234, 0.3)',
              borderRadius: '12px',
              fontSize: '0.85rem',
              fontWeight: 'bold',
            }}
          >
            {galleryDeckFilter === 'all'
              ? generatedCards.length
              : `${filteredCards.length}/${generatedCards.length}`}
          </span>
        </div>
        <span style={{ fontSize: '1.5rem', color: '#9333ea' }}>
          {showGallery ? '−' : '+'}
        </span>
      </div>

      {showGallery && (
        <div
          style={{
            padding: '1.5rem',
            background: 'rgba(0, 0, 0, 0.2)',
            borderRadius: '8px',
            marginBottom: '1.5rem',
          }}
        >
          <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', alignItems: 'center' }}>
            <label style={{ fontSize: '0.9rem', opacity: 0.8 }}>Filter by deck:</label>
            <select
              value={galleryDeckFilter}
              onChange={(e) => onGalleryDeckFilterChange(e.target.value)}
              style={{
                padding: '0.5rem 0.75rem',
                background: 'rgba(0, 0, 0, 0.3)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                borderRadius: '6px',
                color: '#e8e8e8',
                fontSize: '0.9rem',
              }}
            >
              <option value="all">All decks</option>
              {deckTypes.map((deck) => (
                <option key={deck.id} value={deck.id}>{deck.name}</option>
              ))}
            </select>
          </div>

          {generatedCards.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem', opacity: 0.6 }}>
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🎴</div>
              <div style={{ fontSize: '1.1rem' }}>No cards generated yet</div>
              <div style={{ fontSize: '0.9rem', marginTop: '0.5rem' }}>
                Generate your first card to see it here
              </div>
            </div>
          ) : filteredCards.length === 0 ? (
            <div style={{ textAlign: 'center', opacity: 0.7, padding: '1rem' }}>
              No cards in this deck filter yet.
            </div>
          ) : (
            <>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
                  gap: '1rem',
                  marginBottom: '1rem',
                }}
              >
                {Object.keys(byCard)
                  .map(Number)
                  .sort((a, b) => a - b)
                  .map((cardNumber) => {
                    const versions = byCard[cardNumber].sort((a, b) => b.timestamp - a.timestamp);
                    const latestCard = versions[0];
                    const tarotCard = cards[cardNumber];

                    return (
                      <div
                        key={cardNumber}
                        onClick={() => {
                          if (!tarotCard) return;
                          onOpenCard(cardNumber);
                        }}
                        style={{
                          position: 'relative',
                          aspectRatio: '2/3',
                          borderRadius: '8px',
                          overflow: 'hidden',
                          cursor: 'pointer',
                          border: '2px solid rgba(147, 51, 234, 0.3)',
                          transition: 'all 0.2s ease',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.transform = 'scale(1.05)';
                          e.currentTarget.style.borderColor = 'rgba(147, 51, 234, 0.6)';
                          e.currentTarget.style.boxShadow = '0 8px 24px rgba(147, 51, 234, 0.4)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.transform = 'scale(1)';
                          e.currentTarget.style.borderColor = 'rgba(147, 51, 234, 0.3)';
                          e.currentTarget.style.boxShadow = 'none';
                        }}
                      >
                        {latestCard.gifUrl ? (
                          <img
                            src={latestCard.gifUrl}
                            alt={`Card ${cardNumber}`}
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          />
                        ) : latestCard.frames?.[0] ? (
                          <img
                            src={latestCard.frames[0]}
                            alt={`Card ${cardNumber}`}
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          />
                        ) : null}

                        <div
                          style={{
                            position: 'absolute',
                            top: '0.5rem',
                            left: '0.5rem',
                            padding: '0.25rem 0.5rem',
                            background: 'rgba(0, 0, 0, 0.7)',
                            borderRadius: '6px',
                            fontSize: '0.85rem',
                            fontWeight: 'bold',
                            color: '#d4af37',
                          }}
                        >
                          {cardNumber}
                        </div>

                        {versions.length > 1 && (
                          <div
                            style={{
                              position: 'absolute',
                              top: '0.5rem',
                              right: '0.5rem',
                              padding: '0.25rem 0.5rem',
                              background: 'rgba(147, 51, 234, 0.8)',
                              borderRadius: '6px',
                              fontSize: '0.75rem',
                              fontWeight: 'bold',
                            }}
                          >
                            ×{versions.length}
                          </div>
                        )}

                        {latestCard.videoUrl && (
                          <div
                            style={{
                              position: 'absolute',
                              bottom: '0.5rem',
                              right: '0.5rem',
                              padding: '0.25rem 0.5rem',
                              background: 'rgba(0, 0, 0, 0.7)',
                              borderRadius: '6px',
                              fontSize: '0.75rem',
                              fontWeight: 'bold',
                              color: '#d4af37',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.25rem',
                            }}
                          >
                            🎥 Video
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>

              <div
                style={{
                  padding: '1rem',
                  background: 'rgba(147, 51, 234, 0.1)',
                  borderRadius: '8px',
                  fontSize: '0.9rem',
                  opacity: 0.8,
                }}
              >
                <div><strong>📊 Statistics:</strong></div>
                <div style={{ marginTop: '0.5rem', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                  <div>
                    <div style={{ opacity: 0.7 }}>Total Generations:</div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#9333ea' }}>
                      {generatedCards.length}
                    </div>
                  </div>
                  <div>
                    <div style={{ opacity: 0.7 }}>Unique Cards:</div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#9333ea' }}>
                      {new Set(generatedCards.map((c) => c.cardNumber)).size}
                    </div>
                  </div>
                  <div>
                    <div style={{ opacity: 0.7 }}>Current Deck:</div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#9333ea' }}>
                      {generatedCards.filter((c) => c.deckType === selectedDeckType).length}
                    </div>
                  </div>
                </div>
                <div style={{ marginTop: '0.75rem', fontSize: '0.85rem', opacity: 0.6 }}>
                  💡 Tip: Click on any card to view all its generations. Navigate with left/right arrows.
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </section>
  );
}
