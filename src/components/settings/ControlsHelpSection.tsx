type ControlsHelpSectionProps = {
  showControls: boolean;
  onToggle: () => void;
};

export function ControlsHelpSection({
  showControls,
  onToggle,
}: ControlsHelpSectionProps) {
  return (
    <section>
      <div
        onClick={onToggle}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer',
          padding: '0.75rem 1rem',
          background: 'rgba(212, 175, 55, 0.1)',
          border: '1px solid rgba(212, 175, 55, 0.3)',
          borderRadius: '8px',
          marginBottom: showControls ? '1rem' : 0,
        }}
      >
        <h3 style={{ fontSize: '1.3rem', margin: 0, color: '#d4af37' }}>
          Controls & Help
        </h3>
        <span style={{ fontSize: '1.5rem', color: '#d4af37' }}>
          {showControls ? '−' : '+'}
        </span>
      </div>

      {showControls && (
        <div
          style={{
            padding: '1.5rem',
            background: 'rgba(0, 0, 0, 0.2)',
            borderRadius: '8px',
            marginBottom: '0.5rem',
          }}
        >
          <h4 style={{ fontSize: '1.1rem', marginBottom: '1rem', color: '#9333ea' }}>
            Camera Controls
          </h4>
          <div style={{ fontSize: '0.9rem', lineHeight: '1.8', marginBottom: '1.5rem' }}>
            <div><strong>Left-click + Drag:</strong> Rotate camera around the scene</div>
            <div><strong>Right-click + Drag:</strong> Pan camera (move left/right/up/down)</div>
            <div><strong>Scroll Wheel:</strong> Zoom in/out</div>
            <div style={{ marginTop: '0.5rem', opacity: 0.7, fontSize: '0.85rem' }}>
              Zoom range: 5 to 30 units | Vertical angle limited to prevent flipping
            </div>
          </div>

          <h4 style={{ fontSize: '1.1rem', marginBottom: '1rem', color: '#9333ea' }}>
            Card Interactions
          </h4>
          <div style={{ fontSize: '0.9rem', lineHeight: '1.8', marginBottom: '1.5rem' }}>
            <div><strong>Hover:</strong> Card glows and scales up, shows name and keyword</div>
            <div><strong>Click:</strong> Open card detail view</div>
            <div><strong>Click + Drag:</strong> Grab and move card in 3D space</div>
            <div><strong>Release while moving:</strong> Throw card with momentum</div>
            <div style={{ marginTop: '0.5rem', opacity: 0.7, fontSize: '0.85rem' }}>
              Note: Left-click controls both camera and cards - camera rotation works when not hovering over cards
            </div>
          </div>

          <h4 style={{ fontSize: '1.1rem', marginBottom: '1rem', color: '#9333ea' }}>
            Physics Behavior
          </h4>
          <div style={{ fontSize: '0.9rem', lineHeight: '1.8' }}>
            <div><strong>Magnetic Repulsion:</strong> Cards push away from each other to avoid collisions</div>
            <div><strong>Cursor Repulsion:</strong> Cards gently move away from your mouse cursor</div>
            <div><strong>Center Attraction:</strong> Cards are pulled back toward center when they drift too far</div>
            <div><strong>Random Drift:</strong> Each card follows unique wandering trajectories</div>
            <div><strong>Boundary Forces:</strong> Soft walls keep cards visible within the scene</div>
          </div>
        </div>
      )}
    </section>
  );
}
