import type { GeneratedCard, Settings } from '../../types';

type CommunitySharingSectionProps = {
  settings: Settings;
  selectedDeck: string;
  deckName: string;
  deckDescription: string;
  isUploading: boolean;
  uploadProgress: string;
  unsharedCount: number;
  generatedCards: GeneratedCard[];
  updateSettings: (patch: Partial<Settings>) => void;
  onDeckNameChange: (name: string) => void;
  onDeckDescriptionChange: (description: string) => void;
};

export function CommunitySharingSection({
  settings,
  selectedDeck,
  deckName,
  deckDescription,
  isUploading,
  uploadProgress,
  unsharedCount,
  generatedCards,
  updateSettings,
  onDeckNameChange,
  onDeckDescriptionChange,
}: CommunitySharingSectionProps) {
  return (
    <section
      style={{
        background: 'linear-gradient(135deg, rgba(147, 51, 234, 0.1), rgba(79, 70, 229, 0.1))',
        borderRadius: '16px',
        padding: '2rem',
        marginBottom: '2rem',
        border: '1px solid rgba(147, 51, 234, 0.3)',
      }}
    >
      <h3 style={{ fontSize: '1.3rem', marginBottom: '1.5rem', color: '#9333ea', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <span>🌐</span> Community Sharing
      </h3>

      <div style={{ marginBottom: '1.5rem' }}>
        <label
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '0.75rem',
            cursor: 'pointer',
            padding: '1.25rem',
            background: 'rgba(147, 51, 234, 0.1)',
            borderRadius: '12px',
            border: '1px solid rgba(147, 51, 234, 0.2)',
            transition: 'all 0.2s',
          }}
        >
          <input
            type="checkbox"
            checked={settings.autoShareEnabled ?? false}
            onChange={(e) => updateSettings({ autoShareEnabled: e.target.checked })}
            disabled={isUploading}
            style={{ width: '1.2rem', height: '1.2rem', marginTop: '0.2rem', flexShrink: 0 }}
          />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '1rem', fontWeight: '500', marginBottom: '0.5rem' }}>
              Auto-share generated cards to community gallery
            </div>
            <div style={{ fontSize: '0.85rem', opacity: 0.8, lineHeight: '1.5' }}>
              When enabled, your generated cards are automatically uploaded to IPFS when you close Settings.
              Cards are shared publicly and permanently with the community.
            </div>
          </div>
        </label>
      </div>

      <div style={{ marginBottom: '1.5rem' }}>
        <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', fontWeight: '500' }}>
          Display Name (optional)
        </label>
        <input
          type="text"
          value={settings.displayName || ''}
          onChange={(e) => updateSettings({ displayName: e.target.value })}
          placeholder="Anonymous"
          maxLength={50}
          disabled={isUploading}
          style={{
            width: '100%',
            padding: '0.75rem 1rem',
            background: 'rgba(0, 0, 0, 0.3)',
            border: '1px solid rgba(147, 51, 234, 0.3)',
            borderRadius: '8px',
            color: '#e8e8e8',
            fontSize: '0.95rem',
          }}
        />
        <p style={{ fontSize: '0.8rem', marginTop: '0.5rem', opacity: 0.7 }}>
          Your name will appear on shared galleries. Leave blank to share anonymously.
        </p>
      </div>

      <div style={{ marginBottom: '1.5rem' }}>
        <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', fontWeight: '500' }}>
          Deck Name
        </label>
        <input
          type="text"
          value={deckName}
          onChange={(e) => {
            const next = e.target.value;
            onDeckNameChange(next);
            updateSettings({
              deckName: next,
              deckNameMap: {
                ...(settings.deckNameMap || {}),
                [selectedDeck]: next,
              },
            });
          }}
          placeholder="e.g. Cosmic Wanderer"
          maxLength={80}
          disabled={isUploading}
          style={{
            width: '100%',
            padding: '0.75rem 1rem',
            background: 'rgba(0, 0, 0, 0.3)',
            border: '1px solid rgba(147, 51, 234, 0.3)',
            borderRadius: '8px',
            color: '#e8e8e8',
            fontSize: '0.95rem',
          }}
        />
      </div>

      <div style={{ marginBottom: '1.5rem' }}>
        <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', fontWeight: '500' }}>
          Deck Description
        </label>
        <textarea
          value={deckDescription}
          onChange={(e) => {
            const next = e.target.value;
            onDeckDescriptionChange(next);
            updateSettings({
              deckDescription: next,
              deckDescriptionMap: {
                ...(settings.deckDescriptionMap || {}),
                [selectedDeck]: next,
              },
            });
          }}
          placeholder="Short summary of this deck's vibe and prompt."
          maxLength={300}
          disabled={isUploading}
          rows={3}
          style={{
            width: '100%',
            padding: '0.75rem 1rem',
            background: 'rgba(0, 0, 0, 0.3)',
            border: '1px solid rgba(147, 51, 234, 0.3)',
            borderRadius: '8px',
            color: '#e8e8e8',
            fontSize: '0.95rem',
            resize: 'vertical',
          }}
        />
      </div>

      {settings.autoShareEnabled && (
        <div
          style={{
            padding: '1rem 1.25rem',
            background: isUploading ? 'rgba(147, 51, 234, 0.2)' : 'rgba(147, 51, 234, 0.1)',
            border: '1px solid rgba(147, 51, 234, 0.3)',
            borderRadius: '8px',
            fontSize: '0.9rem',
          }}
        >
          {isUploading ? (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '1.2rem' }}>⏳</span>
                <span style={{ fontWeight: '500' }}>{uploadProgress}</span>
              </div>
              <div style={{ fontSize: '0.8rem', opacity: 0.7 }}>
                Do not close this tab or navigate away
              </div>
            </div>
          ) : unsharedCount > 0 ? (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                <span>✓</span>
                <span style={{ fontWeight: '500' }}>
                  {unsharedCount} card{unsharedCount !== 1 ? 's' : ''} ready to share
                </span>
              </div>
              {generatedCards.length > unsharedCount && (
                <div style={{ fontSize: '0.8rem', opacity: 0.7, marginBottom: '0.25rem' }}>
                  {generatedCards.length - unsharedCount} already shared
                </div>
              )}
              <div style={{ fontSize: '0.8rem', opacity: 0.7 }}>
                Will upload when you close Settings
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span>✓</span>
              <span>All cards synced</span>
              {settings.lastSharedTimestamp && (
                <span style={{ opacity: 0.7, fontSize: '0.85rem' }}>
                  • Last shared: {new Date(settings.lastSharedTimestamp).toLocaleString()}
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
