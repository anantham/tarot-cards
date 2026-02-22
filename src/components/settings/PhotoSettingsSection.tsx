import type { ChangeEvent } from 'react';

type PhotoSettingsSectionProps = {
  photoPreview: string;
  usePhoto: boolean;
  onPhotoUpload: (e: ChangeEvent<HTMLInputElement>) => void;
  onPhotoRemove: () => void;
  onUsePhotoChange: (enabled: boolean) => void;
};

export function PhotoSettingsSection({
  photoPreview,
  usePhoto,
  onPhotoUpload,
  onPhotoRemove,
  onUsePhotoChange,
}: PhotoSettingsSectionProps) {
  return (
    <section>
      <h3 style={{ fontSize: '1.3rem', marginBottom: '1rem', color: '#d4af37' }}>
        Your Photo
      </h3>
      <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'flex-start' }}>
        <div
          style={{
            width: '150px',
            height: '150px',
            borderRadius: '12px',
            border: '2px solid rgba(147, 51, 234, 0.5)',
            overflow: 'hidden',
            background: 'rgba(0, 0, 0, 0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {photoPreview ? (
            <img src={photoPreview} alt="Your photo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <div style={{ textAlign: 'center', opacity: 0.5 }}>
              <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📸</div>
              <div style={{ fontSize: '0.8rem' }}>No photo</div>
            </div>
          )}
        </div>
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: '0.95rem', marginBottom: '1rem', opacity: 0.8, lineHeight: '1.5' }}>
            Upload your photo to generate personalized tarot cards. This will be used as the base for all 22 cards, placing you in each archetypal role.
          </p>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center', marginBottom: '0.75rem' }}>
            <label
              style={{
                display: 'inline-block',
                padding: '0.75rem 1.5rem',
                background: 'rgba(147, 51, 234, 0.3)',
                border: '1px solid rgba(147, 51, 234, 0.5)',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '0.95rem',
                fontWeight: '500',
                transition: 'all 0.3s ease',
              }}
            >
              📁 Choose Photo
              <input
                type="file"
                accept="image/*"
                onChange={onPhotoUpload}
                style={{ display: 'none' }}
              />
            </label>
            <button
              onClick={onPhotoRemove}
              disabled={!photoPreview}
              style={{
                padding: '0.75rem 1.25rem',
                background: photoPreview ? 'rgba(255, 0, 0, 0.15)' : 'rgba(100, 100, 100, 0.2)',
                border: photoPreview ? '1px solid rgba(255, 0, 0, 0.35)' : '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '8px',
                color: '#e8e8e8',
                fontSize: '0.95rem',
                fontWeight: '500',
                cursor: photoPreview ? 'pointer' : 'not-allowed',
                opacity: photoPreview ? 1 : 0.5,
                transition: 'all 0.3s ease',
              }}
            >
              🗑️ Remove Photo
            </button>
          </div>
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={usePhoto}
              onChange={(e) => onUsePhotoChange(e.target.checked)}
              style={{ width: '18px', height: '18px', marginTop: '0.15rem' }}
            />
            <div>
              <div style={{ fontSize: '0.95rem', fontWeight: '600' }}>
                Use uploaded images for generation
              </div>
              <div style={{ fontSize: '0.85rem', opacity: 0.7, lineHeight: '1.6' }}>
                Toggle off to keep your photo and reference images stored locally but generate cards without sending them to the API.
              </div>
            </div>
          </label>
        </div>
      </div>
    </section>
  );
}
