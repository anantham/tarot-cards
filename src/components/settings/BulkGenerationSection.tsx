type BulkGenerationSectionProps = {
  isGenerating: boolean;
  hasImageApiKey: boolean;
  hasGeminiApiKey: boolean;
  missingApiKeyMessage: string;
  onGenerateAllCards: () => void;
  onClearCache: () => void;
  onGenerateAllVideos: () => void;
};

export function BulkGenerationSection({
  isGenerating,
  hasImageApiKey,
  hasGeminiApiKey,
  missingApiKeyMessage,
  onGenerateAllCards,
  onClearCache,
  onGenerateAllVideos,
}: BulkGenerationSectionProps) {
  return (
    <>
      <section>
        <div
          style={{
            padding: '1.5rem',
            background: 'rgba(147, 51, 234, 0.1)',
            border: '1px solid rgba(147, 51, 234, 0.3)',
            borderRadius: '12px',
          }}
        >
          <h3 style={{ fontSize: '1.2rem', marginBottom: '0.75rem' }}>
            Generate All 22 Cards
          </h3>
          <p style={{ fontSize: '0.9rem', marginBottom: '1.5rem', opacity: 0.8 }}>
            This will generate all 22 Major Arcana cards with your photo. Make sure to test one card first!
          </p>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <button
              onClick={onGenerateAllCards}
              disabled={isGenerating || !hasImageApiKey}
              style={{
                flex: 1,
                padding: '1rem 2rem',
                background: isGenerating || !hasImageApiKey ? 'rgba(100, 100, 100, 0.5)' : 'linear-gradient(135deg, #9333ea 0%, #7c3aed 100%)',
                border: 'none',
                borderRadius: '8px',
                color: '#ffffff',
                fontSize: '1rem',
                fontWeight: '600',
                cursor: isGenerating || !hasImageApiKey ? 'not-allowed' : 'pointer',
                boxShadow: '0 4px 15px rgba(147, 51, 234, 0.4)',
                opacity: isGenerating || !hasImageApiKey ? 0.6 : 1,
              }}
            >
              {isGenerating ? '⏳ Generating...' : '🎴 Generate All Cards'}
            </button>
            <button
              onClick={onClearCache}
              style={{
                padding: '1rem 1.5rem',
                background: 'rgba(255, 0, 0, 0.2)',
                border: '1px solid rgba(255, 0, 0, 0.3)',
                borderRadius: '8px',
                color: '#e8e8e8',
                fontSize: '0.95rem',
                cursor: 'pointer',
              }}
            >
              🗑️ Clear Cache
            </button>
          </div>
          {!hasImageApiKey && (
            <p style={{ marginTop: '0.75rem', fontSize: '0.85rem', color: '#ffb347' }}>
              {missingApiKeyMessage}
            </p>
          )}
        </div>
      </section>

      <section>
        <div
          style={{
            padding: '1.5rem',
            background: 'rgba(212, 175, 55, 0.08)',
            border: '1px solid rgba(212, 175, 55, 0.3)',
            borderRadius: '12px',
          }}
        >
          <h3 style={{ fontSize: '1.2rem', marginBottom: '0.75rem' }}>
            Generate Videos for Whole Deck
          </h3>
          <p style={{ fontSize: '0.9rem', marginBottom: '1.5rem', opacity: 0.8 }}>
            Uses the first generated frame of each card to create an 8s Veo video. Cards without images are skipped.
          </p>
          <div style={{ fontSize: '0.85rem', marginBottom: '1rem', opacity: 0.7 }}>
            Videos are throttled to about 2 requests per minute to avoid Gemini rate limits (daily cap is often ~10 videos).
          </div>
          <button
            onClick={onGenerateAllVideos}
            disabled={isGenerating || !hasGeminiApiKey}
            style={{
              width: '100%',
              padding: '1rem 2rem',
              background: isGenerating || !hasGeminiApiKey ? 'rgba(100, 100, 100, 0.5)' : 'linear-gradient(135deg, #d4af37 0%, #b98c28 100%)',
              border: 'none',
              borderRadius: '8px',
              color: '#ffffff',
              fontSize: '1rem',
              fontWeight: '600',
              cursor: isGenerating || !hasGeminiApiKey ? 'not-allowed' : 'pointer',
              boxShadow: '0 4px 15px rgba(212, 175, 55, 0.35)',
              opacity: isGenerating || !hasGeminiApiKey ? 0.6 : 1,
            }}
          >
            {isGenerating ? '⏳ Generating videos...' : '🎥 Generate All Videos (Veo 3.1)'}
          </button>
          {!hasGeminiApiKey && (
            <div style={{ marginTop: '0.75rem', fontSize: '0.85rem', color: '#ffb347' }}>
              Gemini API key required for video generation.
            </div>
          )}
        </div>
      </section>
    </>
  );
}
