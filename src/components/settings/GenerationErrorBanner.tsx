type GenerationErrorBannerProps = {
  generationError?: string | null;
  dismissedError: boolean;
  isRateLimitError: boolean;
  onDismiss: () => void;
};

export function GenerationErrorBanner({
  generationError,
  dismissedError,
  isRateLimitError,
  onDismiss,
}: GenerationErrorBannerProps) {
  if (!generationError || dismissedError) return null;

  return (
    <div
      style={{
        padding: '1rem',
        background: 'rgba(255, 0, 0, 0.1)',
        border: '1px solid rgba(255, 0, 0, 0.3)',
        borderRadius: '8px',
        color: '#ff6b6b',
        position: 'relative',
      }}
    >
      <button
        aria-label="Dismiss error"
        onClick={onDismiss}
        style={{
          position: 'absolute',
          top: '0.5rem',
          right: '0.5rem',
          background: 'transparent',
          border: 'none',
          color: '#ff6b6b',
          cursor: 'pointer',
          fontSize: '1rem',
        }}
      >
        ✕
      </button>
      <div style={{ fontWeight: 700, marginBottom: '0.35rem' }}>Error</div>
      <div style={{ lineHeight: 1.5 }}>{generationError}</div>
      {isRateLimitError && (
        <div style={{ marginTop: '0.75rem', fontSize: '0.9rem', color: '#ffd1d1' }}>
          <div style={{ marginBottom: '0.35rem' }}>
            Gemini video quota was hit. Common limits: ~10 videos/day and 5 requests/minute (sometimes lower).
          </div>
          <ul style={{ margin: 0, paddingLeft: '1.2rem', lineHeight: 1.5 }}>
            <li>We now throttle video requests to ~2 per minute to help avoid this.</li>
            <li>Try again after some time or use a new API key with billing enabled.</li>
            <li><a href="https://ai.dev/usage?tab=rate-limit" target="_blank" rel="noopener noreferrer" style={{ color: '#ffd1d1', textDecoration: 'underline' }}>Check current usage</a></li>
          </ul>
        </div>
      )}
    </div>
  );
}
