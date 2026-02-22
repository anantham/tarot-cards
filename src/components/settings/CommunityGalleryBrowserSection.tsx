import CommunityGallery from '../CommunityGallery';

type CommunityGalleryBrowserSectionProps = {
  showCommunityGallery: boolean;
  onToggle: () => void;
};

export function CommunityGalleryBrowserSection({
  showCommunityGallery,
  onToggle,
}: CommunityGalleryBrowserSectionProps) {
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
          background: 'rgba(147, 51, 234, 0.1)',
          border: '1px solid rgba(147, 51, 234, 0.3)',
          borderRadius: '8px',
          marginBottom: showCommunityGallery ? '1rem' : '1.5rem',
        }}
      >
        <h3 style={{ fontSize: '1.3rem', margin: 0, color: '#9333ea' }}>
          Community Gallery
        </h3>
        <span style={{ fontSize: '1.5rem', color: '#9333ea' }}>
          {showCommunityGallery ? '−' : '+'}
        </span>
      </div>

      {showCommunityGallery && (
        <div
          style={{
            padding: '1rem',
            background: 'rgba(0, 0, 0, 0.25)',
            borderRadius: '8px',
            maxHeight: '60vh',
            overflow: 'auto',
          }}
        >
          <CommunityGallery embedded />
        </div>
      )}
    </section>
  );
}
