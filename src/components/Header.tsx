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
        justifyContent: 'flex-end',
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
            width: '40px',
            height: '40px',
            borderRadius: '50%',
            background: showSettings ? 'rgba(255, 255, 255, 0.14)' : 'rgba(255, 255, 255, 0.08)',
            border: '1px solid rgba(255, 255, 255, 0.18)',
            color: 'rgba(232, 232, 232, 0.8)',
            cursor: 'pointer',
            fontSize: '1.2rem',
            transition: 'all 0.3s ease',
            display: 'grid',
            placeItems: 'center',
            backdropFilter: 'blur(6px)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.18)';
            e.currentTarget.style.transform = 'translateY(-1px)';
            e.currentTarget.style.color = '#ffffff';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = showSettings ? 'rgba(255, 255, 255, 0.14)' : 'rgba(255, 255, 255, 0.08)';
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.color = 'rgba(232, 232, 232, 0.8)';
          }}
        >
          ⚙️
        </button>
      </div>
    </header>
  );
}
