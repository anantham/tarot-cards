type TestGenerationSectionProps = {
  testCardNumber: number;
  isGenerating: boolean;
  hasImageApiKey: boolean;
  missingApiKeyMessage: string;
  onTestCardNumberChange: (value: number) => void;
  onGenerateSingleCard: () => void;
};

export function TestGenerationSection({
  testCardNumber,
  isGenerating,
  hasImageApiKey,
  missingApiKeyMessage,
  onTestCardNumberChange,
  onGenerateSingleCard,
}: TestGenerationSectionProps) {
  return (
    <section>
      <h3 style={{ fontSize: '1.3rem', marginBottom: '1rem', color: '#d4af37' }}>
        Test Generation
      </h3>
      <p style={{ fontSize: '0.9rem', marginBottom: '1rem', opacity: 0.8 }}>
        Generate one card first to test your photo and prompt before generating all 22 cards.
      </p>
      <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end' }}>
        <div style={{ flex: 1 }}>
          <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: '0.5rem', opacity: 0.9 }}>
            Test Card Number (0-21)
          </label>
          <input
            type="number"
            min="0"
            max="21"
            value={Number.isFinite(testCardNumber) ? testCardNumber : 0}
            onChange={(e) => {
              const next = e.target.value === '' ? 0 : parseInt(e.target.value, 10);
              onTestCardNumberChange(Number.isFinite(next) ? next : 0);
            }}
            style={{
              width: '100%',
              padding: '0.75rem',
              background: 'rgba(0, 0, 0, 0.3)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              borderRadius: '8px',
              color: '#e8e8e8',
              fontSize: '0.95rem',
            }}
          />
        </div>
        <button
          onClick={onGenerateSingleCard}
          disabled={isGenerating || !hasImageApiKey}
          style={{
            padding: '0.75rem 1.5rem',
            background: isGenerating || !hasImageApiKey ? 'rgba(100, 100, 100, 0.3)' : 'rgba(147, 51, 234, 0.3)',
            border: '1px solid rgba(147, 51, 234, 0.5)',
            borderRadius: '8px',
            color: '#e8e8e8',
            fontSize: '0.95rem',
            fontWeight: '500',
            cursor: isGenerating || !hasImageApiKey ? 'not-allowed' : 'pointer',
            whiteSpace: 'nowrap',
            opacity: isGenerating || !hasImageApiKey ? 0.5 : 1,
          }}
        >
          {isGenerating ? 'Generating...' : 'Generate 1 Card'}
        </button>
      </div>
      {!hasImageApiKey && (
        <p style={{ marginTop: '0.75rem', fontSize: '0.85rem', color: '#ffb347' }}>
          {missingApiKeyMessage}
        </p>
      )}
    </section>
  );
}
