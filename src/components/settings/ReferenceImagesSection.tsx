import type { ChangeEvent } from 'react';
import type { ReferenceImage } from '../../types';

type ReferenceImagesSectionProps = {
  referenceImages: ReferenceImage[];
  referencesEnabled: boolean;
  onUpload: (e: ChangeEvent<HTMLInputElement>) => void;
  onRemove: (id: string) => void;
  onUpdate: (id: string, updates: Partial<ReferenceImage>) => void;
  getInstructionForType: (type: string) => string;
};

export function ReferenceImagesSection({
  referenceImages,
  referencesEnabled,
  onUpload,
  onRemove,
  onUpdate,
  getInstructionForType,
}: ReferenceImagesSectionProps) {
  return (
    <section>
      <h3 style={{ fontSize: '1.3rem', marginBottom: '1rem', color: '#d4af37' }}>
        Reference Images (Advanced)
      </h3>
      <p style={{ fontSize: '0.9rem', marginBottom: '1rem', opacity: 0.8, lineHeight: '1.5' }}>
        Upload multiple reference images to blend faces, poses, styles, and backgrounds into your tarot cards.
      </p>

      {!referencesEnabled && (
        <div
          style={{
            marginBottom: '1rem',
            padding: '0.75rem 1rem',
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '8px',
            color: '#ffb347',
            fontSize: '0.85rem',
          }}
        >
          Image references are currently disabled. Turn on "Use uploaded images for generation" above to include them.
        </div>
      )}

      <label
        style={{
          display: 'inline-block',
          padding: '0.75rem 1.5rem',
          background: 'rgba(212, 175, 55, 0.2)',
          border: '1px solid rgba(212, 175, 55, 0.5)',
          borderRadius: '8px',
          cursor: 'pointer',
          fontSize: '0.95rem',
          fontWeight: '500',
          marginBottom: '1.5rem',
          transition: 'all 0.3s ease',
        }}
      >
        + Add Reference Images
        <input
          type="file"
          accept="image/*"
          multiple
          onChange={onUpload}
          style={{ display: 'none' }}
        />
      </label>

      {referenceImages.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
          {referenceImages.map((img) => (
            <div
              key={img.id}
              style={{
                background: 'rgba(0, 0, 0, 0.3)',
                border: '1px solid rgba(147, 51, 234, 0.3)',
                borderRadius: '8px',
                padding: '0.75rem',
                position: 'relative',
              }}
            >
              <button
                onClick={() => onRemove(img.id)}
                style={{
                  position: 'absolute',
                  top: '0.5rem',
                  right: '0.5rem',
                  width: '24px',
                  height: '24px',
                  borderRadius: '50%',
                  background: 'rgba(255, 0, 0, 0.8)',
                  border: 'none',
                  color: 'white',
                  cursor: 'pointer',
                  fontSize: '0.9rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                ✕
              </button>

              <img
                src={img.dataUrl}
                alt="Reference"
                style={{
                  width: '100%',
                  height: '120px',
                  objectFit: 'cover',
                  borderRadius: '4px',
                  marginBottom: '0.75rem',
                }}
              />

              <select
                value={img.type}
                onChange={(e) => {
                  const newType = e.target.value as ReferenceImage['type'];
                  onUpdate(img.id, {
                    type: newType,
                    instruction: getInstructionForType(newType),
                  });
                }}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  background: 'rgba(0, 0, 0, 0.4)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  borderRadius: '4px',
                  color: '#e8e8e8',
                  fontSize: '0.85rem',
                  marginBottom: '0.5rem',
                  cursor: 'pointer',
                }}
              >
                <option value="face">Face Reference</option>
                <option value="body">Body/Pose Reference</option>
                <option value="style">Style Reference</option>
                <option value="background">Background Reference</option>
                <option value="custom">Custom Instruction</option>
              </select>

              <textarea
                value={img.instruction}
                onChange={(e) => onUpdate(img.id, { instruction: e.target.value })}
                placeholder="Instruction for this image..."
                rows={2}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  background: 'rgba(0, 0, 0, 0.4)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  borderRadius: '4px',
                  color: '#e8e8e8',
                  fontSize: '0.8rem',
                  fontFamily: 'inherit',
                  resize: 'vertical',
                }}
              />
            </div>
          ))}
        </div>
      )}

      {referenceImages.length === 0 && (
        <p style={{ fontSize: '0.85rem', opacity: 0.5, fontStyle: 'italic' }}>
          No reference images added yet. Click "Add Reference Images" to get started.
        </p>
      )}
    </section>
  );
}
