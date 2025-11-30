import { useStore } from '../store/useStore';

export default function Header() {
  const { showSettings, setShowSettings, isGenerating, generationProgress } = useStore();

  return (
    <header
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 100,
        padding: '1.5rem 2rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: 'linear-gradient(180deg, rgba(10, 14, 39, 0.9) 0%, transparent 100%)',
        backdropFilter: 'blur(10px)',
      }}
    >
      <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
        {isGenerating && (
          <div style={{
            padding: '0.5rem 1rem',
            background: 'rgba(147, 51, 234, 0.2)',
            borderRadius: '8px',
            border: '1px solid rgba(147, 51, 234, 0.5)',
          }}>
            <div style={{ fontSize: '0.9rem', marginBottom: '0.25rem' }}>
              {generationProgress.status}
            </div>
            <div style={{ fontSize: '0.8rem', opacity: 0.8 }}>
              {generationProgress.current} / {generationProgress.total}
            </div>
          </div>
        )}

        <button
          onClick={() => setShowSettings(!showSettings)}
          style={{
            padding: '0.75rem',
            background: showSettings ? 'rgba(147, 51, 234, 0.3)' : 'rgba(255, 255, 255, 0.1)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            borderRadius: '8px',
            color: '#e8e8e8',
            cursor: 'pointer',
            fontSize: '1.1rem',
            transition: 'all 0.3s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(147, 51, 234, 0.3)';
            e.currentTarget.style.transform = 'translateY(-2px)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = showSettings ? 'rgba(147, 51, 234, 0.3)' : 'rgba(255, 255, 255, 0.1)';
            e.currentTarget.style.transform = 'translateY(0)';
          }}
        >
          ⚙️
        </button>
      </div>
    </header>
  );
}
