import { motion } from 'framer-motion';
import { useStore } from '../store/useStore';
import type { CardInterpretation } from '../types';

export default function CardDetail() {
  const { selectedCard, setSelectedCard, settings, getGeneratedCard } = useStore();

  if (!selectedCard) return null;

  // Get the correct interpretation based on selected deck type
  const getInterpretation = (): CardInterpretation => {
    const deckType = settings.selectedDeckType;
    if (deckType === 'lord-of-mysteries') return selectedCard.lordOfMysteries;
    if (deckType === 'traditional-rider-waite') return selectedCard.traditional;
    if (deckType === 'egyptian-tarot') return selectedCard.egyptian;
    if (deckType === 'celtic-tarot') return selectedCard.celtic;
    if (deckType === 'japanese-shinto') return selectedCard.shinto;
    return selectedCard.traditional;
  };

  const interpretation = getInterpretation();
  const generatedCard = getGeneratedCard(selectedCard.number, settings.selectedDeckType);

  const getTitle = () => {
    return interpretation.name || interpretation.pathway || interpretation.deity || interpretation.figure || interpretation.kami || 'Unknown';
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 200,
        background: 'rgba(10, 14, 39, 0.95)',
        backdropFilter: 'blur(20px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem',
      }}
      onClick={() => setSelectedCard(null)}
    >
      <motion.div
        initial={{ scale: 0.8, rotateY: 90 }}
        animate={{ scale: 1, rotateY: 0 }}
        transition={{ type: 'spring', duration: 0.7 }}
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: '1200px',
          width: '100%',
          maxHeight: '90vh',
          background: 'linear-gradient(135deg, rgba(26, 26, 46, 0.95) 0%, rgba(22, 33, 62, 0.95) 100%)',
          borderRadius: '20px',
          border: '2px solid rgba(147, 51, 234, 0.3)',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5), 0 0 80px rgba(147, 51, 234, 0.3)',
          overflow: 'auto',
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '2rem',
          padding: '3rem',
        }}
      >
        {/* Left side - Card Image */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div
            style={{
              position: 'relative',
              aspectRatio: '2/3',
              background: 'linear-gradient(135deg, #1a1a2e 0%, #0a0e27 100%)',
              borderRadius: '12px',
              border: '3px solid rgba(212, 175, 55, 0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
            }}
          >
            {generatedCard?.gifUrl ? (
              <img
                src={generatedCard.gifUrl}
                alt={getTitle()}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            ) : generatedCard?.frames?.[0] ? (
              <img
                src={generatedCard.frames[0]}
                alt={getTitle()}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            ) : (
              <div style={{ textAlign: 'center', padding: '2rem', opacity: 0.5 }}>
                <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🎴</div>
                <div style={{ fontSize: '1.2rem', marginBottom: '0.5rem' }}>
                  {selectedCard.number === 0 ? '0' : selectedCard.number}
                </div>
                <div style={{ fontSize: '0.9rem' }}>Card not generated yet</div>
                <div style={{ fontSize: '0.8rem', marginTop: '1rem' }}>
                  Go to Settings to generate your personalized cards
                </div>
              </div>
            )}
          </div>

          {/* Keywords */}
          <div>
            <h3 style={{ fontSize: '0.9rem', opacity: 0.7, marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Keywords
            </h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {interpretation.keywords.map((keyword, i) => (
                <span
                  key={i}
                  style={{
                    padding: '0.4rem 0.8rem',
                    background: 'rgba(147, 51, 234, 0.2)',
                    border: '1px solid rgba(147, 51, 234, 0.4)',
                    borderRadius: '6px',
                    fontSize: '0.85rem',
                  }}
                >
                  {keyword}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Right side - Card Info */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          {/* Header */}
          <div>
            <div style={{ fontSize: '0.9rem', opacity: 0.6, marginBottom: '0.5rem' }}>
              Card {selectedCard.number} / 21
            </div>
            <h2 style={{ fontSize: '2.5rem', fontWeight: '700', marginBottom: '0.5rem', color: '#d4af37' }}>
              {getTitle()}
            </h2>
            {interpretation.sequence && (
              <div style={{ fontSize: '1rem', opacity: 0.8, marginBottom: '0.5rem' }}>
                {interpretation.sequence}
              </div>
            )}
          </div>

          {/* Meaning */}
          {interpretation.meaning && (
            <div>
              <h3 style={{ fontSize: '1.1rem', marginBottom: '0.75rem', opacity: 0.9 }}>
                Traditional Meaning
              </h3>
              <p style={{ fontSize: '1rem', lineHeight: '1.6', opacity: 0.8 }}>
                {interpretation.meaning}
              </p>
            </div>
          )}

          {/* Abilities (for LoTM) */}
          {interpretation.abilities && (
            <div>
              <h3 style={{ fontSize: '1.1rem', marginBottom: '0.75rem', opacity: 0.9 }}>
                Abilities
              </h3>
              <p style={{ fontSize: '1rem', lineHeight: '1.6', opacity: 0.8 }}>
                {interpretation.abilities}
              </p>
            </div>
          )}

          {/* Personal Lore */}
          <div>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '0.75rem', opacity: 0.9 }}>
              Personal Story
            </h3>
            <p style={{
              fontSize: '1rem',
              lineHeight: '1.6',
              opacity: selectedCard.personalLore.startsWith('FILL THIS') ? 0.5 : 0.8,
              fontStyle: selectedCard.personalLore.startsWith('FILL THIS') ? 'italic' : 'normal',
            }}>
              {selectedCard.personalLore}
            </p>
          </div>

          {/* Prompt Preview */}
          <div>
            <h3 style={{ fontSize: '0.9rem', marginBottom: '0.5rem', opacity: 0.7, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Generation Prompt
            </h3>
            <p style={{
              fontSize: '0.85rem',
              lineHeight: '1.5',
              opacity: 0.6,
              padding: '1rem',
              background: 'rgba(0, 0, 0, 0.3)',
              borderRadius: '8px',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              fontFamily: 'monospace',
            }}>
              {interpretation.prompt}
            </p>
          </div>
        </div>

        {/* Close button */}
        <button
          onClick={() => setSelectedCard(null)}
          style={{
            position: 'absolute',
            top: '1.5rem',
            right: '1.5rem',
            width: '40px',
            height: '40px',
            borderRadius: '50%',
            background: 'rgba(255, 255, 255, 0.1)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            color: '#e8e8e8',
            fontSize: '1.2rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.3s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(255, 0, 0, 0.3)';
            e.currentTarget.style.transform = 'scale(1.1)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
            e.currentTarget.style.transform = 'scale(1)';
          }}
        >
          ✕
        </button>
      </motion.div>
    </motion.div>
  );
}
